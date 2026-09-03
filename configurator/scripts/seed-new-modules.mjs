/**
 * Seed script for all 7 new module tables:
 * customers, competitor_data, ai_model_stats, managed_products,
 * price_lists, price_list_items, quote_mgmt, dynamic_pricing_scenarios
 */
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// ─── Customers ────────────────────────────────────────────────────────────────
console.log('Seeding customers...');
await conn.execute('DELETE FROM customers');

const customers = [
  {
    name: 'Lockheed Martin Corporation',
    tier: 'Enterprise', industry: 'Aerospace & Defense',
    location: 'Bethesda, MD', region: 'North America',
    annualVolume: 2800000, priceIndex: 113.5, marginIndex: 112.9,
    trend: 'High',
    channels: JSON.stringify(['Direct Sales']),
    contracts: JSON.stringify(['Premium', 'Long-Term']),
    primaryProducts: JSON.stringify(['38999/KJB', 'MKJ Trinity', 'MS Series']),
    contactName: 'James Whitfield', contactEmail: 'j.whitfield@lmco.com',
    notes: 'Primary supplier for F-35 connector harnesses. Strong preference for MIL-spec 38999 series.'
  },
  {
    name: 'Boeing Defense & Space',
    tier: 'Enterprise', industry: 'Aerospace & Defense',
    location: 'Chicago, IL', region: 'North America',
    annualVolume: 2500000, priceIndex: 111.3, marginIndex: 110.6,
    trend: 'High',
    channels: JSON.stringify(['Direct Sales', 'OEM']),
    contracts: JSON.stringify(['Standard', 'Premium']),
    primaryProducts: JSON.stringify(['38999/KJB', 'KPT', 'CIR/FRCIR']),
    contactName: 'Sarah Johnson', contactEmail: 's.johnson@boeing.com',
    notes: 'Key account for commercial and defense aerospace connectors. Multi-year framework agreement in place.'
  },
  {
    name: 'Raytheon Technologies',
    tier: 'Enterprise', industry: 'Aerospace & Defense',
    location: 'Waltham, MA', region: 'North America',
    annualVolume: 2200000, priceIndex: 115.2, marginIndex: 114.1,
    trend: 'High',
    channels: JSON.stringify(['Direct Sales']),
    contracts: JSON.stringify(['Premium']),
    primaryProducts: JSON.stringify(['38999/KJB', 'MKJ Trinity', 'CA Bayonet']),
    contactName: 'Michael Torres', contactEmail: 'm.torres@rtx.com',
    notes: 'Missile systems and radar applications. Highest price index customer — premium positioning validated.'
  },
  {
    name: 'Airbus Defense and Space',
    tier: 'Enterprise', industry: 'Aerospace & Defense',
    location: 'Toulouse, France', region: 'Europe',
    annualVolume: 1900000, priceIndex: 113.8, marginIndex: 108.7,
    trend: 'High',
    channels: JSON.stringify(['Direct Sales', 'Partner']),
    contracts: JSON.stringify(['Standard', 'Premium']),
    primaryProducts: JSON.stringify(['38999/KJB', 'KPT', 'D-Sub/DPX']),
    contactName: 'Claire Dupont', contactEmail: 'c.dupont@airbus.com',
    notes: 'European flagship account. A350 and A400M programs. Currency hedging in contract.'
  },
  {
    name: 'General Dynamics Mission Systems',
    tier: 'Enterprise', industry: 'Defense Electronics',
    location: 'Fairfax, VA', region: 'North America',
    annualVolume: 1700000, priceIndex: 109.4, marginIndex: 107.8,
    trend: 'Good',
    channels: JSON.stringify(['Direct Sales', 'Distribution']),
    contracts: JSON.stringify(['Volume', 'Standard']),
    primaryProducts: JSON.stringify(['CIR/FRCIR', 'MS Series', 'MKJ Trinity']),
    contactName: 'Robert Chen', contactEmail: 'r.chen@gd.com',
    notes: 'Ground vehicle and naval systems. Strong volume commitment — eligible for tier pricing.'
  },
  {
    name: 'BAE Systems',
    tier: 'Enterprise', industry: 'Aerospace & Defense',
    location: 'London, UK', region: 'Europe',
    annualVolume: 1500000, priceIndex: 107.6, marginIndex: 105.3,
    trend: 'Good',
    channels: JSON.stringify(['Direct Sales']),
    contracts: JSON.stringify(['Standard']),
    primaryProducts: JSON.stringify(['38999/KJB', 'CA Bayonet', 'VBN/VS/VPT']),
    contactName: 'David Hughes', contactEmail: 'd.hughes@baesystems.com',
    notes: 'Eurofighter and Typhoon programs. Competitive pressure from Amphenol on CA Bayonet line.'
  },
  {
    name: 'Northrop Grumman',
    tier: 'Enterprise', industry: 'Aerospace & Defense',
    location: 'Falls Church, VA', region: 'North America',
    annualVolume: 1400000, priceIndex: 112.1, marginIndex: 111.4,
    trend: 'High',
    channels: JSON.stringify(['Direct Sales']),
    contracts: JSON.stringify(['Premium', 'Long-Term']),
    primaryProducts: JSON.stringify(['38999/KJB', 'MKJ Trinity']),
    contactName: 'Patricia Wells', contactEmail: 'p.wells@ngc.com',
    notes: 'B-21 Raider and GBSD programs. Highest growth trajectory in portfolio.'
  },
  {
    name: 'L3Harris Technologies',
    tier: 'Large', industry: 'Defense Electronics',
    location: 'Melbourne, FL', region: 'North America',
    annualVolume: 1100000, priceIndex: 104.8, marginIndex: 103.2,
    trend: 'Good',
    channels: JSON.stringify(['Direct Sales', 'Distribution']),
    contracts: JSON.stringify(['Standard']),
    primaryProducts: JSON.stringify(['CIR/FRCIR', 'D-Sub/DPX', 'Rack & Panel']),
    contactName: 'Kevin Park', contactEmail: 'k.park@l3harris.com',
    notes: 'Communications and electronic warfare systems. Growing interest in fiber optic connectors.'
  },
  {
    name: 'Thales Group',
    tier: 'Large', industry: 'Aerospace & Defense',
    location: 'Paris, France', region: 'Europe',
    annualVolume: 980000, priceIndex: 106.3, marginIndex: 104.9,
    trend: 'Stable',
    channels: JSON.stringify(['Partner', 'Direct Sales']),
    contracts: JSON.stringify(['Standard']),
    primaryProducts: JSON.stringify(['KPT', 'CIR/FRCIR', 'CA Bayonet']),
    contactName: 'François Martin', contactEmail: 'f.martin@thalesgroup.com',
    notes: 'Avionics and space systems. Evaluating switch from KPT to 38999 for new programs.'
  },
  {
    name: 'Honeywell Aerospace',
    tier: 'Large', industry: 'Aerospace',
    location: 'Phoenix, AZ', region: 'North America',
    annualVolume: 850000, priceIndex: 102.4, marginIndex: 99.8,
    trend: 'Stable',
    channels: JSON.stringify(['OEM', 'Direct Sales']),
    contracts: JSON.stringify(['Volume']),
    primaryProducts: JSON.stringify(['MS Series', 'MKJ Trinity', 'D-Sub/DPX']),
    contactName: 'Lisa Anderson', contactEmail: 'l.anderson@honeywell.com',
    notes: 'Avionics and engine controls. Price-sensitive segment — volume discounts critical to retention.'
  },
  {
    name: 'Safran Electrical & Power',
    tier: 'Large', industry: 'Aerospace',
    location: 'Pitstone, UK', region: 'Europe',
    annualVolume: 720000, priceIndex: 108.9, marginIndex: 107.1,
    trend: 'Good',
    channels: JSON.stringify(['Direct Sales']),
    contracts: JSON.stringify(['Standard', 'Premium']),
    primaryProducts: JSON.stringify(['38999/KJB', 'KPT']),
    contactName: 'Antoine Lefevre', contactEmail: 'a.lefevre@safran.com',
    notes: 'Wiring harness manufacturer for Airbus programs. Strong growth in 38999 demand.'
  },
  {
    name: 'Leonardo DRS',
    tier: 'Mid', industry: 'Defense Electronics',
    location: 'Arlington, VA', region: 'North America',
    annualVolume: 540000, priceIndex: 101.7, marginIndex: 100.4,
    trend: 'Stable',
    channels: JSON.stringify(['Distribution']),
    contracts: JSON.stringify(['Standard']),
    primaryProducts: JSON.stringify(['CIR/FRCIR', 'MS Series']),
    contactName: 'Thomas Grant', contactEmail: 't.grant@leonardodrs.com',
    notes: 'Ground vehicle electronics. Distribution channel — monitor for competitive erosion.'
  },
];

for (const c of customers) {
  await conn.execute(
    `INSERT INTO customers (name, tier, industry, location, region, annualVolume, priceIndex, marginIndex, trend, channels, contracts, primaryProducts, contactName, contactEmail, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [c.name, c.tier, c.industry, c.location, c.region, c.annualVolume, c.priceIndex, c.marginIndex, c.trend, c.channels, c.contracts, c.primaryProducts, c.contactName, c.contactEmail, c.notes]
  );
}
console.log(`  ✓ ${customers.length} customers inserted`);

// ─── Competitor Data ──────────────────────────────────────────────────────────
console.log('Seeding competitor data...');
await conn.execute('DELETE FROM competitor_data');

const segments = ['All', 'Aerospace & Defense', 'Industrial', 'Transportation'];
const periods = ['Last 12 Months', 'Last 6 Months', 'Last Quarter'];

const competitorBase = [
  {
    name: 'Amphenol Corporation', isUs: false,
    marketSharePct: 22.4, avgPrice: 285.50, priceTrend: 'up',
    keyStrength: 'Broadest product portfolio in the industry',
    keyWeakness: 'Longer lead times on custom configurations',
    wins: 187, losses: 143, winRate: 56.7,
    keyFactors: JSON.stringify(['Price competitiveness', 'Delivery speed', 'Technical support']),
  },
  {
    name: 'TE Connectivity', isUs: false,
    marketSharePct: 19.8, avgPrice: 271.20, priceTrend: 'stable',
    keyStrength: 'Strong automotive and industrial presence',
    keyWeakness: 'Limited MIL-spec depth vs ITT',
    wins: 156, losses: 178, winRate: 46.7,
    keyFactors: JSON.stringify(['Product breadth', 'Global distribution', 'Price']),
  },
  {
    name: 'Souriau-Sunbank', isUs: false,
    marketSharePct: 8.3, avgPrice: 312.80, priceTrend: 'up',
    keyStrength: 'Premium MIL-spec positioning, European stronghold',
    keyWeakness: 'Limited North American distribution',
    wins: 89, losses: 124, winRate: 41.8,
    keyFactors: JSON.stringify(['Technical specs', 'European relationships', 'Quality']),
  },
  {
    name: 'Glenair Inc.', isUs: false,
    marketSharePct: 6.1, avgPrice: 298.40, priceTrend: 'stable',
    keyStrength: 'Backshell and accessories ecosystem',
    keyWeakness: 'Narrower connector line than ITT',
    wins: 67, losses: 98, winRate: 40.6,
    keyFactors: JSON.stringify(['Accessories bundling', 'Delivery', 'Relationships']),
  },
  {
    name: 'ITT Cannon (Us)', isUs: true,
    marketSharePct: 14.2, avgPrice: 295.00, priceTrend: 'up',
    keyStrength: 'MIL-spec depth, 38999 & KPT leadership, application engineering',
    keyWeakness: 'Premium pricing vs commodity competitors',
    wins: 312, losses: 189, winRate: 62.3,
    keyFactors: JSON.stringify(['Technical leadership', 'MIL-spec compliance', 'Application support']),
  },
];

for (const seg of segments) {
  for (const period of periods) {
    for (const comp of competitorBase) {
      // Add some variation by segment/period
      const segMult = seg === 'Aerospace & Defense' ? 1.05 : seg === 'Industrial' ? 0.95 : 1.0;
      const periodMult = period === 'Last Quarter' ? 0.97 : period === 'Last 6 Months' ? 0.99 : 1.0;
      await conn.execute(
        `INSERT INTO competitor_data (name, marketSharePct, avgPrice, priceTrend, keyStrength, keyWeakness, wins, losses, winRate, keyFactors, segment, period, isUs)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          comp.name,
          +(comp.marketSharePct * segMult * periodMult).toFixed(1),
          +(parseFloat(comp.avgPrice) * segMult).toFixed(2),
          comp.priceTrend,
          comp.keyStrength, comp.keyWeakness,
          Math.round(comp.wins * periodMult), Math.round(comp.losses * periodMult),
          +(comp.winRate * segMult).toFixed(1),
          comp.keyFactors, seg, period, comp.isUs
        ]
      );
    }
  }
}
console.log(`  ✓ ${segments.length * periods.length * competitorBase.length} competitor rows inserted`);

// ─── AI Model Stats ───────────────────────────────────────────────────────────
console.log('Seeding AI model stats...');
await conn.execute('DELETE FROM ai_model_stats');

const aiModels = [
  { modelName: 'PriceOptimizer v3.2', modelType: 'price_optimization', accuracy: 94.2, totalPredictions: 18847, status: 'Active' },
  { modelName: 'DemandForecaster v2.1', modelType: 'demand_forecasting', accuracy: 89.7, totalPredictions: 12934, status: 'Active' },
  { modelName: 'CustomerAnalytics v1.8', modelType: 'customer_analytics', accuracy: 91.3, totalPredictions: 7621, status: 'Active' },
  { modelName: 'AnomalyDetector v2.0', modelType: 'anomaly_detection', accuracy: 96.1, totalPredictions: 3234, status: 'Active' },
];

for (const m of aiModels) {
  await conn.execute(
    `INSERT INTO ai_model_stats (modelName, modelType, accuracy, totalPredictions, status) VALUES (?, ?, ?, ?, ?)`,
    [m.modelName, m.modelType, m.accuracy, m.totalPredictions, m.status]
  );
}
console.log(`  ✓ ${aiModels.length} AI model stats inserted`);

// ─── Managed Products ─────────────────────────────────────────────────────────
console.log('Seeding managed products...');
await conn.execute('DELETE FROM managed_products');

const managedProducts = [
  // Standard products — real ITT connector families
  { sku: 'KJB6E14-19SN', name: 'MIL-DTL-38999 Series III Plug, Size 14, 19 Socket', category: 'Circular MIL-Spec', family: '38999/KJB', isCustom: false, listPrice: 342.50, unit: 'EA', complexityMultiplier: 1.0, moq: 1 },
  { sku: 'KJB6E22-55SN', name: 'MIL-DTL-38999 Series III Plug, Size 22, 55 Socket', category: 'Circular MIL-Spec', family: '38999/KJB', isCustom: false, listPrice: 487.25, unit: 'EA', complexityMultiplier: 1.0, moq: 1 },
  { sku: 'KPT6E14-19SN', name: 'MIL-DTL-26482 Series I Plug, Size 14, 19 Contact', category: 'Circular MIL-Spec', family: 'KPT', isCustom: false, listPrice: 218.75, unit: 'EA', complexityMultiplier: 1.0, moq: 1 },
  { sku: 'KPT6E18-32SN', name: 'MIL-DTL-26482 Series I Plug, Size 18, 32 Contact', category: 'Circular MIL-Spec', family: 'KPT', isCustom: false, listPrice: 276.40, unit: 'EA', complexityMultiplier: 1.0, moq: 1 },
  { sku: 'CIR06F14S-19S', name: 'FRCIR Circular Connector, Size 14S, 19 Socket', category: 'Circular Industrial', family: 'CIR/FRCIR', isCustom: false, listPrice: 189.90, unit: 'EA', complexityMultiplier: 1.0, moq: 1 },
  { sku: 'CIR06F22-55S', name: 'FRCIR Circular Connector, Size 22, 55 Socket', category: 'Circular Industrial', family: 'CIR/FRCIR', isCustom: false, listPrice: 312.60, unit: 'EA', complexityMultiplier: 1.0, moq: 1 },
  { sku: 'CA3106F14S-7S', name: 'CA Bayonet Circular Connector, Size 14S, 7 Socket', category: 'Bayonet Circular', family: 'CA Bayonet', isCustom: false, listPrice: 156.80, unit: 'EA', complexityMultiplier: 1.0, moq: 1 },
  { sku: 'MS3106A20-29S', name: 'MS Series Circular Connector, Size 20, 29 Socket', category: 'Circular MIL-Spec', family: 'MS Series', isCustom: false, listPrice: 198.45, unit: 'EA', complexityMultiplier: 1.0, moq: 1 },
  { sku: 'DPX2W-P-SV-3P-1', name: 'D-Sub DPX 3-Position Plug, Silver Plated', category: 'D-Sub', family: 'D-Sub/DPX', isCustom: false, listPrice: 87.30, unit: 'EA', complexityMultiplier: 1.0, moq: 1 },
  { sku: 'MKJ7E14-19SN', name: 'Trinity MKJ Series III Plug, Size 14, 19 Socket', category: 'Circular MIL-Spec', family: 'MKJ Trinity', isCustom: false, listPrice: 298.75, unit: 'EA', complexityMultiplier: 1.0, moq: 1 },
  { sku: 'MKJ7E22-55SN', name: 'Trinity MKJ Series III Plug, Size 22, 55 Socket', category: 'Circular MIL-Spec', family: 'MKJ Trinity', isCustom: false, listPrice: 425.90, unit: 'EA', complexityMultiplier: 1.0, moq: 1 },
  { sku: 'VBN2E14-19SN', name: 'VBN Circular Connector, Size 14, 19 Contact', category: 'Circular Industrial', family: 'VBN/VS/VPT', isCustom: false, listPrice: 167.40, unit: 'EA', complexityMultiplier: 1.0, moq: 1 },
  // Custom products
  {
    sku: 'KJB6E14-19SN-CUST-001', name: 'MIL-DTL-38999 Series III Plug, Size 14, 19 Socket — Hermetic Seal Custom',
    category: 'Circular MIL-Spec', family: '38999/KJB', isCustom: true, listPrice: 548.00, unit: 'EA',
    complexityMultiplier: 1.6, moq: 5, customizationCount: 2, basedOnSku: 'KJB6E14-19SN'
  },
  {
    sku: 'CIR06F14S-19S-CUST-001', name: 'FRCIR Circular Connector, Size 14S, 19 Socket — Extended Temperature Range',
    category: 'Circular Industrial', family: 'CIR/FRCIR', isCustom: true, listPrice: 341.82, unit: 'EA',
    complexityMultiplier: 1.8, moq: 10, customizationCount: 3, basedOnSku: 'CIR06F14S-19S'
  },
];

for (const p of managedProducts) {
  await conn.execute(
    `INSERT INTO managed_products (sku, name, category, family, isCustom, listPrice, unit, complexityMultiplier, moq, customizationCount, basedOnSku)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [p.sku, p.name, p.category, p.family, p.isCustom ? 1 : 0, p.listPrice, p.unit, p.complexityMultiplier, p.moq, p.customizationCount || 0, p.basedOnSku || null]
  );
}
console.log(`  ✓ ${managedProducts.length} managed products inserted`);

// ─── Price Lists ──────────────────────────────────────────────────────────────
console.log('Seeding price lists...');
await conn.execute('DELETE FROM price_list_items');
await conn.execute('DELETE FROM price_lists');

const priceLists = [
  { name: 'Standard List Price', description: 'Default catalog pricing for all customers', segment: 'All', isDefault: true },
  { name: 'Enterprise Customer', description: 'Negotiated pricing for Enterprise-tier accounts', segment: 'Enterprise', isDefault: false },
  { name: 'Volume Discount', description: 'Tiered pricing based on annual purchase volume', segment: 'All', isDefault: false },
  { name: 'Aerospace Premium', description: 'Premium pricing for Aerospace & Defense programs', segment: 'Aerospace & Defense', isDefault: false },
  { name: 'Defense OEM', description: 'OEM pricing for qualified defense manufacturers', segment: 'Defense Electronics', isDefault: false },
  { name: 'Industrial Bulk', description: 'Bulk pricing for industrial distribution channel', segment: 'Industrial', isDefault: false },
];

const listIds = [];
for (const pl of priceLists) {
  const [res] = await conn.execute(
    `INSERT INTO price_lists (name, description, segment, isDefault) VALUES (?, ?, ?, ?)`,
    [pl.name, pl.description, pl.segment, pl.isDefault ? 1 : 0]
  );
  listIds.push(res.insertId);
}
console.log(`  ✓ ${priceLists.length} price lists inserted`);

// Seed price list items for each list
const priceListProducts = [
  { sku: 'KJB6E14-19SN', name: 'MIL-DTL-38999 Series III Plug, Size 14, 19 Socket', basePrice: 342.50 },
  { sku: 'KJB6E22-55SN', name: 'MIL-DTL-38999 Series III Plug, Size 22, 55 Socket', basePrice: 487.25 },
  { sku: 'KPT6E14-19SN', name: 'MIL-DTL-26482 Series I Plug, Size 14, 19 Contact', basePrice: 218.75 },
  { sku: 'KPT6E18-32SN', name: 'MIL-DTL-26482 Series I Plug, Size 18, 32 Contact', basePrice: 276.40 },
  { sku: 'CIR06F14S-19S', name: 'FRCIR Circular Connector, Size 14S, 19 Socket', basePrice: 189.90 },
  { sku: 'CIR06F22-55S', name: 'FRCIR Circular Connector, Size 22, 55 Socket', basePrice: 312.60 },
  { sku: 'CA3106F14S-7S', name: 'CA Bayonet Circular Connector, Size 14S, 7 Socket', basePrice: 156.80 },
  { sku: 'MS3106A20-29S', name: 'MS Series Circular Connector, Size 20, 29 Socket', basePrice: 198.45 },
  { sku: 'DPX2W-P-SV-3P-1', name: 'D-Sub DPX 3-Position Plug, Silver Plated', basePrice: 87.30 },
  { sku: 'MKJ7E14-19SN', name: 'Trinity MKJ Series III Plug, Size 14, 19 Socket', basePrice: 298.75 },
];

const aiRecs = ['Increase', 'Decrease', 'Hold'];
const statuses = ['Pending Review', 'Approved', 'Approved', 'Approved', 'Rejected'];

for (let li = 0; li < listIds.length; li++) {
  const listId = listIds[li];
  const discountFactor = [1.0, 0.88, 0.82, 1.08, 0.85, 0.78][li];
  for (let pi = 0; pi < priceListProducts.length; pi++) {
    const p = priceListProducts[pi];
    const currentPrice = +(p.basePrice * discountFactor).toFixed(2);
    const marginPct = 28 + Math.random() * 22;
    const winRate = 45 + Math.random() * 35;
    const exceptionPct = Math.random() * 18;
    const priceAttainment = 82 + Math.random() * 15;
    const aiRec = aiRecs[pi % 3];
    const aiConf = 72 + Math.random() * 25;
    const suggestedMult = aiRec === 'Increase' ? 1.04 + Math.random() * 0.06 : aiRec === 'Decrease' ? 0.94 - Math.random() * 0.04 : 1.0;
    const aiSuggestedPrice = +(currentPrice * suggestedMult).toFixed(2);
    const status = statuses[(pi + li) % statuses.length];

    await conn.execute(
      `INSERT INTO price_list_items (priceListId, sku, productName, currentPrice, marginPct, customers, winRate, exceptionPct, priceAttainment, aiRecommendation, aiConfidence, aiSuggestedPrice, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [listId, p.sku, p.name, currentPrice, +marginPct.toFixed(1), Math.round(2 + Math.random() * 12), +winRate.toFixed(1), +exceptionPct.toFixed(1), +priceAttainment.toFixed(1), aiRec, +aiConf.toFixed(1), aiSuggestedPrice, status]
    );
  }
}
console.log(`  ✓ ${listIds.length * priceListProducts.length} price list items inserted`);

// ─── Quote Management ─────────────────────────────────────────────────────────
console.log('Seeding quote management records...');
await conn.execute('DELETE FROM quote_mgmt');

const quoteStatuses = ['Draft', 'Pending Approval', 'Auto-Approved', 'Approved', 'Rejected', 'Expired', 'Converted'];
const quoteCustomers = [
  { name: 'Lockheed Martin Corporation', contact: 'James Whitfield' },
  { name: 'Boeing Defense & Space', contact: 'Sarah Johnson' },
  { name: 'Raytheon Technologies', contact: 'Michael Torres' },
  { name: 'Airbus Defense and Space', contact: 'Claire Dupont' },
  { name: 'General Dynamics Mission Systems', contact: 'Robert Chen' },
  { name: 'BAE Systems', contact: 'David Hughes' },
  { name: 'Northrop Grumman', contact: 'Patricia Wells' },
];

const quoteItems = [
  [
    { sku: 'KJB6E14-19SN', description: 'MIL-DTL-38999 Series III Plug, Size 14, 19 Socket', qty: 50, unitPrice: 342.50, discount: 0.10, total: 15412.50 },
    { sku: 'KJB6E22-55SN', description: 'MIL-DTL-38999 Series III Plug, Size 22, 55 Socket', qty: 25, unitPrice: 487.25, discount: 0.10, total: 10963.13 },
  ],
  [
    { sku: 'KPT6E14-19SN', description: 'MIL-DTL-26482 Series I Plug, Size 14, 19 Contact', qty: 100, unitPrice: 218.75, discount: 0.12, total: 19250.00 },
    { sku: 'CIR06F14S-19S', description: 'FRCIR Circular Connector, Size 14S, 19 Socket', qty: 75, unitPrice: 189.90, discount: 0.08, total: 13097.10 },
  ],
  [
    { sku: 'MKJ7E14-19SN', description: 'Trinity MKJ Series III Plug, Size 14, 19 Socket', qty: 200, unitPrice: 298.75, discount: 0.15, total: 50847.50 },
  ],
];

const now = new Date();
for (let i = 0; i < 18; i++) {
  const custIdx = i % quoteCustomers.length;
  const cust = quoteCustomers[custIdx];
  const status = quoteStatuses[i % quoteStatuses.length];
  const items = quoteItems[i % quoteItems.length];
  const totalValue = items.reduce((s, it) => s + it.total, 0);
  const createdDate = new Date(now.getTime() - (i * 8 + Math.random() * 5) * 24 * 60 * 60 * 1000);
  const expiryDate = new Date(createdDate.getTime() + 30 * 24 * 60 * 60 * 1000);
  const quoteId = `Q-${createdDate.getFullYear()}-${String(i + 1).padStart(3, '0')}`;

  await conn.execute(
    `INSERT INTO quote_mgmt (quoteId, customerName, contactName, totalValue, status, items, expiryDate, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [quoteId, cust.name, cust.contact, totalValue.toFixed(2), status, JSON.stringify(items), expiryDate, createdDate]
  );
}
console.log(`  ✓ 18 quote management records inserted`);

// ─── Dynamic Pricing Scenarios ────────────────────────────────────────────────
console.log('Seeding dynamic pricing scenarios...');
await conn.execute('DELETE FROM dynamic_pricing_scenarios');

const dpProducts = [
  { sku: 'KJB6E14-19SN', name: 'MIL-DTL-38999 Series III Plug, Size 14, 19 Socket', currentPrice: 342.50 },
  { sku: 'KPT6E14-19SN', name: 'MIL-DTL-26482 Series I Plug, Size 14, 19 Contact', currentPrice: 218.75 },
  { sku: 'CIR06F14S-19S', name: 'FRCIR Circular Connector, Size 14S, 19 Socket', currentPrice: 189.90 },
  { sku: 'MKJ7E14-19SN', name: 'Trinity MKJ Series III Plug, Size 14, 19 Socket', currentPrice: 298.75 },
  { sku: 'CA3106F14S-7S', name: 'CA Bayonet Circular Connector, Size 14S, 7 Socket', currentPrice: 156.80 },
  { sku: 'MS3106A20-29S', name: 'MS Series Circular Connector, Size 20, 29 Socket', currentPrice: 198.45 },
];

const strategies = ['Market-Based', 'Value-Based', 'Cost-Plus', 'Demand-Based'];
const strategyMultipliers = {
  'Market-Based': { lift: 0.028, vol: -0.015, conf: 0.91, elasticity: -0.72 },
  'Value-Based':  { lift: 0.052, vol: -0.031, conf: 0.87, elasticity: -0.45 },
  'Cost-Plus':    { lift: 0.018, vol: -0.008, conf: 0.95, elasticity: -0.88 },
  'Demand-Based': { lift: 0.034, vol: -0.022, conf: 0.89, elasticity: -0.61 },
};

for (const prod of dpProducts) {
  for (const strat of strategies) {
    const sm = strategyMultipliers[strat];
    const liftVariance = (Math.random() - 0.5) * 0.01;
    const lift = sm.lift + liftVariance;
    const suggestedPrice = +(prod.currentPrice * (1 + lift)).toFixed(2);
    const volumeImpact = sm.vol + (Math.random() - 0.5) * 0.005;
    const revenueImpact = +(prod.currentPrice * 1000 * (lift + volumeImpact)).toFixed(2);
    const confidence = +(sm.conf + (Math.random() - 0.5) * 0.04).toFixed(3);
    const elasticity = +(sm.elasticity + (Math.random() - 0.5) * 0.1).toFixed(2);

    await conn.execute(
      `INSERT INTO dynamic_pricing_scenarios (productSku, productName, currentPrice, strategy, suggestedPrice, priceLiftPct, volumeImpactPct, revenueImpact, confidence, elasticity)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [prod.sku, prod.name, prod.currentPrice, strat, suggestedPrice, +(lift * 100).toFixed(2), +(volumeImpact * 100).toFixed(2), revenueImpact, confidence, elasticity]
    );
  }
}
console.log(`  ✓ ${dpProducts.length * strategies.length} dynamic pricing scenarios inserted`);

await conn.end();
console.log('\n✅ All 7 module tables seeded successfully!');
