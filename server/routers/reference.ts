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
