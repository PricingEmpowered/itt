import { QuantityBreak } from '../types';

export interface QuantityBreakResult {
  basePrice: number;
  effectivePrice: number;
  appliedBreak: QuantityBreak | null;
  discount: number;
  breakDescription: string;
}

export function calculatePriceWithQuantityBreaks(
  basePrice: number,
  quantity: number,
  quantityBreaks: QuantityBreak[],
  priceListId?: string | null
): QuantityBreakResult {
  if (!quantityBreaks || quantityBreaks.length === 0) {
    return {
      basePrice,
      effectivePrice: basePrice,
      appliedBreak: null,
      discount: 0,
      breakDescription: '',
    };
  }

  const relevantBreaks = quantityBreaks.filter(
    (qb) => qb.price_list_id === priceListId || qb.price_list_id === null
  );

  const applicableBreak = relevantBreaks.find(
    (qb) =>
      quantity >= qb.min_quantity &&
      (qb.max_quantity === null || qb.max_quantity === undefined || quantity <= qb.max_quantity)
  );

  if (!applicableBreak) {
    return {
      basePrice,
      effectivePrice: basePrice,
      appliedBreak: null,
      discount: 0,
      breakDescription: '',
    };
  }

  let effectivePrice = basePrice;
  let discount = 0;
  let breakDescription = '';

  if (applicableBreak.discount_percent !== null && applicableBreak.discount_percent !== undefined) {
    discount = applicableBreak.discount_percent;
    effectivePrice = basePrice * (1 - discount / 100);
    breakDescription = `${discount}% discount (Qty ${applicableBreak.min_quantity}${applicableBreak.max_quantity ? `-${applicableBreak.max_quantity}` : '+'})`;
  } else if (applicableBreak.fixed_price !== null && applicableBreak.fixed_price !== undefined) {
    effectivePrice = applicableBreak.fixed_price;
    discount = ((basePrice - effectivePrice) / basePrice) * 100;
    breakDescription = `Fixed price $${effectivePrice.toFixed(2)} (Qty ${applicableBreak.min_quantity}${applicableBreak.max_quantity ? `-${applicableBreak.max_quantity}` : '+'})`;
  }

  return {
    basePrice,
    effectivePrice,
    appliedBreak: applicableBreak,
    discount,
    breakDescription,
  };
}

export function getAvailableQuantityBreaks(
  productId: string,
  quantityBreaks: QuantityBreak[],
  priceListId?: string | null
): QuantityBreak[] {
  return quantityBreaks
    .filter(
      (qb) =>
        qb.product_id === productId &&
        (qb.price_list_id === priceListId || qb.price_list_id === null)
    )
    .sort((a, b) => a.min_quantity - b.min_quantity);
}

export function formatQuantityBreakRange(qb: QuantityBreak): string {
  if (qb.max_quantity === null || qb.max_quantity === undefined) {
    return `${qb.min_quantity}+`;
  }
  return `${qb.min_quantity}-${qb.max_quantity}`;
}

export function formatQuantityBreakPricing(qb: QuantityBreak): string {
  if (qb.discount_percent !== null && qb.discount_percent !== undefined) {
    return `${qb.discount_percent}% off`;
  }
  if (qb.fixed_price !== null && qb.fixed_price !== undefined) {
    return `$${qb.fixed_price.toFixed(2)}/unit`;
  }
  return 'N/A';
}
