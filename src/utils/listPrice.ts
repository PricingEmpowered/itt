import { Product } from '../types';

/**
 * Markup applied to a product's base cost to arrive at its list price.
 * Products carry only `base_cost`; list price is derived rather than stored.
 */
export const LIST_PRICE_MARKUP = 1.5;

/** List price for a product, derived from its base cost. */
export function deriveListPrice(product: Pick<Product, 'base_cost'>): number {
  return product.base_cost * LIST_PRICE_MARKUP;
}

/**
 * Discount percentage of `unitPrice` against the product's list price.
 * Returns 0 when list price is zero or missing so callers never surface NaN.
 */
export function discountFromListPrice(
  product: Pick<Product, 'base_cost'>,
  unitPrice: number
): number {
  const listPrice = deriveListPrice(product);
  if (!listPrice) return 0;
  return ((listPrice - unitPrice) / listPrice) * 100;
}
