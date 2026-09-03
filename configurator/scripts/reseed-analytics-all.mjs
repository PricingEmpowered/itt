/**
 * Comprehensive re-seed of ALL analytics tables using the 20 real analytics families
 * derived from the live products table.
 *
 * Tables updated:
 *  - analytics_snapshots      (KPIs per period × family × region × channel)
 *  - analytics_margin_bridge  (waterfall components per period × family)
 *  - analytics_price_waterfall (price waterfall per period × family × region × channel × segment)
 *
 * analytics_products was already re-seeded by reseed-analytics-products.mjs
 */

import mysql from 'mysql2/promise';

const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const randInt = (lo, hi) => Math.floor(rand(lo, hi + 1));
const round2 = (n) => Math.round(n * 100) / 100;
const round4 = (n) => Math.round(n * 10000) / 10000;

// All 20 analytics families (matching analyticsConstants.ts and analytics_products)
const FAMILIES = [
  'All',
  '38999/KJB', 'KPT', 'CIR/FRCIR', 'CA Bayonet', 'MS Series',
  'MKJ Trinity', 'VBN/VS/VPT', 'D-Sub/DPX', 'Rack & Panel',
  'Micro', 'Trident', 'Transportation', 'Hermetics', 'Filters',
  'DL', 'HDx', 'RF', 'EV', 'Fiber Optics', 'Circular Other',
];

// Revenue scale per family (relative weight)
const FAMILY_SCALE = {
  'All': 1.0,
  'MKJ Trinity': 0.22, 'CIR/FRCIR': 0.14, 'CA Bayonet': 0.12,
  '38999/KJB': 0.08, 'KPT': 0.07, 'MS Series': 0.06,
  'Micro': 0.08, 'D-Sub/DPX': 0.05, 'Rack & Panel': 0.03,
  'VBN/VS/VPT': 0.02, 'Trident': 0.02, 'Transportation': 0.02,
  'Hermetics': 0.02, 'Filters': 0.01, 'DL': 0.01,
  'HDx': 0.01, 'RF': 0.01, 'EV': 0.005, 'Fiber Optics': 0.005,
  'Circular Other': 0.03,
};

const REGIONS = ['All', 'NA', 'EMEA', 'APAC'];
const CHANNELS = ['All', 'Direct Sales', 'Distribution', 'Partner', 'E-Commerce', 'OEM', 'System Integrator'];
const SEGMENTS = ['All', 'Aerospace', 'Automotive', 'Industrial', 'Energy', 'Medical', 'Electronics'];

// Generate last 24 periods
function lastNPeriods(n) {
  const periods = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    periods.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return periods.reverse(); // oldest first
}

async function reseedSnapshots(conn) {
  console.log('\n--- Reseeding analytics_snapshots ---');
  await conn.query('DELETE FROM analytics_snapshots');

  const periods = lastNPeriods(24);
  const rows = [];

  for (const period of periods) {
    const [yr, mo] = period.split('-').map(Number);
    const trendFactor = 1 + (periods.indexOf(period) / periods.length) * 0.18;
    const seasonality = 1 + 0.08 * Math.sin((mo - 1) * Math.PI / 6);

    for (const family of FAMILIES) {
      const scale = FAMILY_SCALE[family] || 0.01;
      const baseRevenue = 2_400_000 * trendFactor * seasonality * scale;
      const revenue = round2(baseRevenue * rand(0.88, 1.12));
      const priceIndex = round2(rand(95, 115));
      const costIndex = round2(rand(92, 108));
      const valueGapPct = round2(priceIndex - costIndex + rand(-3, 3));
      const activeQuotes = randInt(
        family === 'All' ? 800 : Math.ceil(scale * 300),
        family === 'All' ? 1400 : Math.ceil(scale * 600)
      );
      const winRate = round2(rand(38, 68));
      const activeCustomers = randInt(
        family === 'All' ? 180 : Math.ceil(scale * 80),
        family === 'All' ? 320 : Math.ceil(scale * 180)
      );

      rows.push([period, family, 'All', 'All', revenue, activeQuotes, winRate, activeCustomers, priceIndex, costIndex, valueGapPct]);
    }
  }

  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    await conn.query(
      `INSERT INTO analytics_snapshots (period, productFamily, region, channel, revenue, activeQuotes, winRate, activeCustomers, priceIndex, costIndex, valueGapPct) VALUES ?`,
      [rows.slice(i, i + BATCH)]
    );
  }
  console.log(`  Inserted ${rows.length} rows`);
}

async function reseedMarginBridge(conn) {
  console.log('\n--- Reseeding analytics_margin_bridge ---');
  await conn.query('DELETE FROM analytics_margin_bridge');

  const periods = lastNPeriods(24);
  const components = [
    { name: 'Last Year YTD', sortOrder: 0 },
    { name: 'Price',         sortOrder: 1 },
    { name: 'Cost',          sortOrder: 2 },
    { name: 'Volume',        sortOrder: 3 },
    { name: 'New Business',  sortOrder: 4 },
    { name: 'Lost Business', sortOrder: 5 },
    { name: 'This Year YTD', sortOrder: 6 },
  ];

  const rows = [];
  for (const period of periods) {
    for (const family of FAMILIES) {
      const scale = FAMILY_SCALE[family] || 0.01;
      const base = 480_000 * scale;
      const values = [
        round2(base * rand(0.90, 1.05)),       // Last Year YTD
        round2(base * rand(0.02, 0.08)),        // Price (positive)
        round2(base * rand(-0.06, -0.01)),      // Cost (negative)
        round2(base * rand(-0.03, 0.05)),       // Volume
        round2(base * rand(0.01, 0.06)),        // New Business
        round2(base * rand(-0.04, -0.01)),      // Lost Business
        0,                                       // This Year YTD (computed)
      ];
      // Compute This Year YTD as sum of all others
      values[6] = round2(values[0] + values[1] + values[2] + values[3] + values[4] + values[5]);

      components.forEach((comp, idx) => {
        rows.push([period, family, 'All', 'All', comp.name, values[idx], comp.sortOrder]);
      });
    }
  }

  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    await conn.query(
      `INSERT INTO analytics_margin_bridge (period, productFamily, region, channel, component, value, sortOrder) VALUES ?`,
      [rows.slice(i, i + BATCH)]
    );
  }
  console.log(`  Inserted ${rows.length} rows`);
}

async function reseedPriceWaterfall(conn) {
  console.log('\n--- Reseeding analytics_price_waterfall ---');
  await conn.query('DELETE FROM analytics_price_waterfall');

  const periods = lastNPeriods(24);
  const components = [
    { name: 'List Price',           sortOrder: 0, isTotal: true },
    { name: 'Trade Discount',       sortOrder: 1, isTotal: false },
    { name: 'Invoice Price',        sortOrder: 2, isTotal: true },
    { name: 'Cash Discount',        sortOrder: 3, isTotal: false },
    { name: 'Freight',              sortOrder: 4, isTotal: false },
    { name: 'Special Allowances',   sortOrder: 5, isTotal: false },
    { name: 'Net Price',            sortOrder: 6, isTotal: true },
    { name: 'Rebates',              sortOrder: 7, isTotal: false },
    { name: 'Pocket Price',         sortOrder: 8, isTotal: true },
  ];

  const rows = [];
  for (const period of periods) {
    for (const family of FAMILIES) {
      const scale = FAMILY_SCALE[family] || 0.01;
      const listPrice = round2(1_050_000 * scale * rand(0.9, 1.1));
      const tradeDiscount = round2(listPrice * rand(0.08, 0.18));
      const invoicePrice = round2(listPrice - tradeDiscount);
      const cashDiscount = round2(invoicePrice * rand(0.01, 0.04));
      const freight = round2(invoicePrice * rand(0.005, 0.02));
      const specialAllowances = round2(invoicePrice * rand(0.01, 0.05));
      const netPrice = round2(invoicePrice - cashDiscount - freight - specialAllowances);
      const rebates = round2(netPrice * rand(0.01, 0.04));
      const pocketPrice = round2(netPrice - rebates);

      const values = [listPrice, -tradeDiscount, invoicePrice, -cashDiscount, -freight, -specialAllowances, netPrice, -rebates, pocketPrice];

      components.forEach((comp, idx) => {
        rows.push([period, family, 'All', 'All', 'All', comp.name, values[idx], comp.sortOrder, comp.isTotal ? 1 : 0]);
      });
    }
  }

  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    await conn.query(
      `INSERT INTO analytics_price_waterfall (period, productFamily, region, channel, segment, component, value, sortOrder, isTotal) VALUES ?`,
      [rows.slice(i, i + BATCH)]
    );
  }
  console.log(`  Inserted ${rows.length} rows`);
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  await reseedSnapshots(conn);
  await reseedMarginBridge(conn);
  await reseedPriceWaterfall(conn);

  // Verify
  console.log('\n=== Verification ===');
  for (const table of ['analytics_snapshots', 'analytics_margin_bridge', 'analytics_price_waterfall']) {
    const [[{ cnt }]] = await conn.query(`SELECT COUNT(*) as cnt FROM ${table}`);
    const [families] = await conn.query(`SELECT DISTINCT productFamily FROM ${table} ORDER BY productFamily`);
    console.log(`\n${table}: ${cnt} rows, ${families.length} families`);
    families.forEach(f => process.stdout.write(`  ${f.productFamily}\n`));
  }

  await conn.end();
  console.log('\nDone!');
}

main().catch(err => { console.error(err); process.exit(1); });
