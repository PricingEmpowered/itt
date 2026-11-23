/**
 * Read endpoints for the catalog and reference tables.
 *
 * The Supabase-era frontend issued `select('*').order(...)` against these
 * tables directly from the browser. These endpoints reproduce exactly that,
 * but server-side and under the caller's RLS context.
 *
 * Table and column names come from this module's own constants, never from
 * request input, so interpolating them into SQL is safe. Anything derived
 * from user input is passed as a bound parameter.
 */
import { z } from 'zod';
import { protectedProcedure, router } from '../trpc.js';

function listAll(table: string, orderBy: string) {
  const sql = `SELECT * FROM ${table} ORDER BY ${orderBy}`;
  return protectedProcedure.query(({ ctx }) =>
    ctx.withDb(async (db) => (await db.query(sql)).rows)
  );
}

export const referenceRouter = router({
  /**
   * Active products with their family embedded, replacing the Supabase
   * select `*, family:product_families(id, name)`. The generic data router
   * has no embedded-select support by design, so joins live in real
   * endpoints like this one.
   */
  /*
   * Resolves part numbers from an uploaded quote request against the whole
   * catalogue, inactive products included.
   *
   * activeProductsWithFamily is deliberately active-only, because that is the
   * right list to offer someone choosing a product. It is the wrong list to
   * match an uploaded request against: a rep can request a part that is
   * discontinued, superseded or in phase-out, and that part still exists in
   * the item master with a cost and a category. Matching against the active
   * list alone makes such a line look like a configured product - no cost, no
   * cohort, no price, and no explanation of why.
   *
   * So matching happens here, over everything, and the status comes back with
   * it so the screen can price the line and still say the part is inactive.
   * Matching is case-insensitive and ignores surrounding whitespace, because
   * part numbers arrive from a spreadsheet.
   */
  resolveParts: protectedProcedure
    .input(
      z.object({
        parts: z
          .array(
            z.object({
              /** The catalogue number: PART_NO in the Channel Partners export. */
              partNumber: z.string().min(1).max(200),
              /** The internal number: PART_NO_MANUF. A second way to find the same part. */
              altPartNumber: z.string().max(200).nullable().default(null),
            })
          )
          .min(1)
          .max(500),
      })
    )
    .query(({ ctx, input }) =>
      ctx.withDb(async (db) => {
        /*
         * Candidates come back ranked by how strong the match is:
         *   1  the number is the product's own id
         *   2  the number, normalised, is one of the product's recorded part numbers
         *   3  the alternate number, normalised, is one of them
         * Normalising is uppercase with everything but letters and digits removed,
         * the same reduction product_part_numbers.normalised was built with, so
         * CIR-070 and cir070 find the same part.
         */
        const { rows } = await db.query<{
          ord: number;
          rank: number;
          id: string;
          name: string;
          status: string | null;
          category: string | null;
          base_cost: string | null;
        }>(
          `WITH q AS (
             SELECT t.ord::int AS ord,
                    lower(btrim(t.pn)) AS key,
                    NULLIF(upper(regexp_replace(t.pn, '[^A-Za-z0-9]', '', 'g')), '') AS norm,
                    NULLIF(upper(regexp_replace(coalesce(t.alt, ''), '[^A-Za-z0-9]', '', 'g')), '') AS alt_norm
               FROM unnest($1::text[], $2::text[]) WITH ORDINALITY AS t(pn, alt, ord)
           )
           SELECT q.ord, 1 AS rank, p.id, p.name, p.status, p.category, p.base_cost
             FROM q JOIN products p ON lower(p.id) = q.key
           UNION ALL
           SELECT q.ord, 2, p.id, p.name, p.status, p.category, p.base_cost
             FROM q
             JOIN product_part_numbers n ON n.normalised = q.norm
             JOIN products p ON p.id = n.product_id
           UNION ALL
           SELECT q.ord, 3, p.id, p.name, p.status, p.category, p.base_cost
             FROM q
             JOIN product_part_numbers n ON n.normalised = q.alt_norm
             JOIN products p ON p.id = n.product_id`,
          [input.parts.map((p) => p.partNumber), input.parts.map((p) => p.altPartNumber)]
        );

        /*
         * The strongest rank that found anything decides. If it found more than
         * one distinct product the number is ambiguous, and no product is
         * returned: picking one would price the line from the wrong part's cost
         * and history without any sign that it had.
         */
        type Match = {
          index: number;
          productId: string;
          name: string;
          status: string | null;
          category: string | null;
          baseCost: number | null;
          matchedBy: 'id' | 'part number' | 'alternate part number';
        };
        const matches: Match[] = [];
        const ambiguous: Array<{ index: number; productIds: string[] }> = [];

        const byLine = new Map<number, typeof rows>();
        for (const r of rows) {
          const list = byLine.get(r.ord) ?? [];
          list.push(r);
          byLine.set(r.ord, list);
        }

        for (const [ord, candidates] of byLine) {
          const best = Math.min(...candidates.map((c) => c.rank));
          const atBest = candidates.filter((c) => c.rank === best);
          const distinct = [...new Map(atBest.map((c) => [c.id, c])).values()];
          const index = ord - 1;

          if (distinct.length > 1) {
            ambiguous.push({ index, productIds: distinct.map((d) => d.id).sort() });
            continue;
          }
          const hit = distinct[0];
          matches.push({
            index,
            productId: hit.id,
            name: hit.name,
            status: hit.status,
            category: hit.category,
            baseCost: hit.base_cost === null ? null : Number(hit.base_cost),
            matchedBy: best === 1 ? 'id' : best === 2 ? 'part number' : 'alternate part number',
          });
        }

        return { matches, ambiguous };
      })
    ),

  activeProductsWithFamily: protectedProcedure.query(({ ctx }) =>
    ctx.withDb(async (db) => {
      const { rows } = await db.query(
        `SELECT p.*,
                CASE WHEN f.id IS NULL THEN NULL
                     ELSE jsonb_build_object('id', f.id, 'name', f.name)
                END AS family
           FROM products p
           LEFT JOIN product_families f ON f.id = p.family_id
          WHERE p.status = 'Active'
          ORDER BY p.name`
      );
      return rows;
    })
  ),

  /** Active services with their SLA tier embedded (`*, sla_tier:service_sla_tiers(*)`). */
  activeServicesWithSla: protectedProcedure.query(({ ctx }) =>
    ctx.withDb(async (db) => {
      const { rows } = await db.query(
        `SELECT s.*, to_jsonb(t.*) AS sla_tier
           FROM services s
           LEFT JOIN service_sla_tiers t ON t.id = s.sla_tier_id
          WHERE s.is_active
          ORDER BY s.name`
      );
      return rows;
    })
  ),

  products: listAll('products', 'name'),
  services: listAll('services', 'name'),
  customers: listAll('customers', 'name'),
  priceLists: listAll('price_lists', 'name'),
  priceListItems: listAll('price_list_items', 'price_list_id, product_id'),
  productFamilies: listAll('product_families', 'name'),
  regions: listAll('regions', 'name'),
  industries: listAll('industries', 'name'),
  currencies: listAll('currencies', 'code'),
  exchangeRates: listAll('exchange_rates', 'from_currency, to_currency'),
  quantityBreaks: listAll('quantity_breaks', 'product_id, min_quantity'),
  commissionTiers: listAll('commission_tiers', 'min_deal_size'),
  userProfiles: listAll('user_profiles', 'full_name'),
});
