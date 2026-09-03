/**
 * Seed analytics tables with realistic ITT connector data
 * Covers 24 months of data (Jan 2024 – Dec 2025) for all modules
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error("DATABASE_URL not set");

const conn = await mysql.createConnection(DB_URL);
console.log("Connected to DB");

// ─── Helpers ──────────────────────────────────────────────────────────────────
const rand = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const round2 = (n) => Math.round(n * 100) / 100;

const FAMILIES = [
  "All", "38999/KJB", "KPT", "CIR/FRCIR", "CA Bayonet",
  "MS Series", "D-Sub/DPX", "MKJ Trinity", "VBN/VS/VPT", "Rack & Panel",
];
const REGIONS = ["All", "NA", "EMEA", "APAC"];
const CHANNELS = ["All", "Direct Sales", "Distribution", "Partner", "E-Commerce", "OEM", "System Integrator"];
const SEGMENTS = ["All", "Aerospace", "Automotive", "Industrial", "Energy", "Medical", "Electronics"];
const PERIODS = [];
for (let y = 2024; y <= 2025; y++) {
  for (let m = 1; m <= 12; m++) {
    PERIODS.push(`${y}-${String(m).padStart(2, "0")}`);
  }
}

// ─── 1. analytics_snapshots ───────────────────────────────────────────────────
console.log("Seeding analytics_snapshots...");
await conn.execute("DELETE FROM analytics_snapshots");

const snapshotRows = [];
// Only seed "All" combinations to keep it manageable; filters will be client-side approximated
for (const period of PERIODS) {
  const [year, month] = period.split("-").map(Number);
  const trendFactor = 1 + (year - 2024) * 0.12 + (month - 1) * 0.008;
  const seasonality = 1 + 0.08 * Math.sin((month - 3) * Math.PI / 6);

  for (const family of FAMILIES) {
    const familyScale = family === "All" ? 1 : rand(0.05, 0.25);
    const baseRevenue = 2_400_000 * trendFactor * seasonality * familyScale;

    snapshotRows.push([
      period,
      family,
      "All",
      "All",
      round2(baseRevenue * rand(0.92, 1.08)),
      randInt(180, 320) * (family === "All" ? 1 : Math.ceil(familyScale * 5)),
      round2(rand(68, 82)),
      randInt(1100, 1400) * (family === "All" ? 1 : Math.ceil(familyScale * 5)),
      round2(100 + (year - 2024) * 4.5 + (month - 1) * 0.4 + rand(-1.5, 1.5)),
      round2(100 + (year - 2024) * 2.8 + (month - 1) * 0.25 + rand(-1, 1)),
      round2(rand(8, 18)),
    ]);
  }
}

for (let i = 0; i < snapshotRows.length; i += 200) {
  const batch = snapshotRows.slice(i, i + 200);
  await conn.query(
    `INSERT INTO analytics_snapshots (period, productFamily, region, channel, revenue, activeQuotes, winRate, activeCustomers, priceIndex, costIndex, valueGapPct) VALUES ?`,
    [batch]
  );
}
console.log(`  Inserted ${snapshotRows.length} snapshot rows`);

// ─── 2. analytics_margin_bridge ───────────────────────────────────────────────
console.log("Seeding analytics_margin_bridge...");
await conn.execute("DELETE FROM analytics_margin_bridge");

const BRIDGE_COMPONENTS = [
  { name: "Last Year YTD", sortOrder: 0, isBase: true },
  { name: "Price",         sortOrder: 1, isBase: false },
  { name: "Cost",          sortOrder: 2, isBase: false },
  { name: "Volume",        sortOrder: 3, isBase: false },
  { name: "New Business",  sortOrder: 4, isBase: false },
  { name: "Lost Business", sortOrder: 5, isBase: false },
  { name: "This Year YTD", sortOrder: 6, isBase: true },
];

const bridgeRows = [];
for (const period of PERIODS) {
  const [year, month] = period.split("-").map(Number);
  const base = round2(3_200_000 + (year - 2024) * 400_000 + (month - 1) * 35_000);
  const price = round2(rand(120_000, 280_000));
  const cost = round2(-rand(40_000, 120_000));
  const volume = round2(rand(-60_000, 180_000));
  const newBiz = round2(rand(80_000, 200_000));
  const lostBiz = round2(-rand(30_000, 90_000));
  const thisYear = round2(base + price + cost + volume + newBiz + lostBiz);

  const values = [base, price, cost, volume, newBiz, lostBiz, thisYear];
  BRIDGE_COMPONENTS.forEach((comp, idx) => {
    bridgeRows.push([period, "All", "All", "All", comp.name, values[idx], comp.sortOrder]);
  });

  // Also seed per-family (simplified)
  for (const family of FAMILIES.filter(f => f !== "All")) {
    const scale = rand(0.05, 0.18);
    BRIDGE_COMPONENTS.forEach((comp, idx) => {
      bridgeRows.push([period, family, "All", "All", comp.name, round2(values[idx] * scale), comp.sortOrder]);
    });
  }
}

for (let i = 0; i < bridgeRows.length; i += 500) {
  const batch = bridgeRows.slice(i, i + 500);
  await conn.query(
    `INSERT INTO analytics_margin_bridge (period, productFamily, region, channel, component, value, sortOrder) VALUES ?`,
    [batch]
  );
}
console.log(`  Inserted ${bridgeRows.length} margin bridge rows`);

// ─── 3. analytics_products ────────────────────────────────────────────────────
console.log("Seeding analytics_products...");
await conn.execute("DELETE FROM analytics_products");

// Representative ITT part numbers per family
const SAMPLE_PARTS = {
  "38999/KJB":   ["KJB6E14A35SN", "KJB6E14A35PN", "KJB6E16A26SN", "KJB6E20A41SN", "KJB6E22A55SN",
                  "KJB6E24A61SN", "KJB6E10A5SN",  "KJB6E12A10SN", "KJB6E18A32SN", "KJB6E8A4SN"],
  "KPT":         ["KPT02E14A35SN","KPT02E16A26SN","KPT02E20A41SN","KPT02E22A55SN","KPT02E24A61SN",
                  "KPT02E10A5SN", "KPT02E12A10SN","KPT02E18A32SN","KPT02E8A4SN",  "KPT02E14A35PN"],
  "CIR/FRCIR":   ["CIR08A14A35S", "CIR08A16A26S", "CIR08A20A41S", "CIR08A22A55S", "CIR08A24A61S",
                  "FRCIR08A14A35S","FRCIR08A16A26S","CIR08A10A5S", "CIR08A12A10S", "CIR08A18A32S"],
  "CA Bayonet":  ["CA3102E14A35P","CA3102E16A26P","CA3102E20A41P","CA3102E22A55P","CA3102E24A61P",
                  "CA3102E10A5P", "CA3102E12A10P","CA3102E18A32P","CA3102E8A4P",  "CA3106E14A35S"],
  "MS Series":   ["MS3102A14A35P","MS3102A16A26P","MS3102A20A41P","MS3102A22A55P","MS3102A24A61P",
                  "MS3102A10A5P", "MS3102A12A10P","MS3102A18A32P","MS3102A8A4P",  "MS3106A14A35S"],
  "D-Sub/DPX":   ["DPX2W9P",      "DPX2W15P",     "DPX2W25P",     "DPX2W37P",     "DPX2W50P",
                  "DBM9S",        "DBM15S",       "DBM25S",       "DBM37S",       "DBM50S"],
  "MKJ Trinity": ["MKJ6A14A35SN", "MKJ6A16A26SN", "MKJ6A20A41SN", "MKJ6A22A55SN", "MKJ6A24A61SN",
                  "MKJ6A10A5SN",  "MKJ6A12A10SN", "MKJ6A18A32SN", "MKJ6A8A4SN",  "MKJ6A14A35PN"],
  "VBN/VS/VPT":  ["VBN02A14A35S", "VS02A16A26S",  "VPT02A20A41S", "VBN02A22A55S", "VS02A24A61S",
                  "VPT02A10A5S",  "VBN02A12A10S", "VS02A18A32S",  "VPT02A8A4S",  "VBN02A14A35P"],
  "Rack & Panel":["BKAD14A35P",   "BKAD16A26P",   "BKAD20A41P",   "BKAD22A55P",   "BKAD24A61P",
                  "TKJ14A35P",    "TKJ16A26P",    "TKJ20A41P",    "TKJ22A55P",    "TKJ24A61P"],
};

const DISCOUNT_TYPES = ["list_price", "standard_discount", "custom_discount"];
const productRows = [];

for (const period of PERIODS) {
  const [year, month] = period.split("-").map(Number);
  const trendFactor = 1 + (year - 2024) * 0.10 + (month - 1) * 0.007;

  for (const [family, parts] of Object.entries(SAMPLE_PARTS)) {
    // Generate sales values with power-law distribution for Pareto
    const salesValues = parts.map((_, i) => {
      const rank = i + 1;
      const base = 1_200_000 / Math.pow(rank, 1.2);
      return round2(base * trendFactor * rand(0.85, 1.15));
    });

    // Sort descending for Pareto
    const sorted = [...salesValues].sort((a, b) => b - a);
    const total = sorted.reduce((s, v) => s + v, 0);
    let cumulative = 0;

    parts.forEach((pn, i) => {
      const sales = salesValues[i];
      const sortedIdx = sorted.indexOf(sales);
      cumulative += sales / total;
      let paretoCategory;
      if (cumulative <= 0.686) paretoCategory = "A";
      else if (cumulative <= 0.892) paretoCategory = "B";
      else if (cumulative <= 0.966) paretoCategory = "C";
      else paretoCategory = "D";

      const marginAtListPct = round2(rand(28, 72));
      const avgDiscountPct = round2(rand(0, 28));
      const discountType = DISCOUNT_TYPES[avgDiscountPct < 5 ? 0 : avgDiscountPct < 15 ? 1 : 2];
      const competitivePremiums = JSON.stringify({
        "Competitor A": round2(rand(-15, 15)),
        "Competitor B": round2(rand(-12, 18)),
        "Competitor C": round2(rand(-8, 12)),
        "Competitor D": round2(rand(-18, 10)),
      });

      productRows.push([
        pn, family, sales, marginAtListPct, avgDiscountPct,
        discountType, competitivePremiums, paretoCategory, period
      ]);
    });
  }
}

for (let i = 0; i < productRows.length; i += 500) {
  const batch = productRows.slice(i, i + 500);
  await conn.query(
    `INSERT INTO analytics_products (partNumber, productFamily, sales, marginAtListPct, avgDiscountPct, discountType, competitivePremiums, paretoCategory, period) VALUES ?`,
    [batch]
  );
}
console.log(`  Inserted ${productRows.length} product analytics rows`);

// ─── 4. analytics_quote_funnel ────────────────────────────────────────────────
console.log("Seeding analytics_quote_funnel...");
await conn.execute("DELETE FROM analytics_quote_funnel");

const STAGES = ["Technical Review", "Negotiation", "Won"];
const funnelRows = [];

for (const period of PERIODS) {
  const [year, month] = period.split("-").map(Number);
  const trendFactor = 1 + (year - 2024) * 0.08 + (month - 1) * 0.005;

  for (const stage of STAGES) {
    const stageMultiplier = stage === "Technical Review" ? 1 : stage === "Negotiation" ? 0.55 : 0.35;
    const newBiz = randInt(60, 110) * stageMultiplier * trendFactor;
    const repeatBiz = randInt(100, 180) * stageMultiplier * trendFactor;
    const newVal = round2(newBiz * rand(14_000, 18_000));
    const repeatVal = round2(repeatBiz * rand(15_000, 20_000));
    const cycleTime = stage === "Won" ? round2(rand(28, 45)) : round2(rand(15, 30));

    funnelRows.push([
      period, "All", "All", "All", stage,
      Math.round(newBiz), Math.round(repeatBiz),
      newVal, repeatVal, cycleTime
    ]);

    // Per-segment rows
    for (const segment of SEGMENTS.filter(s => s !== "All")) {
      const segScale = rand(0.08, 0.25);
      funnelRows.push([
        period, "All", "All", segment, stage,
        Math.round(newBiz * segScale), Math.round(repeatBiz * segScale),
        round2(newVal * segScale), round2(repeatVal * segScale), cycleTime
      ]);
    }
  }
}

for (let i = 0; i < funnelRows.length; i += 500) {
  const batch = funnelRows.slice(i, i + 500);
  await conn.query(
    `INSERT INTO analytics_quote_funnel (period, region, channel, segment, stage, newBusiness, repeatBusiness, newValue, repeatValue, avgCycleTimeDays) VALUES ?`,
    [batch]
  );
}
console.log(`  Inserted ${funnelRows.length} quote funnel rows`);

// ─── 5. analytics_price_waterfall ────────────────────────────────────────────
console.log("Seeding analytics_price_waterfall...");
await conn.execute("DELETE FROM analytics_price_waterfall");

const WATERFALL_COMPONENTS = [
  { name: "List Price",           sortOrder: 0, isTotal: true  },
  { name: "Volume Discount",      sortOrder: 1, isTotal: false },
  { name: "Contract Discount",    sortOrder: 2, isTotal: false },
  { name: "Promotional Discount", sortOrder: 3, isTotal: false },
  { name: "Invoice Price",        sortOrder: 4, isTotal: true  },
  { name: "Rebates",              sortOrder: 5, isTotal: false },
  { name: "Payment Terms",        sortOrder: 6, isTotal: false },
  { name: "Freight",              sortOrder: 7, isTotal: false },
  { name: "Pocket Price",         sortOrder: 8, isTotal: true  },
];

const waterfallRows = [];
for (const period of PERIODS) {
  const [year, month] = period.split("-").map(Number);
  const trendFactor = 1 + (year - 2024) * 0.06;

  for (const family of FAMILIES) {
    const familyScale = family === "All" ? 1 : rand(0.06, 0.22);
    const listPrice = round2(1_050_000 * trendFactor * familyScale * rand(0.9, 1.1));
    const volDiscount = round2(-listPrice * rand(0.06, 0.12));
    const contractDiscount = round2(-listPrice * rand(0.04, 0.09));
    const promoDiscount = round2(-listPrice * rand(0.01, 0.04));
    const invoicePrice = round2(listPrice + volDiscount + contractDiscount + promoDiscount);
    const rebates = round2(-invoicePrice * rand(0.02, 0.06));
    const paymentTerms = round2(-invoicePrice * rand(0.005, 0.02));
    const freight = round2(-invoicePrice * rand(0.01, 0.03));
    const pocketPrice = round2(invoicePrice + rebates + paymentTerms + freight);

    const values = [listPrice, volDiscount, contractDiscount, promoDiscount,
                    invoicePrice, rebates, paymentTerms, freight, pocketPrice];

    WATERFALL_COMPONENTS.forEach((comp, idx) => {
      waterfallRows.push([
        period, family, "All", "All", "All",
        comp.name, values[idx], comp.sortOrder, comp.isTotal ? 1 : 0
      ]);
    });
  }
}

for (let i = 0; i < waterfallRows.length; i += 500) {
  const batch = waterfallRows.slice(i, i + 500);
  await conn.query(
    `INSERT INTO analytics_price_waterfall (period, productFamily, region, channel, segment, component, value, sortOrder, isTotal) VALUES ?`,
    [batch]
  );
}
console.log(`  Inserted ${waterfallRows.length} price waterfall rows`);

await conn.end();
console.log("\n✅ Analytics seeding complete!");
