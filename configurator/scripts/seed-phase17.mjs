/**
 * Phase 17 demo seed: customer_agreements, price_change_audit, channel_compliance,
 * and quote expiration dates on existing quote_workflows.
 */
import mysql from "mysql2/promise";

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) { console.error("DATABASE_URL not set"); process.exit(1); }

function parseDbUrl(url) {
  const u = new URL(url);
  return {
    host: u.hostname, port: parseInt(u.port || "3306"),
    user: u.username, password: u.password,
    database: u.pathname.slice(1),
    ssl: { rejectUnauthorized: false },
  };
}

const conn = await mysql.createConnection(parseDbUrl(DB_URL));

// ── 1. Update existing quote_workflows with effective/expiration dates ─────────
const [workflows] = await conn.query("SELECT id, workflowToken, status, createdAt FROM quote_workflows LIMIT 30");
const today = new Date();
for (const wf of workflows) {
  const created = new Date(wf.createdAt);
  const effectiveDate = created.toISOString().slice(0, 10);
  // Vary expiry: some already expired, some expiring soon, some future
  const daysToAdd = wf.status === "won" || wf.status === "lost" ? -30 :
                    wf.id % 5 === 0 ? 2 :   // expiring in 2 days
                    wf.id % 5 === 1 ? 7 :   // expiring in 7 days
                    wf.id % 5 === 2 ? -5 :  // already expired
                    wf.id % 5 === 3 ? 45 :  // future
                    90;                      // future
  const expDate = new Date(today);
  expDate.setDate(expDate.getDate() + daysToAdd);
  const expirationDate = expDate.toISOString().slice(0, 10);
  const validityDays = 30;
  await conn.query(
    "UPDATE quote_workflows SET effectiveDate=?, expirationDate=?, validityDays=? WHERE id=?",
    [effectiveDate, expirationDate, validityDays, wf.id]
  );
}
console.log(`✓ Updated ${workflows.length} quote workflows with expiry dates`);

// ── 2. Customer Pricing Agreements ────────────────────────────────────────────
const agreements = [
  { customerName: "Lockheed Martin", customerTier: "Enterprise", channel: "OEM", productFamily: "KJB", partNumber: null,
    floorPrice: "42.50", targetPrice: "48.75", ceilingPrice: "55.00", maxDiscountPct: 12.5,
    effectiveDate: "2026-01-01", expirationDate: "2026-12-31", autoRenew: 1, renewalNoticeDays: 60,
    status: "active", approvedBy: "VP Sales", notes: "Annual frame agreement — MIL-DTL-38999 Series III" },
  { customerName: "Boeing Defense", customerTier: "Enterprise", channel: "OEM", productFamily: "KPT", partNumber: null,
    floorPrice: "28.00", targetPrice: "32.50", ceilingPrice: "38.00", maxDiscountPct: 10.0,
    effectiveDate: "2026-03-01", expirationDate: "2027-02-28", autoRenew: 0, renewalNoticeDays: 30,
    status: "active", approvedBy: "Regional Director", notes: "F-35 program pricing" },
  { customerName: "Raytheon Technologies", customerTier: "Enterprise", channel: "OEM", productFamily: "CIR", partNumber: null,
    floorPrice: "18.75", targetPrice: "22.00", ceilingPrice: "26.50", maxDiscountPct: 15.0,
    effectiveDate: "2026-02-15", expirationDate: "2026-08-14", autoRenew: 1, renewalNoticeDays: 45,
    status: "active", approvedBy: "VP Sales", notes: "Radar systems program — expires in 9 days" },
  { customerName: "General Dynamics", customerTier: "Enterprise", channel: "OEM", productFamily: "FRCIR", partNumber: null,
    floorPrice: "35.00", targetPrice: "41.00", ceilingPrice: "48.00", maxDiscountPct: 8.0,
    effectiveDate: "2025-07-01", expirationDate: "2026-06-30", autoRenew: 0, renewalNoticeDays: 30,
    status: "expired", approvedBy: "Sales Manager", notes: "Expired — renewal in progress" },
  { customerName: "Northrop Grumman", customerTier: "Enterprise", channel: "OEM", productFamily: "CA", partNumber: null,
    floorPrice: "22.00", targetPrice: "26.50", ceilingPrice: "31.00", maxDiscountPct: 12.0,
    effectiveDate: "2026-06-01", expirationDate: "2027-05-31", autoRenew: 1, renewalNoticeDays: 60,
    status: "active", approvedBy: "CFO", notes: "B-21 Raider program" },
  { customerName: "L3Harris Technologies", customerTier: "Large", channel: "OEM", productFamily: "MS", partNumber: null,
    floorPrice: "15.50", targetPrice: "18.75", ceilingPrice: "22.00", maxDiscountPct: 18.0,
    effectiveDate: "2026-04-01", expirationDate: "2026-10-01", autoRenew: 0, renewalNoticeDays: 30,
    status: "active", approvedBy: "Sales Manager", notes: "EW systems connectors" },
  { customerName: "BAE Systems", customerTier: "Large", channel: "Distribution", productFamily: "DPX", partNumber: null,
    floorPrice: "8.25", targetPrice: "10.50", ceilingPrice: "13.00", maxDiscountPct: 20.0,
    effectiveDate: "2026-01-15", expirationDate: "2026-07-14", autoRenew: 1, renewalNoticeDays: 30,
    status: "active", approvedBy: "Regional Director", notes: "UK distribution agreement" },
  { customerName: "Honeywell Aerospace", customerTier: "Large", channel: "OEM", productFamily: "DBM", partNumber: null,
    floorPrice: "12.00", targetPrice: "14.50", ceilingPrice: "17.00", maxDiscountPct: 15.0,
    effectiveDate: "2026-05-01", expirationDate: "2027-04-30", autoRenew: 1, renewalNoticeDays: 45,
    status: "pending", approvedBy: null, notes: "Pending VP approval" },
  { customerName: "Textron Aviation", customerTier: "Mid", channel: "Distribution", productFamily: "KJB", partNumber: "KJB6E14N98PN",
    floorPrice: "44.00", targetPrice: "50.00", ceilingPrice: "58.00", maxDiscountPct: 10.0,
    effectiveDate: "2026-03-01", expirationDate: "2026-09-01", autoRenew: 0, renewalNoticeDays: 30,
    status: "active", approvedBy: "Sales Manager", notes: "Part-specific agreement for Cessna program" },
  { customerName: "Collins Aerospace", customerTier: "Enterprise", channel: "OEM", productFamily: "VBN", partNumber: null,
    floorPrice: "65.00", targetPrice: "75.00", ceilingPrice: "88.00", maxDiscountPct: 8.0,
    effectiveDate: "2026-01-01", expirationDate: "2026-12-31", autoRenew: 1, renewalNoticeDays: 60,
    status: "active", approvedBy: "CFO", notes: "Avionics connector frame agreement" },
];

for (const a of agreements) {
  await conn.query(
    `INSERT INTO customer_agreements (customerName, customerTier, channel, productFamily, partNumber,
     floorPrice, targetPrice, ceilingPrice, maxDiscountPct, effectiveDate, expirationDate,
     autoRenew, renewalNoticeDays, status, approvedBy, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [a.customerName, a.customerTier, a.channel, a.productFamily, a.partNumber,
     a.floorPrice, a.targetPrice, a.ceilingPrice, a.maxDiscountPct, a.effectiveDate, a.expirationDate,
     a.autoRenew, a.renewalNoticeDays, a.status, a.approvedBy, a.notes]
  );
}
console.log(`✓ Inserted ${agreements.length} customer pricing agreements`);

// ── 3. Price Change Audit Log ─────────────────────────────────────────────────
const [priceItems] = await conn.query("SELECT id, sku, productName FROM price_list_items LIMIT 15");
const users = ["Sarah Chen", "Mike Torres", "Jennifer Walsh", "David Kim", "Rachel Patel"];
const reasons = [
  "Annual list price review — material cost increase",
  "Competitive repositioning — Amphenol price drop detected",
  "Margin recovery — below floor threshold",
  "Customer agreement renewal — volume commitment",
  "Tariff pass-through — 232 steel tariff",
  "AI optimization recommendation approved",
  "Q3 pricing committee decision",
  "Cost-plus recalculation after BOM update",
];

for (let i = 0; i < Math.min(priceItems.length, 12); i++) {
  const item = priceItems[i];
  const oldPrice = (20 + Math.random() * 80).toFixed(2);
  const changePct = (Math.random() * 20 - 5); // -5% to +15%
  const newPrice = (parseFloat(oldPrice) * (1 + changePct / 100)).toFixed(2);
  const daysAgo = Math.floor(Math.random() * 90);
  const changedAt = new Date(today);
  changedAt.setDate(changedAt.getDate() - daysAgo);
  await conn.query(
    `INSERT INTO price_change_audit (entityType, entityId, entityLabel, field, oldValue, newValue, changePct, changedBy, reason, changedAt)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    ["price_list_item", item.id, item.sku ?? item.productName,
     "listPrice", `$${oldPrice}`, `$${newPrice}`, parseFloat(changePct.toFixed(2)),
     users[i % users.length], reasons[i % reasons.length], changedAt]
  );
}
// Add some product-level changes
const [products] = await conn.query("SELECT id, globalPn, description FROM products LIMIT 5");
for (let i = 0; i < products.length; i++) {
  const prod = products[i];
  const oldCost = (8 + Math.random() * 30).toFixed(2);
  const changePct = 3 + Math.random() * 8;
  const newCost = (parseFloat(oldCost) * (1 + changePct / 100)).toFixed(2);
  const daysAgo = Math.floor(Math.random() * 60);
  const changedAt = new Date(today);
  changedAt.setDate(changedAt.getDate() - daysAgo);
  await conn.query(
    `INSERT INTO price_change_audit (entityType, entityId, entityLabel, field, oldValue, newValue, changePct, changedBy, reason, changedAt)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [     "product", prod.id, prod.globalPn ?? prod.description,
     "standardCost", `$${oldCost}`, `$${newCost}`, parseFloat(changePct.toFixed(2)),
     users[i % users.length], "Raw material cost index update — Q2 2026", changedAt]
  );
}
console.log("✓ Inserted price change audit log entries");

// ── 4. Channel Compliance Events ─────────────────────────────────────────────
const [qwRows] = await conn.query(
  "SELECT workflowToken, customerId, customerName, customerChannel, createdAt FROM quote_workflows WHERE status IN ('submitted','quoted','won','lost') LIMIT 20"
);
const families = ["KJB", "KPT", "CIR", "FRCIR", "CA", "MS"];
const partNumbers = ["KJB6E14N98PN", "KPT3E12N12PN", "CIR06F14S2P", "FRCIR06F14S2P", "CA3102E14S2P", "MS3102A14S2P"];

for (let i = 0; i < qwRows.length; i++) {
  const qw = qwRows[i];
  const family = families[i % families.length];
  const partNumber = partNumbers[i % partNumbers.length];
  const listPrice = 20 + Math.random() * 80;
  const discountPct = 5 + Math.random() * 20;
  const quotedPrice = listPrice * (1 - discountPct / 100);
  const authorisedFloor = listPrice * 0.75;
  const authorisedCeiling = listPrice * 0.98;
  const compliant = quotedPrice >= authorisedFloor && quotedPrice <= authorisedCeiling;
  const violationType = !compliant
    ? (quotedPrice < authorisedFloor ? "below_floor" : "above_ceiling")
    : "compliant";
  await conn.query(
    `INSERT INTO channel_compliance (quoteToken, customerId, customerName, channel, partNumber, productFamily,
     quotedPrice, listPrice, authorisedFloor, authorisedCeiling, discountPct, compliant, violationType, quoteDate)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [qw.workflowToken, qw.customerId, qw.customerName, qw.customerChannel ?? "OEM",
     partNumber, family, quotedPrice.toFixed(2), listPrice.toFixed(2),
     authorisedFloor.toFixed(2), authorisedCeiling.toFixed(2), discountPct.toFixed(2),
     compliant ? 1 : 0, violationType, new Date(qw.createdAt)]
  );
}
console.log(`✓ Inserted ${qwRows.length} channel compliance events`);

// ── Summary ───────────────────────────────────────────────────────────────────
const [[{ agreements: agCount }]] = await conn.query("SELECT COUNT(*) AS agreements FROM customer_agreements");
const [[{ audit: auditCount }]] = await conn.query("SELECT COUNT(*) AS audit FROM price_change_audit");
const [[{ compliance: ccCount }]] = await conn.query("SELECT COUNT(*) AS compliance FROM channel_compliance");
const [[{ violations }]] = await conn.query("SELECT COUNT(*) AS violations FROM channel_compliance WHERE compliant=0");
const [[{ expiring }]] = await conn.query(
  `SELECT COUNT(*) AS expiring FROM quote_workflows WHERE expirationDate IS NOT NULL AND DATE(expirationDate) BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 10 DAY)`
);

console.log("\n── Phase 17 Seed Summary ──");
console.log(`  Customer Agreements : ${agCount}`);
console.log(`  Price Audit Entries : ${auditCount}`);
console.log(`  Compliance Events   : ${ccCount} (${violations} violations)`);
console.log(`  Quotes Expiring ≤10d: ${expiring}`);

await conn.end();
