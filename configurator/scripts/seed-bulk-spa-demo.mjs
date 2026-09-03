import XLSX from "xlsx";
import {
  calculateBulkOpportunityDealScore,
  createBulkQuoteOpportunity,
  getBulkOpportunityItems,
  importBulkQuoteOpportunityLines,
  listBulkQuoteOpportunities,
  priceBulkQuoteOpportunity,
} from "../server/bulkOpportunityDb.ts";

const SOURCE = "/home/ubuntu/upload/CollinsCornelius_WorksheetV3.xlsb";
const DEMO_NAME = "Collins Cornelius Historic SPA — Imported Review";

function asNumber(value) {
  const parsed = Number(String(value ?? "").replace(/[$,%\s,]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function sourceValue(row, header) {
  const key = Object.keys(row).find((candidate) => candidate.trim().toLowerCase() === header.toLowerCase());
  return key ? row[key] : null;
}

function cleanPart(value) {
  const part = String(value ?? "").trim();
  return part && !["TBA", "TBD", "N/A", "—", "-"].includes(part.toUpperCase()) ? part : null;
}

const existing = await listBulkQuoteOpportunities();
const previous = existing.find((opportunity) => opportunity.name === DEMO_NAME);
if (previous) {
  console.log(`Existing demo opportunity retained: ${previous.opportunityToken}`);
  process.exit(0);
}

const workbook = XLSX.readFile(SOURCE, { cellDates: true });
const bidWorksheet = XLSX.utils.sheet_to_json(workbook.Sheets["Bid Worksheet"], { defval: "", raw: false });
const sapXref = XLSX.utils.sheet_to_json(workbook.Sheets["SAP XREF"], { defval: "", raw: false });
const xrefByCustomerPart = new Map(
  sapXref.map((row) => [String(sourceValue(row, "Customer Material Number") ?? "").trim(), row]),
);

const lines = bidWorksheet
  .filter((row) => String(row["Collins Part Number"] ?? "").trim())
  .slice(0, 60)
  .map((row, index) => {
    const customerPart = String(row["Collins Part Number"] ?? "").trim();
    const xref = xrefByCustomerPart.get(customerPart) ?? {};
    return {
      sourceRow: index + 2,
      sourcePartNumber: customerPart,
      requestedPartNumber: customerPart,
      ittPartNumber: cleanPart(row["ITT Part Number"]) || cleanPart(sourceValue(xref, "SAP Material")),
      description: String(row["ITT Description"] ?? row["Part Description"] ?? sourceValue(xref, "Material Description") ?? "").trim() || null,
      family: String(row["Product Line"] ?? "").trim() || null,
      productLine: String(row["Sub Product Line"] ?? row["Product Line"] ?? "").trim() || null,
      customerRevision: String(row.Rev ?? "").trim() || null,
      quantity: asNumber(row["Annual Usage"]) ?? asNumber(row["Year 1 EAU"]),
      annualUsage: asNumber(row["Annual Usage"]) ?? asNumber(row["Year 1 EAU"]),
      minimumOrderQty: asNumber(sourceValue(xref, "MinOrdQty")),
      leadTimeWeeks: asNumber(sourceValue(xref, "L/T")),
      standardCost: asNumber(sourceValue(xref, "Std. Cost")),
      projectedCost: asNumber(row["Forward Cost"]) ?? asNumber(row["2025 Est Cost"]),
      listPrice: asNumber(row["Bid Price"]) ?? asNumber(sourceValue(xref, "Book Price")),
      currentAwardPrice: asNumber(row["Award Price"]) ?? asNumber(row["Current LTA Price"]),
      currentAwardMoq: asNumber(row["Award MOQ"]) ?? asNumber(row["Current LTA MOQ"]),
      vendorCount: asNumber(row.Vendors),
      sourceData: {
        ...row,
        ...xref,
        __sourceSystems: "Bid Worksheet + SAP XREF",
      },
    };
  });

const opportunity = await createBulkQuoteOpportunity({
  name: DEMO_NAME,
  customerName: "Collins Aerospace",
  customerTier: "Enterprise",
  quoteChannel: "OEM",
  quoteToCustomerSpec: true,
  customerSpecReference: "Historic Collins Cornelius SPA workup",
  sourcingPosition: "mixed",
  targetMarginPct: 35,
  recentQuoteSummary: "Historic SPA worksheet supplied for import validation.",
  bookingEvidence: "Historical booking and POS tabs are available in the supplied source workbook.",
  posValidation: "not_applicable",
  costValidationNotes: "Cost, lead time, and manufacturing data are enriched from the SAP XREF tab; projected volume costs remain review inputs.",
  sourceFileName: "CollinsCornelius_WorksheetV3.xlsb",
  sourceFormat: "worksheet",
  sourceSheet: "Bid Worksheet",
  createdBy: "Demo Import",
});

await importBulkQuoteOpportunityLines(opportunity.opportunityToken, lines, "Demo Import");
const pricing = await priceBulkQuoteOpportunity(opportunity.opportunityToken, "Demo Import");
const score = await calculateBulkOpportunityDealScore(opportunity.opportunityToken);
const items = await getBulkOpportunityItems(opportunity.opportunityToken);

console.log(JSON.stringify({
  opportunityToken: opportunity.opportunityToken,
  imported: lines.length,
  pricing,
  score: { score: score.score, band: score.scoreBand, confidence: score.confidence },
  itemsWithStandardCost: items.filter((item) => Number(item.standardCost) > 0).length,
  itemsNeedingCorrection: items.filter((item) => item.reviewStatus === "invalid").length,
}, null, 2));
process.exit(0);
