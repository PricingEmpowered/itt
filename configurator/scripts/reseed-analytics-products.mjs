/**
 * Re-seed analytics_products using REAL part numbers from the live products table.
 *
 * Mapping from products.family / products.series / products.line → analytics productFamily:
 *
 *  Circular family:
 *    38999           → "38999/KJB"
 *    KPT             → "KPT"
 *    CIR             → "CIR/FRCIR"
 *    FRCIR           → "CIR/FRCIR"
 *    CA              → "CA Bayonet"
 *    MS              → "MS Series"
 *    MKJ             → "MKJ Trinity"
 *    VBN / VS / VPT  → "VBN/VS/VPT"
 *    Circular (generic, Plastic Push Pull, PV/CV/KPD, Powerlock, AD, Audio, Nemesis) → "Circular Other"
 *  D Sub series:
 *    DBM / DPX       → "D-Sub/DPX"
 *  Rack & Panel series:
 *    DPX             → "D-Sub/DPX"
 *    BKAD / TKJ      → "Rack & Panel"
 *  Micro series       → "Micro"
 *  Trident series     → "Trident"
 *  Transportation     → "Transportation"
 *  Hermetics          → "Hermetics"
 *  Filters            → "Filters"
 *  DL                 → "DL"
 *  HDx                → "HDx"
 *  RF                 → "RF"
 *  EV                 → "EV"
 *  Fiber Optics       → "Fiber Optics"
 *  Tools / Commercial Wireless / other → skip (too small for analytics)
 *
 * We pull a representative sample of real part numbers per analytics family,
 * then generate synthetic-but-realistic margin/sales/discount data for each.
 */

import mysql from 'mysql2/promise';

const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const randInt = (lo, hi) => Math.floor(rand(lo, hi + 1));
const round2 = (n) => Math.round(n * 100) / 100;

// Map from products.family → analytics productFamily label
const FAMILY_MAP = {
  '38999':         '38999/KJB',
  'KPT':           'KPT',
  'CIR':           'CIR/FRCIR',
  'FRCIR':         'CIR/FRCIR',
  'CA':            'CA Bayonet',
  'MS':            'MS Series',
  'MKJ':           'MKJ Trinity',
  'VBN':           'VBN/VS/VPT',
  'VS':            'VBN/VS/VPT',
  'VPT':           'VBN/VS/VPT',
  'DBM':           'D-Sub/DPX',
  'DPX':           'D-Sub/DPX',
  'BKAD':          'Rack & Panel',
  'TKJ':           'Rack & Panel',
  'Micro':         'Micro',
  'Trident':       'Trident',
  'Transportation':'Transportation',
  'Hermetics':     'Hermetics',
  'Filters':       'Filters',
  'DL':            'DL',
  'HDx':           'HDx',
  'RF':            'RF',
  'EV':            'EV',
  'Fiber Optics':  'Fiber Optics',
  // Generic circular families — map to "Circular Other"
  'Circular':      'Circular Other',
};

// Analytics families that will appear in the UI filter
const ANALYTICS_FAMILIES = [
  '38999/KJB', 'KPT', 'CIR/FRCIR', 'CA Bayonet', 'MS Series',
  'MKJ Trinity', 'VBN/VS/VPT', 'D-Sub/DPX', 'Rack & Panel',
  'Micro', 'Trident', 'Transportation', 'Hermetics', 'Filters',
  'DL', 'HDx', 'RF', 'EV', 'Fiber Optics', 'Circular Other',
];

// Per-family realistic margin and discount profiles
const FAMILY_PROFILES = {
  '38999/KJB':     { marginLo: 38, marginHi: 62, discLo: 2,  discHi: 18, salesLo: 80000,  salesHi: 420000 },
  'KPT':           { marginLo: 35, marginHi: 58, discLo: 3,  discHi: 20, salesLo: 60000,  salesHi: 350000 },
  'CIR/FRCIR':     { marginLo: 30, marginHi: 55, discLo: 4,  discHi: 22, salesLo: 50000,  salesHi: 300000 },
  'CA Bayonet':    { marginLo: 32, marginHi: 56, discLo: 3,  discHi: 21, salesLo: 55000,  salesHi: 320000 },
  'MS Series':     { marginLo: 28, marginHi: 52, discLo: 5,  discHi: 25, salesLo: 45000,  salesHi: 280000 },
  'MKJ Trinity':   { marginLo: 40, marginHi: 65, discLo: 2,  discHi: 15, salesLo: 90000,  salesHi: 480000 },
  'VBN/VS/VPT':    { marginLo: 25, marginHi: 48, discLo: 5,  discHi: 28, salesLo: 30000,  salesHi: 200000 },
  'D-Sub/DPX':     { marginLo: 22, marginHi: 45, discLo: 8,  discHi: 32, salesLo: 20000,  salesHi: 180000 },
  'Rack & Panel':  { marginLo: 30, marginHi: 52, discLo: 4,  discHi: 22, salesLo: 40000,  salesHi: 250000 },
  'Micro':         { marginLo: 42, marginHi: 68, discLo: 2,  discHi: 14, salesLo: 100000, salesHi: 550000 },
  'Trident':       { marginLo: 35, marginHi: 58, discLo: 3,  discHi: 18, salesLo: 60000,  salesHi: 380000 },
  'Transportation':{ marginLo: 28, marginHi: 50, discLo: 5,  discHi: 24, salesLo: 35000,  salesHi: 220000 },
  'Hermetics':     { marginLo: 45, marginHi: 70, discLo: 1,  discHi: 12, salesLo: 120000, salesHi: 600000 },
  'Filters':       { marginLo: 38, marginHi: 62, discLo: 2,  discHi: 16, salesLo: 70000,  salesHi: 400000 },
  'DL':            { marginLo: 30, marginHi: 54, discLo: 4,  discHi: 20, salesLo: 40000,  salesHi: 260000 },
  'HDx':           { marginLo: 32, marginHi: 56, discLo: 3,  discHi: 18, salesLo: 50000,  salesHi: 300000 },
  'RF':            { marginLo: 36, marginHi: 60, discLo: 2,  discHi: 16, salesLo: 60000,  salesHi: 350000 },
  'EV':            { marginLo: 28, marginHi: 50, discLo: 5,  discHi: 25, salesLo: 30000,  salesHi: 200000 },
  'Fiber Optics':  { marginLo: 42, marginHi: 66, discLo: 2,  discHi: 14, salesLo: 80000,  salesHi: 450000 },
  'Circular Other':{ marginLo: 20, marginHi: 42, discLo: 8,  discHi: 35, salesLo: 15000,  salesHi: 150000 },
};

function assignParetoCategory(sales, allSales) {
  const sorted = [...allSales].sort((a, b) => b - a);
  const total = sorted.reduce((s, v) => s + v, 0);
  let cum = 0;
  const rank = sorted.indexOf(sales);
  for (let i = 0; i <= rank; i++) cum += sorted[i];
  const pct = cum / total;
  if (pct <= 0.50) return 'A';
  if (pct <= 0.80) return 'B';
  if (pct <= 0.95) return 'C';
  return 'D';
}

function discountType(disc) {
  if (disc <= 5)  return 'list_price';
  if (disc <= 15) return 'standard_discount';
  return 'custom_discount';
}

// Generate last 6 periods (YYYY-MM)
function lastNPeriods(n) {
  const periods = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    periods.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return periods;
}

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  // 1. Pull representative real part numbers per analytics family
  //    We want up to 15 parts per analytics family, sampled from real products
  console.log('Fetching real part numbers from products table...');
  
  const familyParts = {};
  for (const [prodFamily, analyticsFamily] of Object.entries(FAMILY_MAP)) {
    const [rows] = await conn.query(
      `SELECT description as partNumber FROM products WHERE family = ? ORDER BY RAND() LIMIT 15`,
      [prodFamily]
    );
    if (!familyParts[analyticsFamily]) familyParts[analyticsFamily] = new Set();
    rows.forEach(r => familyParts[analyticsFamily].add(r.partNumber));
  }

  // Log what we found
  for (const [fam, parts] of Object.entries(familyParts)) {
    console.log(`  ${fam}: ${parts.size} parts`);
  }

  // 2. Clear existing analytics_products
  console.log('\nClearing old analytics_products...');
  await conn.query('DELETE FROM analytics_products');

  // 3. Generate rows for last 6 periods
  const periods = lastNPeriods(6);
  const rows = [];

  for (const period of periods) {
    for (const [analyticsFamily, partsSet] of Object.entries(familyParts)) {
      const parts = [...partsSet];
      if (parts.length === 0) continue;
      const profile = FAMILY_PROFILES[analyticsFamily] || FAMILY_PROFILES['Circular Other'];

      // Generate sales values first so we can compute Pareto
      const salesValues = parts.map(() => round2(rand(profile.salesLo, profile.salesHi)));

      parts.forEach((pn, idx) => {
        const sales = salesValues[idx];
        const margin = round2(rand(profile.marginLo, profile.marginHi));
        const disc = round2(rand(profile.discLo, profile.discHi));
        const pareto = assignParetoCategory(sales, salesValues);
        const dtype = discountType(disc);

        // Competitive premiums: JSON object with 3 competitors
        const competitivePremiums = JSON.stringify({
          competitor1: round2(rand(-15, 25)),
          competitor2: round2(rand(-10, 30)),
          competitor3: round2(rand(-20, 20)),
        });

        rows.push([pn, analyticsFamily, sales, margin, disc, dtype, competitivePremiums, pareto, period]);
      });
    }
  }

  // 4. Insert in batches of 500
  console.log(`\nInserting ${rows.length} analytics_products rows...`);
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    await conn.query(
      `INSERT INTO analytics_products (partNumber, productFamily, sales, marginAtListPct, avgDiscountPct, discountType, competitivePremiums, paretoCategory, period) VALUES ?`,
      [batch]
    );
    process.stdout.write(`  ${Math.min(i + BATCH, rows.length)}/${rows.length}\r`);
  }

  console.log('\n\nDone! Summary:');
  const [summary] = await conn.query(
    `SELECT productFamily, COUNT(DISTINCT partNumber) as parts, COUNT(DISTINCT period) as periods, COUNT(*) as rows
     FROM analytics_products GROUP BY productFamily ORDER BY rows DESC`
  );
  summary.forEach(r => console.log(`  ${r.productFamily}: ${r.parts} parts × ${r.periods} periods = ${r.rows} rows`));

  await conn.end();
}

main().catch(err => { console.error(err); process.exit(1); });
