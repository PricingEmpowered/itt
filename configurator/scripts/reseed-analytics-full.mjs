/**
 * FULL analytics reseed — covers EVERY filter combination so no filter returns empty.
 *
 * Coverage matrix:
 *  analytics_snapshots:      24 periods × 21 families × 4 regions × 7 channels = 14,112 rows
 *  analytics_margin_bridge:  24 periods × 21 families × 7 components = 3,528 rows (All only — bridge is family-level)
 *  analytics_products:       24 periods × 20 families × 15 parts = 7,200 rows
 *  analytics_quote_funnel:   24 periods × 4 regions × 7 channels × 7 segments × 3 stages = 14,112 rows
 *  analytics_price_waterfall:24 periods × 21 families × 4 regions × 7 channels × 7 segments × 9 components = 296,352 rows
 *                             (too large — use All for region/channel/segment, per-family only)
 *                             24 periods × 21 families × 9 components = 4,536 rows (family-level)
 *                           + 24 periods × 1 family(All) × 4 regions × 7 channels × 7 segments × 9 components = 42,336 rows
 *                             Total waterfall: ~47,000 rows
 *
 * Strategy for large tables: seed All×All×All for every family, then seed All-family for every region/channel/segment combo.
 * This means: filtering by family OR by region/channel/segment always returns data. Filtering by family+region together
 * falls back gracefully (the UI should show All-family data for region filters, which is the correct demo behavior).
 *
 * For snapshots: seed ALL combinations — 14k rows is fine for TiDB.
 */

import mysql from 'mysql2/promise';

const rand  = (lo, hi) => lo + Math.random() * (hi - lo);
const randInt = (lo, hi) => Math.floor(rand(lo, hi + 1));
const round2  = (n) => Math.round(n * 100) / 100;

// ─── Dimensions ───────────────────────────────────────────────────────────────
const FAMILIES = [
  'All', '38999/KJB', 'KPT', 'CIR/FRCIR', 'CA Bayonet', 'MS Series',
  'MKJ Trinity', 'VBN/VS/VPT', 'D-Sub/DPX', 'Rack & Panel',
  'Micro', 'Trident', 'Transportation', 'Hermetics', 'Filters',
  'DL', 'HDx', 'RF', 'EV', 'Fiber Optics', 'Circular Other',
];
const FAMILIES_NO_ALL = FAMILIES.filter(f => f !== 'All');

const REGIONS   = ['All', 'NA', 'EMEA', 'APAC'];
const CHANNELS  = ['All', 'Direct Sales', 'Distribution', 'Partner', 'E-Commerce', 'OEM', 'System Integrator'];
const SEGMENTS  = ['All', 'Aerospace', 'Automotive', 'Industrial', 'Energy', 'Medical', 'Electronics'];

// Revenue weight per family
const FAMILY_SCALE = {
  'All': 1.0,
  'MKJ Trinity': 0.22, 'CIR/FRCIR': 0.14, 'CA Bayonet': 0.12,
  '38999/KJB': 0.08, 'KPT': 0.07, 'MS Series': 0.06,
  'Micro': 0.08, 'D-Sub/DPX': 0.05, 'Rack & Panel': 0.03,
  'VBN/VS/VPT': 0.02, 'Trident': 0.02, 'Transportation': 0.02,
  'Hermetics': 0.025, 'Filters': 0.015, 'DL': 0.01,
  'HDx': 0.01, 'RF': 0.01, 'EV': 0.008, 'Fiber Optics': 0.007,
  'Circular Other': 0.03,
};

// Region revenue split (must sum to 1)
const REGION_SPLIT = { All: 1.0, NA: 0.52, EMEA: 0.30, APAC: 0.18 };
// Channel revenue split (must sum to 1)
const CHANNEL_SPLIT = {
  All: 1.0, 'Direct Sales': 0.35, Distribution: 0.28, Partner: 0.14,
  'E-Commerce': 0.08, OEM: 0.09, 'System Integrator': 0.06,
};
// Segment split for quote funnel
const SEGMENT_SPLIT = {
  All: 1.0, Aerospace: 0.28, Automotive: 0.18, Industrial: 0.22,
  Energy: 0.12, Medical: 0.10, Electronics: 0.10,
};

// ─── Period helpers ────────────────────────────────────────────────────────────
function lastNPeriods(n) {
  const periods = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    periods.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return periods; // oldest first
}

function periodIndex(period, allPeriods) {
  return allPeriods.indexOf(period);
}

// ─── Batch insert helper ───────────────────────────────────────────────────────
async function batchInsert(conn, table, columns, rows, batchSize = 2000) {
  if (rows.length === 0) return;
  const placeholders = `(${columns.map(() => '?').join(',')})`;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const flat = batch.flat();
    const sql = `INSERT INTO ${table} (${columns.join(',')}) VALUES ${batch.map(() => placeholders).join(',')}`;
    await conn.query(sql, flat);
    process.stdout.write(`  ${table}: ${Math.min(i + batchSize, rows.length)}/${rows.length}\r`);
  }
  console.log(`  ${table}: ${rows.length} rows inserted`);
}

// ─── 1. analytics_snapshots ───────────────────────────────────────────────────
async function seedSnapshots(conn, periods) {
  console.log('\n[1/5] Seeding analytics_snapshots...');
  await conn.query('DELETE FROM analytics_snapshots');

  const rows = [];
  periods.forEach((period, pidx) => {
    const trendFactor = 1 + (pidx / periods.length) * 0.20;
    const [, mo] = period.split('-').map(Number);
    const seasonality = 1 + 0.09 * Math.sin((mo - 1) * Math.PI / 6);

    FAMILIES.forEach(family => {
      REGIONS.forEach(region => {
        CHANNELS.forEach(channel => {
          const familyScale  = FAMILY_SCALE[family]  || 0.01;
          const regionSplit  = REGION_SPLIT[region]  || 0.1;
          const channelSplit = CHANNEL_SPLIT[channel] || 0.1;

          // For "All" dimensions, don't double-count — use full scale
          const effectiveScale = family === 'All'
            ? (region === 'All' ? (channel === 'All' ? 1.0 : channelSplit) : (channel === 'All' ? regionSplit : regionSplit * channelSplit))
            : (region === 'All' ? (channel === 'All' ? familyScale : familyScale * channelSplit) : (channel === 'All' ? familyScale * regionSplit : familyScale * regionSplit * channelSplit));

          const baseRevenue = 2_400_000 * trendFactor * seasonality * effectiveScale;
          const revenue = round2(baseRevenue * rand(0.88, 1.12));
          const priceIndex = round2(rand(94, 116));
          const costIndex  = round2(rand(91, 109));
          const valueGapPct = round2(priceIndex - costIndex + rand(-2, 2));

          const baseQuotes = family === 'All' ? 1100 : Math.max(5, Math.ceil(effectiveScale * 4000));
          const activeQuotes = randInt(Math.ceil(baseQuotes * 0.8), Math.ceil(baseQuotes * 1.2));
          const winRate = round2(rand(36, 70));
          const baseCustomers = family === 'All' ? 250 : Math.max(3, Math.ceil(effectiveScale * 900));
          const activeCustomers = randInt(Math.ceil(baseCustomers * 0.8), Math.ceil(baseCustomers * 1.2));

          rows.push([period, family, region, channel, revenue, activeQuotes, winRate, activeCustomers, priceIndex, costIndex, valueGapPct]);
        });
      });
    });
  });

  await batchInsert(conn, 'analytics_snapshots',
    ['period','productFamily','region','channel','revenue','activeQuotes','winRate','activeCustomers','priceIndex','costIndex','valueGapPct'],
    rows);
}

// ─── 2. analytics_margin_bridge ───────────────────────────────────────────────
async function seedMarginBridge(conn, periods) {
  console.log('\n[2/5] Seeding analytics_margin_bridge...');
  await conn.query('DELETE FROM analytics_margin_bridge');

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
  periods.forEach(period => {
    FAMILIES.forEach(family => {
      const scale = FAMILY_SCALE[family] || 0.01;
      const base  = 480_000 * scale;
      const lastYr   = round2(base * rand(0.88, 1.05));
      const price    = round2(base * rand(0.02, 0.09));
      const cost     = round2(base * rand(-0.07, -0.01));
      const volume   = round2(base * rand(-0.04, 0.06));
      const newBiz   = round2(base * rand(0.01, 0.07));
      const lostBiz  = round2(base * rand(-0.05, -0.01));
      const thisYr   = round2(lastYr + price + cost + volume + newBiz + lostBiz);
      const vals = [lastYr, price, cost, volume, newBiz, lostBiz, thisYr];
      components.forEach((comp, idx) => {
        rows.push([period, family, 'All', 'All', comp.name, vals[idx], comp.sortOrder]);
      });
    });
  });

  await batchInsert(conn, 'analytics_margin_bridge',
    ['period','productFamily','region','channel','component','value','sortOrder'],
    rows);
}

// ─── 3. analytics_products ────────────────────────────────────────────────────
async function seedProducts(conn, periods) {
  console.log('\n[3/5] Seeding analytics_products...');
  await conn.query('DELETE FROM analytics_products');

  // Pull real part numbers from products table — 15 per family
  const FAMILY_MAP = {
    '38999/KJB': '38999', 'KPT': 'KPT', 'CIR/FRCIR': 'CIR',
    'CA Bayonet': 'CA', 'MS Series': 'MS', 'MKJ Trinity': 'MKJ',
    'VBN/VS/VPT': 'VBN', 'D-Sub/DPX': 'DBM', 'Rack & Panel': 'BKAD',
    'Micro': 'Micro', 'Trident': 'Trident', 'Transportation': 'Transportation',
    'Hermetics': 'Hermetics', 'Filters': 'Filters', 'DL': 'DL',
    'HDx': 'HDx', 'RF': 'RF', 'EV': 'EV', 'Fiber Optics': 'Fiber Optics',
    'Circular Other': 'Circular',
  };

  // Also pull FRCIR parts for CIR/FRCIR
  const EXTRA_MAP = { 'CIR/FRCIR': 'FRCIR', 'VBN/VS/VPT': 'VS', 'D-Sub/DPX': 'DPX' };

  const PROFILES = {
    '38999/KJB':     { mLo: 38, mHi: 62, dLo: 2,  dHi: 18, sLo: 80000,  sHi: 420000 },
    'KPT':           { mLo: 35, mHi: 58, dLo: 3,  dHi: 20, sLo: 60000,  sHi: 350000 },
    'CIR/FRCIR':     { mLo: 30, mHi: 55, dLo: 4,  dHi: 22, sLo: 50000,  sHi: 300000 },
    'CA Bayonet':    { mLo: 32, mHi: 56, dLo: 3,  dHi: 21, sLo: 55000,  sHi: 320000 },
    'MS Series':     { mLo: 28, mHi: 52, dLo: 5,  dHi: 25, sLo: 45000,  sHi: 280000 },
    'MKJ Trinity':   { mLo: 40, mHi: 65, dLo: 2,  dHi: 15, sLo: 90000,  sHi: 480000 },
    'VBN/VS/VPT':    { mLo: 25, mHi: 48, dLo: 5,  dHi: 28, sLo: 30000,  sHi: 200000 },
    'D-Sub/DPX':     { mLo: 22, mHi: 45, dLo: 8,  dHi: 32, sLo: 20000,  sHi: 180000 },
    'Rack & Panel':  { mLo: 30, mHi: 52, dLo: 4,  dHi: 22, sLo: 40000,  sHi: 250000 },
    'Micro':         { mLo: 42, mHi: 68, dLo: 2,  dHi: 14, sLo: 100000, sHi: 550000 },
    'Trident':       { mLo: 35, mHi: 58, dLo: 3,  dHi: 18, sLo: 60000,  sHi: 380000 },
    'Transportation':{ mLo: 28, mHi: 50, dLo: 5,  dHi: 24, sLo: 35000,  sHi: 220000 },
    'Hermetics':     { mLo: 45, mHi: 70, dLo: 1,  dHi: 12, sLo: 120000, sHi: 600000 },
    'Filters':       { mLo: 38, mHi: 62, dLo: 2,  dHi: 16, sLo: 70000,  sHi: 400000 },
    'DL':            { mLo: 30, mHi: 54, dLo: 4,  dHi: 20, sLo: 40000,  sHi: 260000 },
    'HDx':           { mLo: 32, mHi: 56, dLo: 3,  dHi: 18, sLo: 50000,  sHi: 300000 },
    'RF':            { mLo: 36, mHi: 60, dLo: 2,  dHi: 16, sLo: 60000,  sHi: 350000 },
    'EV':            { mLo: 28, mHi: 50, dLo: 5,  dHi: 25, sLo: 30000,  sHi: 200000 },
    'Fiber Optics':  { mLo: 42, mHi: 66, dLo: 2,  dHi: 14, sLo: 80000,  sHi: 450000 },
    'Circular Other':{ mLo: 20, mHi: 42, dLo: 8,  dHi: 35, sLo: 15000,  sHi: 150000 },
  };

  // Fetch real part numbers
  const familyParts = {};
  for (const [analyticsFamily, prodFamily] of Object.entries(FAMILY_MAP)) {
    const [r] = await conn.query('SELECT description as pn FROM products WHERE family = ? ORDER BY RAND() LIMIT 12', [prodFamily]);
    familyParts[analyticsFamily] = new Set(r.map(x => x.pn));
    if (EXTRA_MAP[analyticsFamily]) {
      const [r2] = await conn.query('SELECT description as pn FROM products WHERE family = ? ORDER BY RAND() LIMIT 6', [EXTRA_MAP[analyticsFamily]]);
      r2.forEach(x => familyParts[analyticsFamily].add(x.pn));
    }
  }

  const rows = [];
  periods.forEach(period => {
    FAMILIES_NO_ALL.forEach(analyticsFamily => {
      const parts = [...(familyParts[analyticsFamily] || [])];
      if (parts.length === 0) return;
      const profile = PROFILES[analyticsFamily] || PROFILES['Circular Other'];
      const salesVals = parts.map(() => round2(rand(profile.sLo, profile.sHi)));
      const sorted = [...salesVals].sort((a, b) => b - a);
      const total = sorted.reduce((s, v) => s + v, 0);

      parts.forEach((pn, idx) => {
        const sales   = salesVals[idx];
        const margin  = round2(rand(profile.mLo, profile.mHi));
        const disc    = round2(rand(profile.dLo, profile.dHi));
        // Pareto
        let cum = 0;
        for (let i = 0; i <= sorted.indexOf(sales); i++) cum += sorted[i];
        const pct = cum / total;
        const pareto = pct <= 0.50 ? 'A' : pct <= 0.80 ? 'B' : pct <= 0.95 ? 'C' : 'D';
        const dtype  = disc <= 5 ? 'list_price' : disc <= 15 ? 'standard_discount' : 'custom_discount';
        const compPremiums = JSON.stringify({
          competitor1: round2(rand(-15, 25)),
          competitor2: round2(rand(-10, 30)),
          competitor3: round2(rand(-20, 20)),
        });
        rows.push([pn, analyticsFamily, sales, margin, disc, dtype, compPremiums, pareto, period]);
      });
    });
  });

  await batchInsert(conn, 'analytics_products',
    ['partNumber','productFamily','sales','marginAtListPct','avgDiscountPct','discountType','competitivePremiums','paretoCategory','period'],
    rows);
}

// ─── 4. analytics_quote_funnel ────────────────────────────────────────────────
async function seedQuoteFunnel(conn, periods) {
  console.log('\n[4/5] Seeding analytics_quote_funnel...');
  await conn.query('DELETE FROM analytics_quote_funnel');

  const stages = ['Technical Review', 'Negotiation', 'Won'];
  // Stage conversion rates (Technical Review → Negotiation → Won)
  const STAGE_CONV = { 'Technical Review': 1.0, 'Negotiation': 0.62, 'Won': 0.38 };

  const rows = [];
  periods.forEach((period, pidx) => {
    const trendFactor = 1 + (pidx / periods.length) * 0.15;
    const [, mo] = period.split('-').map(Number);
    const seasonality = 1 + 0.07 * Math.sin((mo - 1) * Math.PI / 6);

    REGIONS.forEach(region => {
      CHANNELS.forEach(channel => {
        SEGMENTS.forEach(segment => {
          const regionSplit  = REGION_SPLIT[region]   || 0.1;
          const channelSplit = CHANNEL_SPLIT[channel]  || 0.1;
          const segmentSplit = SEGMENT_SPLIT[segment]  || 0.1;

          const effectiveScale = (region === 'All' ? 1 : regionSplit)
                               * (channel === 'All' ? 1 : channelSplit)
                               * (segment === 'All' ? 1 : segmentSplit);

          stages.forEach(stage => {
            const conv = STAGE_CONV[stage];
            const baseNew    = Math.ceil(180 * trendFactor * seasonality * effectiveScale * conv);
            const baseRepeat = Math.ceil(120 * trendFactor * seasonality * effectiveScale * conv);
            const newBiz     = randInt(Math.ceil(baseNew * 0.8), Math.ceil(baseNew * 1.2));
            const repeatBiz  = randInt(Math.ceil(baseRepeat * 0.8), Math.ceil(baseRepeat * 1.2));
            const newVal     = round2(newBiz * rand(18000, 45000));
            const repeatVal  = round2(repeatBiz * rand(22000, 55000));
            const cycleTime  = stage === 'Won' ? randInt(28, 65) : randInt(10, 40);
            rows.push([period, region, channel, segment, stage, newBiz, repeatBiz, newVal, repeatVal, cycleTime]);
          });
        });
      });
    });
  });

  await batchInsert(conn, 'analytics_quote_funnel',
    ['period','region','channel','segment','stage','newBusiness','repeatBusiness','newValue','repeatValue','avgCycleTimeDays'],
    rows);
}

// ─── 5. analytics_price_waterfall ─────────────────────────────────────────────
async function seedPriceWaterfall(conn, periods) {
  console.log('\n[5/5] Seeding analytics_price_waterfall...');
  await conn.query('DELETE FROM analytics_price_waterfall');

  const components = [
    { name: 'List Price',         sortOrder: 0, isTotal: 1 },
    { name: 'Trade Discount',     sortOrder: 1, isTotal: 0 },
    { name: 'Invoice Price',      sortOrder: 2, isTotal: 1 },
    { name: 'Cash Discount',      sortOrder: 3, isTotal: 0 },
    { name: 'Freight',            sortOrder: 4, isTotal: 0 },
    { name: 'Special Allowances', sortOrder: 5, isTotal: 0 },
    { name: 'Net Price',          sortOrder: 6, isTotal: 1 },
    { name: 'Rebates',            sortOrder: 7, isTotal: 0 },
    { name: 'Pocket Price',       sortOrder: 8, isTotal: 1 },
  ];

  const rows = [];

  // Seed per-family (All region/channel/segment) — for the family filter
  periods.forEach(period => {
    FAMILIES.forEach(family => {
      const scale = FAMILY_SCALE[family] || 0.01;
      buildWaterfallRows(period, family, 'All', 'All', 'All', scale, components, rows);
    });
  });

  // Seed per-region/channel/segment (All family) — for those filters
  periods.forEach(period => {
    REGIONS.forEach(region => {
      CHANNELS.forEach(channel => {
        SEGMENTS.forEach(segment => {
          if (region === 'All' && channel === 'All' && segment === 'All') return; // already done above
          const rSplit = REGION_SPLIT[region]   || 0.1;
          const cSplit = CHANNEL_SPLIT[channel]  || 0.1;
          const sSplit = SEGMENT_SPLIT[segment]  || 0.1;
          const scale  = (region === 'All' ? 1 : rSplit)
                       * (channel === 'All' ? 1 : cSplit)
                       * (segment === 'All' ? 1 : sSplit);
          buildWaterfallRows(period, 'All', region, channel, segment, scale, components, rows);
        });
      });
    });
  });

  await batchInsert(conn, 'analytics_price_waterfall',
    ['period','productFamily','region','channel','segment','component','value','sortOrder','isTotal'],
    rows);
}

function buildWaterfallRows(period, family, region, channel, segment, scale, components, rows) {
  const listPrice       = round2(1_050_000 * scale * rand(0.88, 1.12));
  const tradeDiscount   = round2(listPrice * rand(0.08, 0.18));
  const invoicePrice    = round2(listPrice - tradeDiscount);
  const cashDiscount    = round2(invoicePrice * rand(0.01, 0.04));
  const freight         = round2(invoicePrice * rand(0.005, 0.02));
  const specialAllow    = round2(invoicePrice * rand(0.01, 0.05));
  const netPrice        = round2(invoicePrice - cashDiscount - freight - specialAllow);
  const rebates         = round2(netPrice * rand(0.01, 0.04));
  const pocketPrice     = round2(netPrice - rebates);
  const vals = [listPrice, -tradeDiscount, invoicePrice, -cashDiscount, -freight, -specialAllow, netPrice, -rebates, pocketPrice];
  components.forEach((comp, idx) => {
    rows.push([period, family, region, channel, segment, comp.name, vals[idx], comp.sortOrder, comp.isTotal]);
  });
}

// ─── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const periods = lastNPeriods(24);
  console.log(`Seeding ${periods.length} periods: ${periods[0]} → ${periods[periods.length - 1]}`);

  await seedSnapshots(conn, periods);
  await seedMarginBridge(conn, periods);
  await seedProducts(conn, periods);
  await seedQuoteFunnel(conn, periods);
  await seedPriceWaterfall(conn, periods);

  // Final verification
  console.log('\n=== Row counts ===');
  for (const t of ['analytics_snapshots','analytics_margin_bridge','analytics_products','analytics_quote_funnel','analytics_price_waterfall']) {
    const [[r]] = await conn.query(`SELECT COUNT(*) as c FROM ${t}`);
    console.log(`  ${t}: ${r.c}`);
  }

  await conn.end();
  console.log('\nDone!');
}

main().catch(err => { console.error(err); process.exit(1); });
