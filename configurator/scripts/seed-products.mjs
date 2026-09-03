/**
 * Seed script: loads all products from pasted_content.txt into the database
 * and seeds pricing_rules with default values per family.
 * Run: node scripts/seed-products.mjs
 */

import fs from "fs";
import path from "path";
import { createConnection } from "mysql2/promise";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Family detection map ──────────────────────────────────────────────────────
// Maps description prefix → family code
const FAMILY_PREFIXES = [
  ["FRCIR", "FRCIR"],
  ["CIRG", "FRCIR"],
  ["CIRS", "FRCIR"],
  ["CIR", "CIR"],
  ["KJB", "38999"],
  ["KJL", "38999"],
  ["KJA", "38999"],
  ["KPT", "KPT"],
  ["KPSE", "KPT"],
  ["KPDR", "KPT"],
  ["MS3", "MS"],
  ["MS27", "MS"],
  ["CA3", "CA"],
  ["DPX2", "DPX"],
  ["DPX", "DPX"],
  ["DPD", "DPX"],
  ["DPK", "DPX"],
  ["DBM", "DBM"],
  ["DAM", "DBM"],
  ["DEM", "DBM"],
  ["DCM", "DBM"],
  ["MKJ", "MKJ"],
  ["NMKJ", "MKJ"],
  ["VBN", "VBN"],
  ["VPT", "VPT"],
  ["CVPT", "VPT"],
  ["VS", "VS"],
  ["VE", "VS"],
  ["BKAD", "BKAD"],
  ["TKJ", "TKJ"],
  ["TD", "TKJ"],
  ["VRPC", "Trident"],
  ["FOHC", "Fiber Optics"],
  ["GS0", "Hermetics"],
  ["DCI", "EV"],
  ["HDX", "HDx"],
];

function detectFamily(description, line, series) {
  const upper = description.toUpperCase();
  for (const [prefix, family] of FAMILY_PREFIXES) {
    if (upper.startsWith(prefix)) return family;
  }
  // Fall back to line-based detection
  if (line.includes("38999")) return "38999";
  if (line.includes("26482")) return "KPT";
  if (line.includes("CIR") || line.includes("Veam CIR")) return "CIR";
  if (line.includes("CA Bayonet")) return "CA";
  if (line.includes("5015")) return "MS";
  if (line.includes("Rack & Panel")) return "DPX";
  if (line.includes("D Sub")) return "DBM";
  if (line.includes("Trinity MKJ")) return "MKJ";
  if (line.includes("VBN")) return "VBN";
  if (line.includes("VPT")) return "VPT";
  if (line.includes("BKAD")) return "BKAD";
  if (line.includes("TKJ")) return "TKJ";
  if (line.includes("Trident")) return "Trident";
  if (series === "Micro") return "Micro";
  if (series === "RF") return "RF";
  if (series === "Tools") return "Tools";
  if (series === "Transportation") return "Transportation";
  if (series === "Hermetics") return "Hermetics";
  if (series === "Filters") return "Filters";
  if (series === "DL") return "DL";
  if (series === "HDx") return "HDx";
  if (series === "EV") return "EV";
  if (series === "Fiber Optics") return "Fiber Optics";
  return series || "Other";
}

// ── Default pricing rules per family ─────────────────────────────────────────
const DEFAULT_PRICING = [
  // family, shellSize, contactType, material, basePrice, customUpchargePct
  // 38999 / KJB
  { family: "38999", shellSize: "09", contactType: "P", material: null, basePrice: "45.00", customUpchargePct: "30.00" },
  { family: "38999", shellSize: "11", contactType: "P", material: null, basePrice: "52.00", customUpchargePct: "30.00" },
  { family: "38999", shellSize: "13", contactType: "P", material: null, basePrice: "68.00", customUpchargePct: "30.00" },
  { family: "38999", shellSize: "15", contactType: "P", material: null, basePrice: "85.00", customUpchargePct: "30.00" },
  { family: "38999", shellSize: "17", contactType: "P", material: null, basePrice: "105.00", customUpchargePct: "30.00" },
  { family: "38999", shellSize: "19", contactType: "P", material: null, basePrice: "125.00", customUpchargePct: "30.00" },
  { family: "38999", shellSize: "21", contactType: "P", material: null, basePrice: "148.00", customUpchargePct: "30.00" },
  { family: "38999", shellSize: "23", contactType: "P", material: null, basePrice: "172.00", customUpchargePct: "30.00" },
  { family: "38999", shellSize: "25", contactType: "P", material: null, basePrice: "198.00", customUpchargePct: "30.00" },
  // KPT
  { family: "KPT", shellSize: "08", contactType: "P", material: null, basePrice: "28.00", customUpchargePct: "25.00" },
  { family: "KPT", shellSize: "10", contactType: "P", material: null, basePrice: "34.00", customUpchargePct: "25.00" },
  { family: "KPT", shellSize: "12", contactType: "P", material: null, basePrice: "42.00", customUpchargePct: "25.00" },
  { family: "KPT", shellSize: "14", contactType: "P", material: null, basePrice: "55.00", customUpchargePct: "25.00" },
  { family: "KPT", shellSize: "16", contactType: "P", material: null, basePrice: "68.00", customUpchargePct: "25.00" },
  { family: "KPT", shellSize: "18", contactType: "P", material: null, basePrice: "82.00", customUpchargePct: "25.00" },
  { family: "KPT", shellSize: "20", contactType: "P", material: null, basePrice: "98.00", customUpchargePct: "25.00" },
  { family: "KPT", shellSize: "22", contactType: "P", material: null, basePrice: "115.00", customUpchargePct: "25.00" },
  { family: "KPT", shellSize: "24", contactType: "P", material: null, basePrice: "135.00", customUpchargePct: "25.00" },
  // CIR
  { family: "CIR", shellSize: "8", contactType: "P", material: null, basePrice: "18.00", customUpchargePct: "25.00" },
  { family: "CIR", shellSize: "12", contactType: "P", material: null, basePrice: "22.00", customUpchargePct: "25.00" },
  { family: "CIR", shellSize: "14", contactType: "P", material: null, basePrice: "28.00", customUpchargePct: "25.00" },
  { family: "CIR", shellSize: "16", contactType: "P", material: null, basePrice: "35.00", customUpchargePct: "25.00" },
  { family: "CIR", shellSize: "18", contactType: "P", material: null, basePrice: "42.00", customUpchargePct: "25.00" },
  { family: "CIR", shellSize: "20", contactType: "P", material: null, basePrice: "52.00", customUpchargePct: "25.00" },
  { family: "CIR", shellSize: "22", contactType: "P", material: null, basePrice: "62.00", customUpchargePct: "25.00" },
  { family: "CIR", shellSize: "24", contactType: "P", material: null, basePrice: "75.00", customUpchargePct: "25.00" },
  { family: "CIR", shellSize: "28", contactType: "P", material: null, basePrice: "92.00", customUpchargePct: "25.00" },
  { family: "CIR", shellSize: "32", contactType: "P", material: null, basePrice: "115.00", customUpchargePct: "25.00" },
  { family: "CIR", shellSize: "36", contactType: "P", material: null, basePrice: "142.00", customUpchargePct: "25.00" },
  { family: "CIR", shellSize: "40", contactType: "P", material: null, basePrice: "175.00", customUpchargePct: "25.00" },
  { family: "CIR", shellSize: "48", contactType: "P", material: null, basePrice: "215.00", customUpchargePct: "25.00" },
  // FRCIR
  { family: "FRCIR", shellSize: "12", contactType: "P", material: null, basePrice: "65.00", customUpchargePct: "35.00" },
  { family: "FRCIR", shellSize: "16", contactType: "P", material: null, basePrice: "85.00", customUpchargePct: "35.00" },
  { family: "FRCIR", shellSize: "20", contactType: "P", material: null, basePrice: "105.00", customUpchargePct: "35.00" },
  { family: "FRCIR", shellSize: "24", contactType: "P", material: null, basePrice: "128.00", customUpchargePct: "35.00" },
  { family: "FRCIR", shellSize: "28", contactType: "P", material: null, basePrice: "155.00", customUpchargePct: "35.00" },
  { family: "FRCIR", shellSize: "32", contactType: "P", material: null, basePrice: "188.00", customUpchargePct: "35.00" },
  { family: "FRCIR", shellSize: "36", contactType: "P", material: null, basePrice: "225.00", customUpchargePct: "35.00" },
  { family: "FRCIR", shellSize: "40", contactType: "P", material: null, basePrice: "268.00", customUpchargePct: "35.00" },
  // CA
  { family: "CA", shellSize: "10", contactType: "P", material: null, basePrice: "32.00", customUpchargePct: "25.00" },
  { family: "CA", shellSize: "14", contactType: "P", material: null, basePrice: "48.00", customUpchargePct: "25.00" },
  { family: "CA", shellSize: "18", contactType: "P", material: null, basePrice: "72.00", customUpchargePct: "25.00" },
  { family: "CA", shellSize: "22", contactType: "P", material: null, basePrice: "98.00", customUpchargePct: "25.00" },
  { family: "CA", shellSize: "28", contactType: "P", material: null, basePrice: "135.00", customUpchargePct: "25.00" },
  // MS
  { family: "MS", shellSize: "10", contactType: "P", material: null, basePrice: "24.00", customUpchargePct: "20.00" },
  { family: "MS", shellSize: "14", contactType: "P", material: null, basePrice: "35.00", customUpchargePct: "20.00" },
  { family: "MS", shellSize: "18", contactType: "P", material: null, basePrice: "52.00", customUpchargePct: "20.00" },
  { family: "MS", shellSize: "22", contactType: "P", material: null, basePrice: "72.00", customUpchargePct: "20.00" },
  { family: "MS", shellSize: "28", contactType: "P", material: null, basePrice: "98.00", customUpchargePct: "20.00" },
  { family: "MS", shellSize: "32", contactType: "P", material: null, basePrice: "125.00", customUpchargePct: "20.00" },
  // DPX
  { family: "DPX", shellSize: "8", contactType: "P", material: null, basePrice: "55.00", customUpchargePct: "30.00" },
  { family: "DPX", shellSize: "17", contactType: "P", material: null, basePrice: "78.00", customUpchargePct: "30.00" },
  { family: "DPX", shellSize: "25", contactType: "P", material: null, basePrice: "105.00", customUpchargePct: "30.00" },
  { family: "DPX", shellSize: "37", contactType: "P", material: null, basePrice: "138.00", customUpchargePct: "30.00" },
  { family: "DPX", shellSize: "57", contactType: "P", material: null, basePrice: "178.00", customUpchargePct: "30.00" },
  { family: "DPX", shellSize: "67", contactType: "P", material: null, basePrice: "215.00", customUpchargePct: "30.00" },
  // DBM
  { family: "DBM", shellSize: "9", contactType: "P", material: null, basePrice: "12.00", customUpchargePct: "20.00" },
  { family: "DBM", shellSize: "15", contactType: "P", material: null, basePrice: "16.00", customUpchargePct: "20.00" },
  { family: "DBM", shellSize: "25", contactType: "P", material: null, basePrice: "22.00", customUpchargePct: "20.00" },
  { family: "DBM", shellSize: "37", contactType: "P", material: null, basePrice: "32.00", customUpchargePct: "20.00" },
  { family: "DBM", shellSize: "44", contactType: "P", material: null, basePrice: "45.00", customUpchargePct: "20.00" },
  // MKJ
  { family: "MKJ", shellSize: null, contactType: "P", material: null, basePrice: "185.00", customUpchargePct: "40.00" },
  // VBN
  { family: "VBN", shellSize: "16", contactType: null, material: null, basePrice: "28.00", customUpchargePct: "25.00" },
  { family: "VBN", shellSize: "20", contactType: null, material: null, basePrice: "35.00", customUpchargePct: "25.00" },
  { family: "VBN", shellSize: "28", contactType: null, material: null, basePrice: "48.00", customUpchargePct: "25.00" },
  { family: "VBN", shellSize: "40", contactType: null, material: null, basePrice: "68.00", customUpchargePct: "25.00" },
  // VS
  { family: "VS", shellSize: null, contactType: "P", material: null, basePrice: "42.00", customUpchargePct: "25.00" },
  // VPT
  { family: "VPT", shellSize: "10", contactType: "P", material: null, basePrice: "95.00", customUpchargePct: "30.00" },
  { family: "VPT", shellSize: "14", contactType: "P", material: null, basePrice: "125.00", customUpchargePct: "30.00" },
  { family: "VPT", shellSize: "16", contactType: "P", material: null, basePrice: "155.00", customUpchargePct: "30.00" },
  // BKAD
  { family: "BKAD", shellSize: null, contactType: null, material: null, basePrice: "38.00", customUpchargePct: "25.00" },
  // TKJ
  { family: "TKJ", shellSize: "16", contactType: null, material: null, basePrice: "72.00", customUpchargePct: "30.00" },
  { family: "TKJ", shellSize: "20", contactType: null, material: null, basePrice: "88.00", customUpchargePct: "30.00" },
  { family: "TKJ", shellSize: "24", contactType: null, material: null, basePrice: "105.00", customUpchargePct: "30.00" },
  { family: "TKJ", shellSize: "32", contactType: null, material: null, basePrice: "128.00", customUpchargePct: "30.00" },
];

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }

  const conn = await createConnection(dbUrl);
  console.log("Connected to database");

  // ── Seed pricing rules ──────────────────────────────────────────────────────
  console.log("Seeding pricing rules...");
  await conn.execute("DELETE FROM pricing_rules");
  for (const rule of DEFAULT_PRICING) {
    await conn.execute(
      `INSERT INTO pricing_rules (family, shellSize, contactType, material, basePrice, customUpchargePct)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [rule.family, rule.shellSize || null, rule.contactType || null, rule.material || null, rule.basePrice, rule.customUpchargePct]
    );
  }
  console.log(`Seeded ${DEFAULT_PRICING.length} pricing rules`);

  // ── Seed products ───────────────────────────────────────────────────────────
  const catalogPath = path.resolve("/home/ubuntu/upload/pasted_content.txt");
  if (!fs.existsSync(catalogPath)) {
    console.error("pasted_content.txt not found at", catalogPath);
    process.exit(1);
  }

  console.log("Loading product catalog...");
  const content = fs.readFileSync(catalogPath, "utf8");
  const lines = content.split("\n");

  // Check existing count
  const [countResult] = await conn.execute("SELECT COUNT(*) as cnt FROM products");
  const existingCount = countResult[0].cnt;
  if (existingCount > 0) {
    console.log(`Products table already has ${existingCount} rows — skipping seed`);
    await conn.end();
    return;
  }

  const BATCH_SIZE = 500;
  let batch = [];
  let total = 0;
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const cols = line.split("\t");
    if (cols.length < 4) { skipped++; continue; }

    const description = (cols[0] || "").trim().substring(0, 255);
    const globalPn = (cols[1] || "").trim().substring(0, 64);
    const regionalPn = (cols[2] || "").trim().substring(0, 64);
    const stripped = (cols[3] || "").trim().substring(0, 255);
    const series = (cols[4] || "").trim().substring(0, 64);
    const productLine = (cols[5] || "").trim().substring(0, 128);

    if (!description) { skipped++; continue; }

    const family = detectFamily(description, productLine, series);

    batch.push([description, globalPn || null, regionalPn || null, stripped || null, series || null, productLine || null, family]);

    if (batch.length >= BATCH_SIZE) {
      const placeholders = batch.map(() => "(?,?,?,?,?,?,?)").join(",");
      const flat = batch.flat();
      await conn.execute(
        `INSERT INTO products (description, globalPn, regionalPn, stripped, series, line, family) VALUES ${placeholders}`,
        flat
      );
      total += batch.length;
      batch = [];
      if (total % 10000 === 0) console.log(`  Inserted ${total} products...`);
    }
  }

  if (batch.length > 0) {
    const placeholders = batch.map(() => "(?,?,?,?,?,?,?)").join(",");
    const flat = batch.flat();
    await conn.execute(
      `INSERT INTO products (description, globalPn, regionalPn, stripped, series, line, family) VALUES ${placeholders}`,
      flat
    );
    total += batch.length;
  }

  console.log(`Done! Inserted ${total} products (skipped ${skipped})`);
  await conn.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
