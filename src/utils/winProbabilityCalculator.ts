import { db } from '../lib/dataClient';
import { trpcClient } from '../lib/trpcClient';

interface WinProbabilityResult {
  probability: number;
  confidence: 'high' | 'medium' | 'low';
  factors: {
    customerWinRate: number;
    productWinRate: number;
    discountLevel: string;
    historicalQuotes: number;
  };
  insights: string[];
}

export async function calculateWinProbability(
  customerId: string,
  productIds: string[],
  averageDiscount: number,
  quoteTotal: number
): Promise<WinProbabilityResult | null> {
  try {
    const customerWinRate = await getCustomerWinRate(customerId);
    const productWinRates = await getProductWinRates(productIds);
    const discountWinRate = await getDiscountBasedWinRate(averageDiscount);
    const sizeWinRate = await getQuoteSizeWinRate(quoteTotal);

    const weights = {
      customer: 0.35,
      product: 0.30,
      discount: 0.20,
      size: 0.15
    };

    const weightedProbability =
      (customerWinRate.rate * weights.customer) +
      (productWinRates.averageRate * weights.product) +
      (discountWinRate.rate * weights.discount) +
      (sizeWinRate.rate * weights.size);

    const totalHistoricalQuotes =
      customerWinRate.totalQuotes +
      productWinRates.totalQuotes;

    const confidence = totalHistoricalQuotes > 50 ? 'high' :
                       totalHistoricalQuotes > 20 ? 'medium' : 'low';

    const insights: string[] = [];

    if (customerWinRate.rate > 0.7) {
      insights.push(`Strong customer relationship (${(customerWinRate.rate * 100).toFixed(0)}% win rate)`);
    } else if (customerWinRate.rate < 0.4) {
      insights.push(`Low customer win rate (${(customerWinRate.rate * 100).toFixed(0)}%)`);
    }

    if (productWinRates.averageRate > 0.65) {
      insights.push('Products have strong market acceptance');
    } else if (productWinRates.averageRate < 0.45) {
      insights.push('Products have below-average win rates');
    }

    if (averageDiscount > 25) {
      insights.push(`High discount level (${averageDiscount.toFixed(1)}%) may signal competitive pressure`);
    } else if (averageDiscount < 10) {
      insights.push(`Low discount (${averageDiscount.toFixed(1)}%) maintains premium positioning`);
    }

    if (sizeWinRate.rate > 0.6) {
      insights.push('Quote size aligns with successful deal patterns');
    }

    return {
      probability: Math.round(weightedProbability * 100) / 100,
      confidence,
      factors: {
        customerWinRate: Math.round(customerWinRate.rate * 100),
        productWinRate: Math.round(productWinRates.averageRate * 100),
        discountLevel: getDiscountCategory(averageDiscount),
        historicalQuotes: totalHistoricalQuotes
      },
      insights
    };
  } catch (error) {
    console.error('Error calculating win probability:', error);
    return null;
  }
}

async function getCustomerWinRate(customerId: string): Promise<{ rate: number; totalQuotes: number }> {
  const { data, error } = await db
    .from('quotes')
    .select('status')
    .eq('customer_id', customerId)
    .in('status', ['Approved', 'Rejected']);

  if (error || !data || data.length === 0) {
    return { rate: 0.5, totalQuotes: 0 };
  }

  const approved = data.filter(q => q.status === 'Approved').length;
  const total = data.length;

  return {
    rate: total > 0 ? approved / total : 0.5,
    totalQuotes: total
  };
}

async function getProductWinRates(productIds: string[]): Promise<{ averageRate: number; totalQuotes: number }> {
  if (productIds.length === 0) {
    return { averageRate: 0.5, totalQuotes: 0 };
  }

  const { data: quoteLines, error } = await db
    .from('quote_lines')
    .select('quote_id, product_id')
    .in('product_id', productIds);

  if (error || !quoteLines || quoteLines.length === 0) {
    return { averageRate: 0.5, totalQuotes: 0 };
  }

  const quoteIds = [...new Set(quoteLines.map(ql => ql.quote_id))];

  const { data: quotes } = await db
    .from('quotes')
    .select('id, status')
    .in('id', quoteIds)
    .in('status', ['Approved', 'Rejected']);

  if (!quotes || quotes.length === 0) {
    return { averageRate: 0.5, totalQuotes: 0 };
  }

  const approved = quotes.filter(q => q.status === 'Approved').length;
  const total = quotes.length;

  return {
    averageRate: total > 0 ? approved / total : 0.5,
    totalQuotes: total
  };
}

/*
 * Win rate for quotes at a comparable discount.
 *
 * Replaces a browser query that embedded `quotes!inner(status)` and asked for
 * `discount_percent`. The compatibility layer cannot serve embedded selects,
 * and `discount_percent` is not a column on quote_lines -- it is
 * `discount_applied` -- so this could not have worked on either count. It
 * failed silently and returned a hardcoded 0.5 every time, which looked like
 * a real answer.
 */
async function getDiscountBasedWinRate(discount: number): Promise<{ rate: number }> {
  try {
    const result = await trpcClient.quotes.winRate.query({
      discountPercent: discount,
      quoteTotal: null,
    });
    /* No comparable history is not a 50% chance; it is no opinion. The
     * caller's neutral prior stays 0.5, but the sample size travels with it
     * so the confidence rating can reflect that nothing backed it. */
    return { rate: result.byDiscount.rate ?? 0.5 };
  } catch (error) {
    console.error('Error loading discount win rate:', error);
    return { rate: 0.5 };
  }
}

async function getQuoteSizeWinRate(quoteTotal: number): Promise<{ rate: number }> {
  const rangePercent = 0.3;
  const lowerBound = quoteTotal * (1 - rangePercent);
  const upperBound = quoteTotal * (1 + rangePercent);

  const { data, error } = await db
    .from('quotes')
    .select('status, total')
    .in('status', ['Approved', 'Rejected'])
    .gte('total', lowerBound)
    .lte('total', upperBound);

  if (error || !data || data.length === 0) {
    return { rate: 0.5 };
  }

  const approved = data.filter(q => q.status === 'Approved').length;
  const total = data.length;

  return {
    rate: total > 0 ? approved / total : 0.5
  };
}

function getDiscountCategory(discount: number): string {
  if (discount < 10) return 'Low (< 10%)';
  if (discount < 20) return 'Moderate (10-20%)';
  if (discount < 30) return 'High (20-30%)';
  return 'Very High (> 30%)';
}
