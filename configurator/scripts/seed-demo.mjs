/**
 * Demo seed script — populates realistic data across all views for demo purposes.
 * Run: node scripts/seed-demo.mjs
 */
import mysql from "mysql2/promise";
import { randomUUID } from "crypto";
import * as dotenv from "dotenv";
dotenv.config();

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error("DATABASE_URL not set");

// Parse mysql://user:pass@host:port/db
const url = new URL(DB_URL);
const conn = await mysql.createConnection({
  host: url.hostname,
  port: Number(url.port) || 3306,
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  ssl: { rejectUnauthorized: false },
});

console.log("Connected to database");

// ─── Helpers ──────────────────────────────────────────────────────────────────
const q = (sql, params = []) => conn.execute(sql, params);
const token = () => randomUUID().replace(/-/g, "").slice(0, 24);
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};
const daysFromNow = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};

// ─── 1. Clear existing demo data (keep schema intact) ─────────────────────────
console.log("Clearing existing demo data...");
await q("DELETE FROM quote_approvals WHERE workflowToken LIKE 'demo-%'");
await q("DELETE FROM quote_workflow_items WHERE workflowToken LIKE 'demo-%'");
await q("DELETE FROM quote_workflows WHERE workflowToken LIKE 'demo-%'");
await q("DELETE FROM quote_mgmt WHERE quoteId LIKE 'QM-DEMO-%'");

// ─── 2. Quote Workflows — 12 quotes in various stages ─────────────────────────
console.log("Seeding quote workflows...");

const workflows = [
  // Submitted / pending approval (will get approval chains)
  { token: "demo-qw-001", customer: "Lockheed Martin", tier: "Enterprise", region: "Southeast", channel: "OEM", industry: "Aerospace & Defense", deal: "New Business", urgency: "Expedite", margin: 38, status: "submitted", daysAgo: 1 },
  { token: "demo-qw-002", customer: "Boeing Defense", tier: "Enterprise", region: "Pacific Northwest", channel: "OEM", industry: "Aerospace & Defense", deal: "Renewal", urgency: "Standard", margin: 35, status: "submitted", daysAgo: 2 },
  { token: "demo-qw-003", customer: "Raytheon Technologies", tier: "Enterprise", region: "Northeast", channel: "OEM", industry: "Defense Electronics", deal: "Expansion", urgency: "Standard", margin: 40, status: "submitted", daysAgo: 3 },
  { token: "demo-qw-004", customer: "General Dynamics", tier: "Large", region: "Mid-Atlantic", channel: "OEM", industry: "Defense Systems", deal: "Repeat Business", urgency: "Emergency", margin: 32, status: "submitted", daysAgo: 1 },
  { token: "demo-qw-005", customer: "Northrop Grumman", tier: "Enterprise", region: "Southwest", channel: "OEM", industry: "Aerospace & Defense", deal: "New Business", urgency: "Standard", margin: 42, status: "submitted", daysAgo: 4 },
  // Draft
  { token: "demo-qw-006", customer: "L3Harris Technologies", tier: "Large", region: "Southeast", channel: "OEM", industry: "Defense Electronics", deal: "New Business", urgency: "Standard", margin: 36, status: "draft", daysAgo: 0 },
  { token: "demo-qw-007", customer: "BAE Systems", tier: "Large", region: "Northeast", channel: "Distribution", industry: "Defense Systems", deal: "Renewal", urgency: "Standard", margin: 34, status: "draft", daysAgo: 1 },
  // Won
  { token: "demo-qw-008", customer: "Honeywell Aerospace", tier: "Enterprise", region: "Southwest", channel: "OEM", industry: "Aerospace", deal: "Repeat Business", urgency: "Standard", margin: 39, status: "won", daysAgo: 14 },
  { token: "demo-qw-009", customer: "Collins Aerospace", tier: "Enterprise", region: "Midwest", channel: "OEM", industry: "Aerospace", deal: "Expansion", urgency: "Standard", margin: 41, status: "won", daysAgo: 21 },
  // Lost
  { token: "demo-qw-010", customer: "Textron Aviation", tier: "Mid", region: "Midwest", channel: "Distribution", industry: "Aviation", deal: "New Business", urgency: "Standard", margin: 30, status: "lost", daysAgo: 10 },
  // Quoted
  { token: "demo-qw-011", customer: "Curtiss-Wright", tier: "Mid", region: "Mid-Atlantic", channel: "OEM", industry: "Defense Electronics", deal: "New Business", urgency: "Expedite", margin: 37, status: "quoted", daysAgo: 5 },
  { token: "demo-qw-012", customer: "TransDigm Group", tier: "Large", region: "Midwest", channel: "OEM", industry: "Aerospace", deal: "Repeat Business", urgency: "Standard", margin: 38, status: "quoted", daysAgo: 7 },
];

for (const w of workflows) {
  const createdAt = daysAgo(w.daysAgo);
  await q(
    `INSERT INTO quote_workflows 
     (workflowToken, customerName, customerTier, customerRegion, customerChannel, customerIndustry,
      customerPriceIndex, customerMarginIndex, contactName, contactEmail,
      dealType, urgency, targetMarginPct, notes, status, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      w.token, w.customer, w.tier, w.region, w.channel, w.industry,
      0.95 + Math.random() * 0.1, 0.65 + Math.random() * 0.08,
      "John Smith", "jsmith@" + w.customer.toLowerCase().replace(/\s+/g, "") + ".com",
      w.deal, w.urgency, w.margin,
      `Strategic ${w.deal.toLowerCase()} opportunity for ${w.industry} segment.`,
      w.status, createdAt, createdAt,
    ]
  );
}

// ─── 3. Quote Workflow Items ───────────────────────────────────────────────────
console.log("Seeding quote workflow items...");

const itemSets = [
  { token: "demo-qw-001", items: [
    { type: "existing", part: "MS3106A-18-1S", desc: "Circular Connector, Plug, 18-1S", family: "MIL-DTL-5015", list: 142.50, quoted: 128.25, qty: 50 },
    { type: "existing", part: "MS3102A-22-14P", desc: "Circular Connector, Receptacle, 22-14P", family: "MIL-DTL-5015", list: 198.75, quoted: 175.00, qty: 25 },
    { type: "configured", part: "D38999/20WB35SN", desc: "Circular Connector, Jam Nut Receptacle, 35S", family: "MIL-DTL-38999", list: 385.00, quoted: 340.00, qty: 100 },
  ]},
  { token: "demo-qw-002", items: [
    { type: "existing", part: "D38999/26WB35PN", desc: "Circular Connector, Plug, 35P", family: "MIL-DTL-38999", list: 412.00, quoted: 370.80, qty: 200 },
    { type: "configured", part: "D38999/24WB35SN", desc: "Circular Connector, Receptacle, 35S", family: "MIL-DTL-38999", list: 395.00, quoted: 355.50, qty: 200 },
  ]},
  { token: "demo-qw-003", items: [
    { type: "existing", part: "MS3106A-14S-2S", desc: "Circular Connector, Plug, 14S-2S", family: "MIL-DTL-5015", list: 89.50, quoted: 78.00, qty: 500 },
    { type: "custom", part: "CUSTOM-ITT-38999-MOD", desc: "Modified 38999 with EMI filter insert", family: "MIL-DTL-38999", list: 650.00, quoted: 585.00, qty: 75 },
  ]},
  { token: "demo-qw-004", items: [
    { type: "existing", part: "D38999/20WB35SN", desc: "Circular Connector, Jam Nut Receptacle, 35S", family: "MIL-DTL-38999", list: 385.00, quoted: 320.00, qty: 1000 },
  ]},
  { token: "demo-qw-005", items: [
    { type: "configured", part: "D38999/26WB35PN", desc: "Circular Connector, Plug, 35P", family: "MIL-DTL-38999", list: 412.00, quoted: 380.00, qty: 300 },
    { type: "existing", part: "MS3106A-22-14S", desc: "Circular Connector, Receptacle, 22-14S", family: "MIL-DTL-5015", list: 195.00, quoted: 175.50, qty: 150 },
    { type: "existing", part: "MS3102A-18-1S", desc: "Circular Connector, Receptacle, 18-1S", family: "MIL-DTL-5015", list: 138.00, quoted: 124.20, qty: 150 },
  ]},
];

for (const set of itemSets) {
  for (let i = 0; i < set.items.length; i++) {
    const it = set.items[i];
    const target = it.quoted * 1.05;
    const floor = it.list * 0.72;
    await q(
      `INSERT INTO quote_workflow_items
       (workflowToken, itemType, partNumber, description, family, isStandardCatalog,
        listPrice, targetPrice, floorPrice, quotedPrice, quantity, priceConfidence, sortOrder)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        set.token, it.type, it.part, it.desc, it.family,
        it.type === "existing" ? 1 : 0,
        it.list.toFixed(2), target.toFixed(2), floor.toFixed(2), it.quoted.toFixed(2),
        it.qty, "High", i,
      ]
    );
  }
}

// ─── 4. Approval Chains — for all 5 submitted quotes ─────────────────────────
console.log("Seeding approval chains...");

const LEVELS = [
  { level: 1, role: "Sales Rep", title: "Sales Representative" },
  { level: 2, role: "Sales Manager", title: "Sales Manager" },
  { level: 3, role: "Regional Director", title: "Regional Sales Director" },
  { level: 4, role: "VP Sales", title: "Vice President of Sales" },
  { level: 5, role: "CFO", title: "Chief Financial Officer" },
];

// demo-qw-001: 10% avg discount → starts at L2, L1 auto-approved, L2 pending
const approvalScenarios = [
  {
    token: "demo-qw-001",
    // 10% avg discount → L2 entry
    levels: [
      { ...LEVELS[0], status: "approved", actedBy: "Sarah Chen", comments: "Approved per standard rep authority.", actedAt: daysAgo(1) },
      { ...LEVELS[1], status: "pending", assignedTo: "Mike Torres" },
      { ...LEVELS[2], status: "skipped" },
      { ...LEVELS[3], status: "skipped" },
      { ...LEVELS[4], status: "skipped" },
    ],
  },
  {
    token: "demo-qw-002",
    // 10% avg discount → L2 entry, L2 approved, L3 pending
    levels: [
      { ...LEVELS[0], status: "approved", actedBy: "Sarah Chen", comments: "Standard rep approval.", actedAt: daysAgo(2) },
      { ...LEVELS[1], status: "approved", actedBy: "Mike Torres", comments: "Renewal deal, customer in good standing. Approved.", actedAt: daysAgo(1) },
      { ...LEVELS[2], status: "pending", assignedTo: "Jennifer Walsh" },
      { ...LEVELS[3], status: "skipped" },
      { ...LEVELS[4], status: "skipped" },
    ],
  },
  {
    token: "demo-qw-003",
    // 16% avg discount → L3 entry, all lower skipped, L3 pending
    levels: [
      { ...LEVELS[0], status: "skipped" },
      { ...LEVELS[1], status: "skipped" },
      { ...LEVELS[2], status: "pending", assignedTo: "Jennifer Walsh" },
      { ...LEVELS[3], status: "skipped" },
      { ...LEVELS[4], status: "skipped" },
    ],
  },
  {
    token: "demo-qw-004",
    // Emergency deal, 17% discount → L3 entry, L3 approved, L4 pending
    levels: [
      { ...LEVELS[0], status: "skipped" },
      { ...LEVELS[1], status: "skipped" },
      { ...LEVELS[2], status: "approved", actedBy: "Jennifer Walsh", comments: "Emergency requirement — sole source. Approved.", actedAt: daysAgo(0) },
      { ...LEVELS[3], status: "pending", assignedTo: "Robert Kim" },
      { ...LEVELS[4], status: "skipped" },
    ],
  },
  {
    token: "demo-qw-005",
    // 8% avg discount → L2 entry, L2 pending
    levels: [
      { ...LEVELS[0], status: "approved", actedBy: "David Park", comments: "Approved.", actedAt: daysAgo(4) },
      { ...LEVELS[1], status: "pending", assignedTo: "Mike Torres" },
      { ...LEVELS[2], status: "skipped" },
      { ...LEVELS[3], status: "skipped" },
      { ...LEVELS[4], status: "skipped" },
    ],
  },
];

for (const scenario of approvalScenarios) {
  for (const lv of scenario.levels) {
    await q(
      `INSERT INTO quote_approvals
       (workflowToken, level, role, title, status, assignedTo, actedBy, actedAt, comments)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        scenario.token, lv.level, lv.role, lv.title, lv.status,
        lv.assignedTo ?? null, lv.actedBy ?? null,
        lv.actedAt ?? null, lv.comments ?? null,
      ]
    );
  }
}

// ─── 5. Quote Management records ──────────────────────────────────────────────
console.log("Seeding quotes_mgmt...");

const quoteMgmtRecords = [
  { id: "QM-DEMO-001", customer: "Lockheed Martin", contact: "James Whitfield", total: 87450.00, status: "Pending Approval", daysAgo: 1 },
  { id: "QM-DEMO-002", customer: "Boeing Defense", contact: "Patricia Nguyen", total: 152800.00, status: "Pending Approval", daysAgo: 2 },
  { id: "QM-DEMO-003", customer: "Raytheon Technologies", contact: "Carlos Rivera", total: 63200.00, status: "Pending Approval", daysAgo: 3 },
  { id: "QM-DEMO-004", customer: "General Dynamics", contact: "Susan Patel", total: 320000.00, status: "Pending Approval", daysAgo: 1 },
  { id: "QM-DEMO-005", customer: "Northrop Grumman", contact: "Thomas Okafor", total: 198750.00, status: "Pending Approval", daysAgo: 4 },
  { id: "QM-DEMO-006", customer: "L3Harris Technologies", contact: "Amanda Lee", total: 45600.00, status: "Draft", daysAgo: 0 },
  { id: "QM-DEMO-007", customer: "BAE Systems", contact: "Richard Moore", total: 78900.00, status: "Draft", daysAgo: 1 },
  { id: "QM-DEMO-008", customer: "Honeywell Aerospace", contact: "Linda Zhang", total: 234500.00, status: "Approved", daysAgo: 14 },
  { id: "QM-DEMO-009", customer: "Collins Aerospace", contact: "Mark Johnson", total: 189000.00, status: "Converted", daysAgo: 21 },
  { id: "QM-DEMO-010", customer: "Textron Aviation", contact: "Nancy Williams", total: 56700.00, status: "Rejected", daysAgo: 10 },
  { id: "QM-DEMO-011", customer: "Curtiss-Wright", contact: "Kevin Brown", total: 92300.00, status: "Auto-Approved", daysAgo: 5 },
  { id: "QM-DEMO-012", customer: "TransDigm Group", contact: "Michelle Davis", total: 143600.00, status: "Auto-Approved", daysAgo: 7 },
  { id: "QM-DEMO-013", customer: "Moog Inc.", contact: "Steven Martinez", total: 67800.00, status: "Expired", daysAgo: 35 },
  { id: "QM-DEMO-014", customer: "Heico Corporation", contact: "Laura Wilson", total: 38400.00, status: "Approved", daysAgo: 8 },
  { id: "QM-DEMO-015", customer: "DRS Technologies", contact: "Brian Taylor", total: 115200.00, status: "Approved", daysAgo: 12 },
];

const itemsTemplate = (total) => [
  { sku: "D38999/20WB35SN", description: "Circular Connector, 35S", qty: Math.ceil(total / 800), unitPrice: 385.00, discount: 12, total: Math.ceil(total * 0.6) },
  { sku: "MS3106A-18-1S", description: "Circular Connector, 18-1S", qty: Math.ceil(total / 400), unitPrice: 142.50, discount: 10, total: Math.ceil(total * 0.4) },
];

for (const r of quoteMgmtRecords) {
  const createdAt = daysAgo(r.daysAgo);
  const expiry = daysFromNow(30 - r.daysAgo);
  await q(
    `INSERT INTO quote_mgmt (quoteId, customerName, contactName, totalValue, status, items, notes, expiryDate, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      r.id, r.customer, r.contact, r.total.toFixed(2), r.status,
      JSON.stringify(itemsTemplate(r.total)),
      `Strategic quote for ${r.customer}. Competitive pricing applied.`,
      expiry, createdAt, createdAt,
    ]
  );
}

// ─── 6. Update AI model stats with recent run times ───────────────────────────
console.log("Updating AI model stats...");
await q(`UPDATE ai_model_stats SET lastRunAt = ?, totalPredictions = totalPredictions + 847, status = 'Active' WHERE modelType = 'price_optimization'`, [daysAgo(0)]);
await q(`UPDATE ai_model_stats SET lastRunAt = ?, totalPredictions = totalPredictions + 1243, status = 'Active' WHERE modelType = 'demand_forecasting'`, [daysAgo(1)]);
await q(`UPDATE ai_model_stats SET lastRunAt = ?, totalPredictions = totalPredictions + 512, status = 'Active' WHERE modelType = 'customer_analytics'`, [daysAgo(2)]);
await q(`UPDATE ai_model_stats SET lastRunAt = ?, totalPredictions = totalPredictions + 234, status = 'Active' WHERE modelType = 'anomaly_detection'`, [daysAgo(3)]);

// ─── 7. Summary ───────────────────────────────────────────────────────────────
const [wfRows] = await conn.execute("SELECT COUNT(*) as cnt FROM quote_workflows WHERE workflowToken LIKE 'demo-%'");
const [approvalRows] = await conn.execute("SELECT COUNT(*) as cnt FROM quote_approvals WHERE workflowToken LIKE 'demo-%'");
const [qmRows] = await conn.execute("SELECT COUNT(*) as cnt FROM quote_mgmt WHERE quoteId LIKE 'QM-DEMO-%'");

console.log("\n✅ Demo seed complete:");
console.log(`   Quote workflows: ${wfRows[1]?.["cnt"] ?? "?"}`);
console.log(`   Approval records: ${approvalRows[1]?.["cnt"] ?? "?"}`);
console.log(`   Quote mgmt records: ${qmRows[1]?.["cnt"] ?? "?"}`);

await conn.end();
