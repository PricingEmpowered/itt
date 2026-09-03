import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing environment variables!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface Product {
  id: string;
  base_cost: number;
  category: string;
}

async function calculateDealScoreForQuote(
  quoteId: string,
  quoteLines: any[],
  products: Product[],
  customerIndustryId: string | null,
  customerRegionId: string | null
) {
  if (!customerIndustryId || !customerRegionId || quoteLines.length === 0) {
    return null;
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
    return null;
  }

  const { data: historicalQuotes } = await supabase
    .from('quote_lines')
    .select(
      `
      unit_price,
      discount_applied,
      product_id,
      products!inner(base_cost, category),
      quotes!inner(
        id,
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
    .in('products.category', productCategories)
    .neq('quotes.id', quoteId);

  if (!historicalQuotes || historicalQuotes.length < 5) {
    return null;
  }

  const industryDeals: any[] = [];
  const regionDeals: any[] = [];

  historicalQuotes.forEach((line: any) => {
    const effectivePrice = line.unit_price * (1 - line.discount_applied / 100);
    const baseCost = line.products.base_cost;
    const marginPercent =
      baseCost > 0 ? ((effectivePrice - baseCost) / effectivePrice) * 100 : 0;

    const dealData = {
      margin_percent: marginPercent,
      discount_percent: line.discount_applied,
      product_category: line.products.category,
    };

    if (line.quotes.customers.industry_id === customerIndustryId) {
      industryDeals.push(dealData);
    }
    if (line.quotes.customers.region_id === customerRegionId) {
      regionDeals.push(dealData);
    }
  });

  if (industryDeals.length < 3 && regionDeals.length < 3) {
    return null;
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
      const effectivePrice = line.unit_price * (1 - line.discount_applied / 100);
      const marginPercent =
        product.base_cost > 0
          ? ((effectivePrice - product.base_cost) / effectivePrice) * 100
          : 0;
      currentMargins.push(marginPercent);
      currentDiscounts.push(line.discount_applied);
    }
  });

  if (currentMargins.length === 0) {
    return null;
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

  const details = {
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
}

async function seedDealScores() {
  console.log('Starting deal score seeding...\n');

  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      console.log('No authenticated user. Attempting to sign in...');
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: 'test@itt.com',
        password: 'testpass123',
      });

      if (signInError) {
        console.error('Error signing in:', signInError);
        return;
      }
    }

    const { data: quotes } = await supabase
      .from('quotes')
      .select(
        `
        *,
        customers(industry_id, region_id),
        quote_lines(*)
      `
      )
      .order('created_at', { ascending: false });

    if (!quotes || quotes.length === 0) {
      console.log('No quotes found to score.');
      return;
    }

    const { data: products } = await supabase
      .from('products')
      .select('id, base_cost, category');

    if (!products) {
      console.log('No products found.');
      return;
    }

    console.log(`Found ${quotes.length} quotes to process...`);

    let scored = 0;
    let skipped = 0;

    for (const quote of quotes) {
      if (!quote.customers || !quote.quote_lines || quote.quote_lines.length === 0) {
        skipped++;
        continue;
      }

      const scoreResult = await calculateDealScoreForQuote(
        quote.id,
        quote.quote_lines,
        products,
        quote.customers.industry_id,
        quote.customers.region_id
      );

      if (scoreResult) {
        const { error } = await supabase
          .from('quotes')
          .update({
            deal_score: scoreResult.score,
            deal_score_details: scoreResult.details,
            deal_score_calculated_at: new Date().toISOString(),
          })
          .eq('id', quote.id);

        if (error) {
          console.error(`Error updating quote ${quote.id}:`, error);
        } else {
          scored++;
          console.log(
            `✓ Quote ${quote.id}: Score ${scoreResult.score.toFixed(1)} (${
              scoreResult.details.comparable_deals_count
            } comparable deals)`
          );
        }
      } else {
        skipped++;
      }
    }

    console.log('\n✅ Deal score seeding completed!');
    console.log(`Summary:`);
    console.log(`- ${scored} quotes scored`);
    console.log(`- ${skipped} quotes skipped (insufficient data)`);
  } catch (error) {
    console.error('\n❌ Error during seeding:', error);
  }
}

seedDealScores();
