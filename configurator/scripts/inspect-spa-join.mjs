import XLSX from "xlsx";

const workbook = XLSX.readFile("/home/ubuntu/upload/CollinsCornelius_WorksheetV3.xlsb", { cellDates: true });
const rfq = XLSX.utils.sheet_to_json(workbook.Sheets.RFQ, { defval: "", raw: false });
const sapXref = XLSX.utils.sheet_to_json(workbook.Sheets["SAP XREF"], { defval: "", raw: false });
const keys = new Set(sapXref.map((row) => String(row["Customer Material Number"] ?? "").trim()));
const matches = rfq.filter((row) => keys.has(String(row["Collins Part Number"] ?? "").trim()));
console.log(JSON.stringify({
  rfqRows: rfq.length,
  sapXrefRows: sapXref.length,
  firstRfqPart: rfq[0]?.["Collins Part Number"],
  firstSapXrefPart: sapXref[0]?.["Customer Material Number"],
  sapHeaders: Object.keys(sapXref[0] ?? {}),
  firstSapXrefRow: sapXref[4] ?? null,
  matchingRows: matches.length,
  firstCostMatch: matches.find((row) => {
    const match = sapXref.find((xref) => xref["Customer Material Number"] === row["Collins Part Number"]);
    return Number(match?.["Std. Cost"]) > 0;
  })?.["Collins Part Number"] ?? null,
}, null, 2));
