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
    .input(z.object({ partNumbers: z.array(z.string().min(1).max(200)).min(1).max(500) }))
    .query(({ ctx, input }) =>
      ctx.withDb(async (db) => {
        const { rows } = await db.query<{
          part_number: string;
          id: string;
          name: string;
          status: string | null;
          category: string | null;
          base_cost: string | null;
        }>(
          `SELECT lower(btrim(q.part_number)) AS part_number,
                  p.id, p.name, p.status, p.category, p.base_cost
             FROM unnest($1::text[]) AS q(part_number)
             JOIN products p ON lower(p.id) = lower(btrim(q.part_number))`,
          [input.partNumbers]
        );
        return rows.map((r) => ({
          partNumber: r.part_number,
          productId: r.id,
          name: r.name,
          status: r.status,
          category: r.category,
          baseCost: r.base_cost === null ? null : Number(r.base_cost),
        }));
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
