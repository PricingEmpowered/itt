import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  supabaseServiceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

const PRODUCT_FAMILIES = [
  'Aerospace & Defense',
  'Automotive Technologies',
  'Industrial Process',
  'Motion Technologies',
  'Connect & Control'
];

const REGIONS = ['NA', 'EMEA', 'APAC'];
const CHANNELS = ['Direct Sales', 'Distribution', 'Partner', 'E-Commerce', 'OEM', 'System Integrator'];
const SEGMENTS = ['Aerospace', 'Automotive', 'Industrial', 'Energy', 'Medical', 'Electronics'];

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomFloat(min: number, max: number, decimals: number = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function getMonthStart(monthsAgo: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() - monthsAgo);
  date.setDate(1);
  return date.toISOString().split('T')[0];
}

function getMonthEnd(monthsAgo: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() - monthsAgo + 1);
  date.setDate(0);
  return date.toISOString().split('T')[0];
}

async function seedBusinessPerformance() {
  console.log('Seeding business performance data...');
  const records = [];

  for (let month = 11; month >= 0; month--) {
    const periodStart = getMonthStart(month);
    const periodEnd = getMonthEnd(month);

    for (const productFamily of [...PRODUCT_FAMILIES, null]) {
      for (const region of [...REGIONS, null]) {
        for (const channel of [...CHANNELS, null]) {
          if (productFamily === null && region === null && channel === null) {
            const baseRevenue = 2000000 + getRandomInt(-200000, 500000);
            const priceIndex = 100 + (11 - month) * 2 + getRandomFloat(-3, 3);
            const costIndex = 100 + (11 - month) * 1.5 + getRandomFloat(-2, 2);

            records.push({
              period_start: periodStart,
              period_end: periodEnd,
              period_type: 'month',
              product_family: productFamily,
              region: region,
              channel: channel,
              revenue: baseRevenue,
              revenue_change_pct: getRandomFloat(-5, 10),
              active_quotes: getRandomInt(220, 270),
              active_quotes_change_pct: getRandomFloat(-3, 5),
              win_rate: getRandomFloat(70, 78),
              win_rate_change_pct: getRandomFloat(-2, 3),
              active_customers: getRandomInt(1200, 1280),
              active_customers_change_pct: getRandomFloat(-2, 2),
              price_index: priceIndex,
              cost_index: costIndex,
              value_gap_pct: parseFloat(((priceIndex - costIndex) / costIndex * 100).toFixed(2)),
              margin_total: baseRevenue * 0.35,
              margin_from_price: getRandomFloat(200000, 400000),
              margin_from_cost: getRandomFloat(-100000, 50000),
              margin_from_volume: getRandomFloat(50000, 150000),
              margin_from_new_business: getRandomFloat(50000, 200000),
              margin_from_lost_business: getRandomFloat(-150000, -50000)
            });
          }
        }
      }
    }
  }

  const { error } = await supabase
    .from('analytics_business_performance')
    .insert(records);

  if (error) {
    console.error('Error seeding business performance:', error);
  } else {
    console.log(`Seeded ${records.length} business performance records`);
  }
}

async function seedPricePerformance() {
  console.log('Seeding price performance data...');

  const { data: products } = await supabase
    .from('products')
    .select('id, name, part_number')
    .limit(50);

  if (!products) {
    console.error('No products found');
    return;
  }

  const records = [];
  const periodStart = getMonthStart(0);
  const periodEnd = getMonthEnd(0);

  let cumulativePct = 0;
  const sortedProducts = products.map((product, idx) => {
    const sales = getRandomFloat(50000, 1000000);
    return { product, sales, idx };
  }).sort((a, b) => b.sales - a.sales);

  const totalSales = sortedProducts.reduce((sum, item) => sum + item.sales, 0);

  sortedProducts.forEach((item, idx) => {
    const salesPct = (item.sales / totalSales) * 100;
    cumulativePct += salesPct;

    let paretoCategory = 'D';
    if (cumulativePct <= 68) paretoCategory = 'A';
    else if (cumulativePct <= 89) paretoCategory = 'B';
    else if (cumulativePct <= 96.5) paretoCategory = 'C';

    const productFamily = PRODUCT_FAMILIES[idx % PRODUCT_FAMILIES.length];

    records.push({
      period_start: periodStart,
      period_end: periodEnd,
      product_id: item.product.id,
      product_family: productFamily,
      product_category: `Category ${String.fromCharCode(65 + (idx % 5))}`,
      part_number: item.product.part_number,
      sales: item.sales,
      margin_at_list_pct: getRandomFloat(20, 75),
      price_premium_vs_comp_a: getRandomFloat(-15, 18),
      price_premium_vs_comp_b: getRandomFloat(-12, 15),
      price_premium_vs_comp_c: getRandomFloat(-10, 20),
      price_premium_vs_comp_d: getRandomFloat(-18, 12),
      pareto_category: paretoCategory,
      pareto_cumulative_pct: parseFloat(cumulativePct.toFixed(2)),
      average_discount_pct: getRandomFloat(5, 30),
      discount_type: ['list_price', 'standard', 'custom'][getRandomInt(0, 2)],
      discount_type_sales_pct: getRandomFloat(20, 60)
    });
  });

  const { error } = await supabase
    .from('analytics_price_performance')
    .insert(records);

  if (error) {
    console.error('Error seeding price performance:', error);
  } else {
    console.log(`Seeded ${records.length} price performance records`);
  }
}

async function seedQuoteFunnel() {
  console.log('Seeding quote funnel data...');
  const records = [];

  for (let month = 5; month >= 0; month--) {
    const periodStart = getMonthStart(month);
    const periodEnd = getMonthEnd(month);

    for (const region of [...REGIONS, null]) {
      for (const channel of [...CHANNELS, null]) {
        for (const segment of [...SEGMENTS, null]) {
          for (const businessType of ['new', 'repeat']) {
            const stages = ['technical_review', 'negotiation', 'won', 'lost'];

            const baseCount = businessType === 'new' ? getRandomInt(40, 80) : getRandomInt(70, 120);
            const baseValue = businessType === 'new' ? getRandomFloat(600000, 1200000) : getRandomFloat(1200000, 2500000);

            let remainingCount = baseCount;
            let remainingValue = baseValue;

            stages.forEach((stage, idx) => {
              let quoteCount = 0;
              let quoteValue = 0;

              if (stage === 'technical_review') {
                quoteCount = remainingCount;
                quoteValue = remainingValue;
              } else if (stage === 'negotiation') {
                quoteCount = Math.floor(remainingCount * 0.7);
                quoteValue = remainingValue * 0.7;
              } else if (stage === 'won') {
                quoteCount = Math.floor(remainingCount * (businessType === 'new' ? 0.28 : 0.42));
                quoteValue = remainingValue * (businessType === 'new' ? 0.28 : 0.42);
              } else {
                quoteCount = Math.floor(remainingCount * (businessType === 'new' ? 0.42 : 0.28));
                quoteValue = remainingValue * (businessType === 'new' ? 0.42 : 0.28);
              }

              remainingCount -= quoteCount;
              remainingValue -= quoteValue;

              if (region === null && channel === null && segment === null) {
                records.push({
                  period_start: periodStart,
                  period_end: periodEnd,
                  period_type: 'month',
                  region: region,
                  channel: channel,
                  segment: segment,
                  business_type: businessType,
                  stage: stage,
                  quote_count: quoteCount,
                  quote_value: quoteValue,
                  average_value: quoteCount > 0 ? quoteValue / quoteCount : 0,
                  win_rate: businessType === 'new' ? getRandomFloat(26, 30) : getRandomFloat(40, 44),
                  average_cycle_time_days: businessType === 'new' ? getRandomInt(42, 48) : getRandomInt(29, 35),
                  conversion_rate: businessType === 'new' ? getRandomFloat(26, 30) : getRandomFloat(40, 44)
                });
              }
            });
          }
        }
      }
    }
  }

  const { error } = await supabase
    .from('analytics_quote_funnel')
    .insert(records);

  if (error) {
    console.error('Error seeding quote funnel:', error);
  } else {
    console.log(`Seeded ${records.length} quote funnel records`);
  }
}

async function seedPriceWaterfall() {
  console.log('Seeding price waterfall data...');
  const records = [];

  const periodStart = getMonthStart(0);
  const periodEnd = getMonthEnd(0);

  for (const productFamily of [...PRODUCT_FAMILIES, null]) {
    for (const region of [...REGIONS, null]) {
      for (const channel of [...CHANNELS, null]) {
        for (const segment of [...SEGMENTS, null]) {
          if (productFamily === null && region === null && channel === null && segment === null) {
            const listPrice = 1000000;
            const volumeDiscount = listPrice * getRandomFloat(0.05, 0.08);
            const contractDiscount = listPrice * getRandomFloat(0.03, 0.06);
            const promotionalDiscount = listPrice * getRandomFloat(0.01, 0.03);
            const invoicePrice = listPrice - volumeDiscount - contractDiscount - promotionalDiscount;
            const rebates = invoicePrice * getRandomFloat(0.02, 0.04);
            const paymentTerms = invoicePrice * getRandomFloat(0.01, 0.02);
            const freight = invoicePrice * getRandomFloat(0.02, 0.03);
            const pocketPrice = invoicePrice - rebates - paymentTerms - freight;

            records.push({
              period_start: periodStart,
              period_end: periodEnd,
              product_family: productFamily,
              region: region,
              channel: channel,
              segment: segment,
              list_price: parseFloat(listPrice.toFixed(2)),
              volume_discount: parseFloat(volumeDiscount.toFixed(2)),
              contract_discount: parseFloat(contractDiscount.toFixed(2)),
              promotional_discount: parseFloat(promotionalDiscount.toFixed(2)),
              invoice_price: parseFloat(invoicePrice.toFixed(2)),
              rebates: parseFloat(rebates.toFixed(2)),
              payment_terms: parseFloat(paymentTerms.toFixed(2)),
              freight: parseFloat(freight.toFixed(2)),
              pocket_price: parseFloat(pocketPrice.toFixed(2))
            });
          }
        }
      }
    }
  }

  const { error } = await supabase
    .from('analytics_price_waterfall')
    .insert(records);

  if (error) {
    console.error('Error seeding price waterfall:', error);
  } else {
    console.log(`Seeded ${records.length} price waterfall records`);
  }
}

async function main() {
  console.log('Starting analytics data seeding...\n');

  await seedBusinessPerformance();
  await seedPricePerformance();
  await seedQuoteFunnel();
  await seedPriceWaterfall();

  console.log('\nAnalytics data seeding complete!');
}

main().catch(console.error);
