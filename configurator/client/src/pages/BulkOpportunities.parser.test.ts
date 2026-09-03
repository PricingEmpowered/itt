import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { buildBulkUploadTemplateWorkbook, parseSheet, sheetSuitabilityScore } from "./BulkOpportunities";

describe("SPA import header detection", () => {
  it("recognizes the core commercial fields on a detailed Bid Worksheet row", () => {
    const sheet = parseSheet("CollinsCornelius_WorksheetV3.xlsb", "Bid Worksheet", [
      ["Collins Part Number", "Part Description", "Year 1 EAU", "Annual Usage", "Product Line", "ITT Part Number", "2024 Burdened Cost", "Forward Cost", "MOQ", "Lead Time (weeks)", "Award Price", "2024 Booking Qty"],
      ["206-0132-150", "Connector", "2760", "2760", "Filters", "TBA", "11.50", "12.20", "100", "8", "22.50", "1800"],
    ]);
    expect(sheet.recognizedFields).toBeGreaterThanOrEqual(10);
    expect(sheet.lines[0]).toMatchObject({
      requestedPartNumber: "206-0132-150",
      annualUsage: 2760,
      family: "Filters",
      standardCost: 11.5,
      projectedCost: 12.2,
    });
  });

  it("prioritizes a detailed Bid Worksheet over a much larger supporting data sheet", () => {
    const bidWorksheet = parseSheet("CollinsCornelius_WorksheetV3.xlsb", "Bid Worksheet", [
      ["Collins Part Number", "Part Description", "Annual Usage", "Product Line", "ITT Part Number", "2024 Burdened Cost", "Forward Cost", "MOQ", "Lead Time (weeks)"],
      ["206-0132-150", "Connector", "2760", "Filters", "TBA", "11.50", "12.20", "100", "8"],
    ]);
    const supportingPos = parseSheet("CollinsCornelius_WorksheetV3.xlsb", "POS", [
      ["Customer Material Number", "Annual Usage", "Award Price"],
      ...Array.from({ length: 1500 }, () => ["206-0132-150", "2760", "22.50"]),
    ]);
    expect(sheetSuitabilityScore(bidWorksheet)).toBeGreaterThan(sheetSuitabilityScore(supportingPos));
  });

  it("creates an importer-ready template with instructions and required product fields", () => {
    const workbook = buildBulkUploadTemplateWorkbook();
    expect(workbook.SheetNames).toEqual(["Opportunity Lines", "Instructions"]);

    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets["Opportunity Lines"], { header: 1, defval: "" });
    const sheet = parseSheet("ITT_Bulk_Opportunity_Upload_Template.xlsx", "Opportunity Lines", rows);
    expect(sheet.recognizedFields).toBeGreaterThanOrEqual(12);
    expect(sheet.lines[0]).toMatchObject({ requestedPartNumber: "EXAMPLE-PART-001", quantity: 1000, annualUsage: 4000 });
  });
});
