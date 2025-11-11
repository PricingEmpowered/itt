import { supabase } from '../lib/supabase';
import { DealScoreDetails, QuoteLine, Product } from '../types';

interface HistoricalDealData {
  margin_percent: number;
  discount_percent: number;
  product_category: string;
}

export interface DealScoreResult {
  score: number | null;
  details: DealScoreDetails | null;
}

export async function calculateDealScore(
  quoteLines: Partial<QuoteLine>[],
  products: Product[],
  customerId: string
): Promise<DealScoreResult> {
  try {
    if (!customerId || quoteLines.length === 0) {
      return { score: null, details: null };
    }

    const { data: customer } = await supabase
      .from('customers')
      .select('industry_id, region_id')
      .eq('id', customerId)
      .maybeSingle();

    if (!customer || !customer.industry_id || !customer.region_id) {
      return { score: null, details: null };
    }

    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const productCategories = Array.from(
      new Set(
        quoteLines
          .map((line) => {
            const product = products.find((p) => p.id === line.product_id);
            return product?.category;
          })
          .filter(Boolean)
      )
    );

    if (productCategories.length === 0) {
      return { score: null, details: null };
    }

    const { data: historicalQuotes, error } = await supabase
      .from('quote_lines')
      .select(
        `
        unit_price,
        discount_applied,
        product_id,
        products!inner(base_cost, category),
        quotes!inner(
          created_at,
          status,
          customers!inner(
            industry_id,
            region_id
          )
        )
      `
      )
      .in('quotes.status', ['Approved'])
      .gte('quotes.created_at', twelveMonthsAgo.toISOString())
      .in('products.category', productCategories);

    if (error) {
      console.error('Error fetching historical quotes:', error);
      return { score: null, details: null };
    }

    if (!historicalQuotes || historicalQuotes.length < 5) {
      return { score: null, details: null };
    }

    const industryDeals: HistoricalDealData[] = [];
    const regionDeals: HistoricalDealData[] = [];

    historicalQuotes.forEach((line: any) => {
      const effectivePrice =
        line.unit_price * (1 - line.discount_applied / 100);
      const baseCost = line.products.base_cost;
      const marginPercent =
        baseCost > 0 ? ((effectivePrice - baseCost) / effectivePrice) * 100 : 0;

      const dealData: HistoricalDealData = {
        margin_percent: marginPercent,
        discount_percent: line.discount_applied,
        product_category: line.products.category,
      };

      if (line.quotes.customers.industry_id === customer.industry_id) {
        industryDeals.push(dealData);
      }
      if (line.quotes.customers.region_id === customer.region_id) {
        regionDeals.push(dealData);
      }
    });

    if (industryDeals.length < 3 && regionDeals.length < 3) {
      return { score: null, details: null };
    }

    const industryAvgMargin =
      industryDeals.length > 0
        ? industryDeals.reduce((sum, d) => sum + d.margin_percent, 0) /
          industryDeals.length
        : 0;

    const industryAvgDiscount =
      industryDeals.length > 0
        ? industryDeals.reduce((sum, d) => sum + d.discount_percent, 0) /
          industryDeals.length
        : 0;

    const regionAvgMargin =
      regionDeals.length > 0
        ? regionDeals.reduce((sum, d) => sum + d.margin_percent, 0) /
          regionDeals.length
        : 0;

    const regionAvgDiscount =
      regionDeals.length > 0
        ? regionDeals.reduce((sum, d) => sum + d.discount_percent, 0) /
          regionDeals.length
        : 0;

    const currentMargins: number[] = [];
    const currentDiscounts: number[] = [];

    quoteLines.forEach((line) => {
      const product = products.find((p) => p.id === line.product_id);
      if (product && line.unit_price && line.discount_applied !== undefined) {
        const effectivePrice =
          line.unit_price * (1 - line.discount_applied / 100);
        const marginPercent =
          product.base_cost > 0
            ? ((effectivePrice - product.base_cost) / effectivePrice) * 100
            : 0;
        currentMargins.push(marginPercent);
        currentDiscounts.push(line.discount_applied);
      }
    });

    if (currentMargins.length === 0) {
      return { score: null, details: null };
    }

    const currentAvgMargin =
      currentMargins.reduce((sum, m) => sum + m, 0) / currentMargins.length;
    const currentAvgDiscount =
      currentDiscounts.reduce((sum, d) => sum + d, 0) / currentDiscounts.length;

    const baselineMargin =
      industryDeals.length > 0 && regionDeals.length > 0
        ? (industryAvgMargin + regionAvgMargin) / 2
        : industryDeals.length > 0
        ? industryAvgMargin
        : regionAvgMargin;

    const baselineDiscount =
      industryDeals.length > 0 && regionDeals.length > 0
        ? (industryAvgDiscount + regionAvgDiscount) / 2
        : industryDeals.length > 0
        ? industryAvgDiscount
        : regionAvgDiscount;

    const marginDelta =
      baselineMargin > 0
        ? ((currentAvgMargin - baselineMargin) / baselineMargin) * 100
        : 0;

    const discountDelta =
      baselineDiscount > 0
        ? ((baselineDiscount - currentAvgDiscount) / baselineDiscount) * 100
        : 0;

    const marginScore = 100 + marginDelta;
    const discountScore = 100 + discountDelta;

    const dealScore = (marginScore + discountScore) / 2;

    const allDeals = [...new Set([...industryDeals, ...regionDeals])];
    const allMargins = allDeals.map((d) => d.margin_percent);
    const sortedMargins = [...allMargins].sort((a, b) => a - b);
    const belowCount = sortedMargins.filter((m) => m < currentAvgMargin).length;
    const percentile =
      sortedMargins.length > 0 ? (belowCount / sortedMargins.length) * 100 : 50;

    const details: DealScoreDetails = {
      industry_avg_margin: industryAvgMargin,
      region_avg_margin: regionAvgMargin,
      industry_avg_discount: industryAvgDiscount,
      region_avg_discount: regionAvgDiscount,
      current_avg_margin: currentAvgMargin,
      current_avg_discount: currentAvgDiscount,
      comparable_deals_count: allDeals.length,
      percentile: percentile,
      score_factors: {
        margin_score: marginScore,
        discount_score: discountScore,
      },
    };

    return {
      score: Math.round(dealScore * 100) / 100,
      details,
    };
  } catch (error) {
    console.error('Error calculating deal score:', error);
    return { score: null, details: null };
  }
}

export function getDealScoreColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'gray';
  if (score >= 110) return 'green';
  if (score >= 90) return 'yellow';
  return 'red';
}

export function getDealScoreLabel(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'Not Scored';
  if (score >= 110) return 'Excellent';
  if (score >= 90) return 'Good';
  return 'Needs Attention';
}

export function getDealScoreBgColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'bg-gray-100 text-gray-800';
  if (score >= 110) return 'bg-green-100 text-green-800';
  if (score >= 90) return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800';
}
