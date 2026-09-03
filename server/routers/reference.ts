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
