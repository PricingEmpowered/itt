import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import BulkLinePricingWorkspace from "@/components/BulkLinePricingWorkspace";
import TopNav from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  Flag,
  Info,
  Loader2,
  PackageSearch,
  Plus,
  ShieldAlert,
  Sparkles,
  Target,
  UploadCloud,
  Users,
  X,
  XCircle,
} from "lucide-react";

type SourceFormat = "minimal" | "spa_extract" | "parts_view" | "worksheet" | "csv" | "other";

type ParsedLine = {
  sourceRow: number;
  sourcePartNumber?: string | null;
  requestedPartNumber?: string | null;
  ittPartNumber?: string | null;
  description?: string | null;
  family?: string | null;
  productLine?: string | null;
  customerRevision?: string | null;
  quantity?: number | null;
  annualUsage?: number | null;
  minimumOrderQty?: number | null;
  leadTimeWeeks?: number | null;
  standardCost?: number | null;
  projectedCost?: number | null;
  listPrice?: number | null;
  currentAwardPrice?: number | null;
  competitorPrice?: number | null;
  currentAwardMoq?: number | null;
  vendorCount?: number | null;
  validationErrors?: string[];
  sourceData?: Record<string, string | number | null>;
};

type ParsedSheet = {
  name: string;
  headerRow: number;
  format: SourceFormat;
  headers: string[];
  lines: ParsedLine[];
  recognizedFields: number;
};

type IntakeForm = {
  name: string;
  customerId: number | null;
  customerName: string;
  customerTier: string;
  quoteChannel: "OEM" | "Distribution";
  quoteToCustomerSpec: boolean;
  customerSpecReference: string;
  sourcingPosition: "competitive" | "sole_source" | "mixed" | "unknown";
  competitors: string[];
  targetRevenue: string;
  targetMarginPct: string;
  targetWinProbability: string;
  recentQuoteSummary: string;
  recentQuoteDate: string;
  priorBookingValue: string;
  expectedBookingValue: string;
  bookingEvidence: string;
  posValidation: "validated" | "partial" | "unavailable" | "not_applicable";
  posSupporters: string;
  distributorMarginTargetPct: string;
  ittMarginTargetPct: string;
  costValidationNotes: string;
};

const FIELD_ALIASES: Record<keyof Omit<ParsedLine, "sourceRow" | "validationErrors" | "sourceData">, string[]> = {
  sourcePartNumber: ["collinspartnumber", "customermaterialnumber", "driverpartnumber", "searchpn", "lookuppn"],
  requestedPartNumber: ["requestedpartno", "requestedpartnumber", "collinspartnumber", "customermaterialnumber", "driverpartnumber"],
  ittPartNumber: ["ittpartnumber", "sapmaterial", "globalmanufacturingpartnumber", "regionalmanufacturingpartnumber"],
  description: ["partdescription", "sapdescription", "materialdescription", "ittdescription", "description"],
  family: ["family", "series", "productline"],
  productLine: ["productline", "subproductline", "line"],
  customerRevision: ["rev", "revision", "customerrevision"],
  quantity: ["qty", "quantity", "inputqty", "orderqty", "driverquantity"],
  annualUsage: ["year1eau", "combinedeau", "annualusage", "annualusageeau", "yearlyusage"],
  minimumOrderQty: ["minordqty", "minimumsalesorderquantity", "moq"],
  leadTimeWeeks: ["ltweeks", "estimatedmfgleadtime", "standardleadtimeweeks", "leadtimeweeks"],
  standardCost: ["stdcost", "standardcost", "costusdeach", "2024burdenedcost", "2023burdenedcost", "2022burdenedcost"],
  projectedCost: ["forwardcost", "projectedcost", "2025estcost", "2026estcost", "2027estcost", "2028estcost"],
  listPrice: ["bookprice", "unitprice", "currentprice", "bidprice"],
  currentAwardPrice: ["currentawardprice", "awardprice", "currentltaprice"],
  competitorPrice: ["competitorprice", "distprice"],
  currentAwardMoq: ["currentawardmoq", "awardmoq", "currentltamoq"],
  vendorCount: ["vendors", "vendor", "vendorscount"],
};

const INITIAL_FORM: IntakeForm = {
  name: "",
  customerId: null,
  customerName: "",
  customerTier: "Mid",
  quoteChannel: "OEM",
  quoteToCustomerSpec: false,
  customerSpecReference: "",
  sourcingPosition: "unknown",
  competitors: [],
  targetRevenue: "",
  targetMarginPct: "35",
  targetWinProbability: "",
  recentQuoteSummary: "",
  recentQuoteDate: "",
  priorBookingValue: "",
  expectedBookingValue: "",
  bookingEvidence: "",
  posValidation: "not_applicable",
  posSupporters: "",
  distributorMarginTargetPct: "",
  ittMarginTargetPct: "",
  costValidationNotes: "",
};

export const BULK_UPLOAD_TEMPLATE_FILE_NAME = "ITT_Bulk_Opportunity_Upload_Template.xlsx";

const BULK_UPLOAD_TEMPLATE_HEADERS = [
  "Requested Part No.*", "Qty*", "Description", "ITT Part Number", "Family",
  "Annual Usage (EAU)", "Standard Cost", "Projected Cost", "List Price", "MOQ",
  "Lead Time (Weeks)", "Current Award Price", "Competitor Price", "Vendor Count", "Customer Revision",
];

const BULK_UPLOAD_TEMPLATE_EXAMPLES = [
  ["EXAMPLE-PART-001", 1000, "Example connector line — delete before upload", "", "", 4000, "", "", "", "", "", "", "", "", ""],
  ["EXAMPLE-PART-002", 250, "Optional enrichment example — delete before upload", "", "", "", 24.5, 23, 39.5, 100, 8, 31.2, 30.5, 2, "Rev A"],
];

export function buildBulkUploadTemplateWorkbook() {
  const workbook = XLSX.utils.book_new();
  const uploadSheet = XLSX.utils.aoa_to_sheet([BULK_UPLOAD_TEMPLATE_HEADERS, ...BULK_UPLOAD_TEMPLATE_EXAMPLES]);
  uploadSheet["!cols"] = [{ wch: 24 }, { wch: 12 }, { wch: 48 }, { wch: 22 }, { wch: 16 }, { wch: 19 }, { wch: 16 }, { wch: 17 }, { wch: 15 }, { wch: 10 }, { wch: 20 }, { wch: 22 }, { wch: 19 }, { wch: 14 }, { wch: 20 }];
  uploadSheet["!autofilter"] = { ref: `A1:O${BULK_UPLOAD_TEMPLATE_EXAMPLES.length + 1}` };
  XLSX.utils.book_append_sheet(workbook, uploadSheet, "Opportunity Lines");

  const instructions = XLSX.utils.aoa_to_sheet([
    ["ITT Connectors Bulk Quote Opportunity — Upload Template"], [],
    ["How to use this template"],
    ["1", "Enter one product opportunity line per row on the Opportunity Lines tab."],
    ["2", "Required: Requested Part No.* and Qty*. Annual Usage (EAU) can be used when quote quantity is unavailable."],
    ["3", "Delete the two rows labelled Example before uploading."],
    ["4", "Optional fields enrich the review. The pricing engine can still generate target prices when optional values are blank."], [],
    ["Column", "Required", "Purpose", "Accepted importer aliases"],
    ["Requested Part No.*", "Yes", "Customer-requested or source part number.", "Part Number; Customer Part No.; Customer Material Number; Driver Part Number"],
    ["Qty*", "Yes", "Quoted order quantity. Use Annual Usage (EAU) if quote quantity is not available.", "Quantity; Quote Qty; Order Qty; Input Qty"],
    ["Description", "No", "Product or customer description.", "Part Description; ITT Description; SAP Description; Material Description"],
    ["ITT Part Number", "No", "Known ITT/SAP cross-reference part number.", "SAP Material; Global Manufacturing Part Number"],
    ["Family", "No", "Connector family or series for pricing context.", "Series; Product Line"],
    ["Annual Usage (EAU)", "No", "Expected annual volume for tier and opportunity sizing.", "Year 1 EAU; Combined EAU; Annual Usage"],
    ["Standard Cost", "No", "Current validated unit cost.", "Std. Cost; Cost USD Each; Burdened Cost"],
    ["Projected Cost", "No", "Expected unit cost at quoted volume.", "Forward Cost; 2025/2026/2027/2028 Est Cost"],
    ["List Price", "No", "Known current list/book price.", "Book Price; Unit Price; Current Price; Bid Price"],
    ["MOQ", "No", "Minimum order quantity.", "MinOrdQty; Minimum Sales Order Quantity"],
    ["Lead Time (Weeks)", "No", "Expected manufacturing lead time in weeks.", "L/T; Estimated Mfg Lead Time; Standard Lead Time Weeks"],
    ["Current Award Price", "No", "Current LTA or last awarded unit price.", "Award Price; Current LTA Price"],
    ["Competitor Price", "No", "Known competing unit price.", "Dist Price"],
    ["Vendor Count", "No", "Number of qualified or active vendors.", "Vendors; Vendor"],
    ["Customer Revision", "No", "Customer drawing or specification revision.", "Rev; Revision"],
  ]);
  instructions["!cols"] = [{ wch: 28 }, { wch: 15 }, { wch: 62 }, { wch: 62 }];
  XLSX.utils.book_append_sheet(workbook, instructions, "Instructions");
  return workbook;
}

function normaliseHeader(value: unknown) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function cleanText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function cleanPart(value: unknown): string | null {
  const part = cleanText(value);
  if (!part || ["TBA", "TBD", "UNK", "N/A", "ENTER CUSTOMER DESCRIPTION", "—", "-"].includes(part.toUpperCase())) return null;
  return part;
}

function toNumber(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(String(value).replace(/[$,%\s,]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function findColumn(headers: string[], aliases: string[]) {
  const normalised = headers.map(normaliseHeader);
  return normalised.findIndex((header) => aliases.includes(header));
}

function detectFormat(fileName: string, sheetName: string, headers: string[]): SourceFormat {
  const file = fileName.toLowerCase();
  const headerSet = new Set(headers.map(normaliseHeader));
  if (file.endsWith(".csv")) return "csv";
  if (sheetName.toLowerCase().includes("bid worksheet") || headerSet.has("collinspartnumber")) return "worksheet";
  if (headerSet.has("requestedpartno")) return "spa_extract";
  if (headerSet.has("spaid")) return "parts_view";
  if (headerSet.has("ittpartnumber") || headerSet.has("sapmaterial")) return "other";
  return "minimal";
}

export function sheetSuitabilityScore(sheet: ParsedSheet) {
  const formatBonus = sheet.format === "worksheet" ? 5000 : sheet.format === "spa_extract" ? 4000 : sheet.format === "parts_view" ? 3000 : sheet.format === "minimal" ? 500 : 0;
  // Recognized commercial columns must dominate raw row count: a 9,000-row POS tab is not an import sheet.
  return sheet.recognizedFields * 10000 + formatBonus + Math.min(sheet.lines.length, 1000);
}

export function parseSheet(fileName: string, sheetName: string, rawRows: unknown[][]): ParsedSheet {
  let bestHeaderRow = 0;
  let bestScore = -1;
  for (let rowIndex = 0; rowIndex < Math.min(rawRows.length, 20); rowIndex++) {
    const score = Object.values(FIELD_ALIASES).reduce((total, aliases) => total + (findColumn(rawRows[rowIndex].map(String), aliases) >= 0 ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestHeaderRow = rowIndex;
    }
  }
  const headers = (rawRows[bestHeaderRow] ?? []).map((value, index) => cleanText(value) || `Column ${index + 1}`);
  const columnMap = Object.fromEntries(
    Object.entries(FIELD_ALIASES).map(([key, aliases]) => [key, findColumn(headers, aliases)]),
  ) as Record<string, number>;
  const lines: ParsedLine[] = [];

  for (let index = bestHeaderRow + 1; index < rawRows.length; index++) {
    const row = rawRows[index] ?? [];
    if (!row.some((value) => cleanText(value) !== null)) continue;
    const valueAt = (field: string) => {
      const col = columnMap[field];
      return col >= 0 ? row[col] : null;
    };
    const sourceData: Record<string, string | number | null> = {};
    headers.slice(0, 160).forEach((header, col) => {
      const value = row[col];
      const numeric = toNumber(value);
      sourceData[header] = numeric ?? cleanText(value);
    });
    const line: ParsedLine = {
      sourceRow: index + 1,
      sourcePartNumber: cleanPart(valueAt("sourcePartNumber")),
      requestedPartNumber: cleanPart(valueAt("requestedPartNumber")),
      ittPartNumber: cleanPart(valueAt("ittPartNumber")),
      description: cleanText(valueAt("description")),
      family: cleanText(valueAt("family")),
      productLine: cleanText(valueAt("productLine")),
      customerRevision: cleanText(valueAt("customerRevision")),
      quantity: toNumber(valueAt("quantity")),
      annualUsage: toNumber(valueAt("annualUsage")),
      minimumOrderQty: toNumber(valueAt("minimumOrderQty")),
      leadTimeWeeks: toNumber(valueAt("leadTimeWeeks")),
      standardCost: toNumber(valueAt("standardCost")),
      projectedCost: toNumber(valueAt("projectedCost")),
      listPrice: toNumber(valueAt("listPrice")),
      currentAwardPrice: toNumber(valueAt("currentAwardPrice")),
      competitorPrice: toNumber(valueAt("competitorPrice")),
      currentAwardMoq: toNumber(valueAt("currentAwardMoq")),
      vendorCount: toNumber(valueAt("vendorCount")),
      sourceData,
    };
    if (!line.requestedPartNumber && !line.ittPartNumber && !line.sourcePartNumber) {
      line.validationErrors = ["No requested part number or ITT part number found in this row."];
    }
    lines.push(line);
  }
  return {
    name: sheetName,
    headerRow: bestHeaderRow + 1,
    format: detectFormat(fileName, sheetName, headers),
    headers,
    lines,
    recognizedFields: Object.values(columnMap).filter((index) => index >= 0).length,
  };
}

const money = (value: unknown) => `$${Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const percent = (value: unknown) => `${Number(value ?? 0).toFixed(1)}%`;

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-slate-100 text-slate-700 border-slate-200",
  approved_target: "bg-emerald-50 text-emerald-700 border-emerald-200",
  target_overridden: "bg-violet-50 text-violet-700 border-violet-200",
  exception: "bg-amber-50 text-amber-800 border-amber-200",
  rejected: "bg-rose-50 text-rose-700 border-rose-200",
  invalid: "bg-rose-50 text-rose-700 border-rose-200",
};

const SCORE_STYLE: Record<string, { ring: string; text: string; label: string }> = {
  strong: { ring: "border-emerald-300 bg-emerald-50", text: "text-emerald-700", label: "Strong" },
  review: { ring: "border-amber-300 bg-amber-50", text: "text-amber-700", label: "Review" },
  high_risk: { ring: "border-rose-300 bg-rose-50", text: "text-rose-700", label: "High risk" },
};

function spaSourceValue(item: any, ...headers: string[]): string | number | null {
  const expected = new Set(headers.map(normaliseHeader));
  const entry = Object.entries(item.sourceData ?? {}).find(([header]) => expected.has(normaliseHeader(header)));
  return entry ? (entry[1] as string | number | null) : null;
}

function spaNumber(item: any, ...headers: string[]): number | null {
  const value = spaSourceValue(item, ...headers);
  const parsed = Number(String(value ?? "").replace(/[$,%\s,]/g, ""));
  return Number.isFinite(parsed) && parsed !== 0 ? parsed : null;
}

function sourcePill(source: "item" | "sales" | "input") {
  const style = source === "item"
    ? "border-sky-200 bg-sky-50 text-sky-700"
    : source === "sales"
      ? "border-violet-200 bg-violet-50 text-violet-700"
      : "border-amber-200 bg-amber-50 text-amber-800";
  const label = source === "item" ? "Item master" : source === "sales" ? "Sales data" : "User input";
  return <Badge variant="outline" className={`whitespace-nowrap px-1.5 py-0 text-[9px] ${style}`}>{label}</Badge>;
}

function workupText(item: any, ...headers: string[]) {
  const value = spaSourceValue(item, ...headers);
  return value === null || value === "" ? "—" : String(value);
}

function workupMoney(item: any, ...headers: string[]) {
  const value = spaNumber(item, ...headers);
  return value === null ? "—" : money(value);
}

function SpaDetailGrid({ items }: { items: any[] }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-sky-50/35 pb-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg"><FileSpreadsheet className="h-5 w-5 text-sky-700" /> SPA detail work-up</CardTitle>
            <CardDescription className="mt-1">Source data from the supplied SPA, organized for fast review. Blue fields are item-master inputs; violet fields are sales and booking history; amber fields require commercial judgment.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">{sourcePill("item")}{sourcePill("sales")}{sourcePill("input")}</div>
        </div>
      </CardHeader>
      <div className="overflow-x-auto">
        <Table className="min-w-[2460px] text-xs">
          <TableHeader>
            <TableRow className="border-b-0 bg-slate-950 text-white hover:bg-slate-950">
              <TableHead colSpan={7} className="h-9 border-r border-white/10 text-white">Part &amp; specification <span className="ml-2 normal-case font-normal text-slate-300">{sourcePill("item")}</span></TableHead>
              <TableHead colSpan={8} className="h-9 border-r border-white/10 text-white">Cost, supply &amp; manufacturing <span className="ml-2 normal-case font-normal text-slate-300">{sourcePill("item")}</span></TableHead>
              <TableHead colSpan={8} className="h-9 border-r border-white/10 text-white">Quote, LTA &amp; booking history <span className="ml-2 normal-case font-normal text-slate-300">{sourcePill("sales")}</span></TableHead>
              <TableHead colSpan={7} className="h-9 text-white">Pricing decision <span className="ml-2 normal-case font-normal text-slate-300">{sourcePill("input")}</span></TableHead>
            </TableRow>
            <TableRow className="bg-muted/50">
              <TableHead className="w-12">Row</TableHead><TableHead>Customer / ITT part</TableHead><TableHead className="min-w-60">Description</TableHead><TableHead>EAU</TableHead><TableHead>Qty tier</TableHead><TableHead>Dup.</TableHead><TableHead className="border-r">Product / class</TableHead>
              <TableHead>Cost yr</TableHead><TableHead>Cost status</TableHead><TableHead className="text-right">2024 burdened</TableHead><TableHead className="text-right">Forward cost</TableHead><TableHead>MOQ</TableHead><TableHead>Pkg qty</TableHead><TableHead>LT wks</TableHead><TableHead className="border-r">Bid / no bid</TableHead>
              <TableHead>Current LTA?</TableHead><TableHead>Current LTA qty</TableHead><TableHead className="text-right">LTA price</TableHead><TableHead className="text-right">Award price</TableHead><TableHead>2024 book qty</TableHead><TableHead className="text-right">2024 book price</TableHead><TableHead>History use?</TableHead><TableHead className="border-r">Vendors</TableHead>
              <TableHead className="text-right">Engine floor</TableHead><TableHead className="text-right">Engine target</TableHead><TableHead className="text-right">SPA target</TableHead><TableHead className="text-right">Negotiation</TableHead><TableHead className="text-right">Proposed</TableHead><TableHead className="text-right">GM / win</TableHead><TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{items.map((item) => {
            const part = item.ittPartNumber || item.requestedPartNumber || item.sourcePartNumber;
            const duplicate = workupText(item, "Duplicate") === "First" ? "First" : workupText(item, "Duplicate");
            const spaTarget = workupMoney(item, "R2 Target", "Target Price");
            const negotiation = workupMoney(item, "Negotiation Bid Price");
            return <TableRow key={item.id} className="align-top hover:bg-slate-50/60">
              <TableCell className="font-mono text-muted-foreground">{item.sourceRow}</TableCell>
              <TableCell><p className="font-mono font-semibold">{part || "—"}</p><p className="mt-1 text-[10px] text-muted-foreground">ITT: {item.ittPartNumber || "unmatched"}</p></TableCell>
              <TableCell className="max-w-72 whitespace-normal leading-4 text-muted-foreground">{item.description || workupText(item, "Part Description", "ITT Description")}</TableCell>
              <TableCell className="font-mono">{Number(item.annualUsage ?? item.quantity ?? 0).toLocaleString()}</TableCell>
              <TableCell>{workupText(item, "Quantity Category")}</TableCell>
              <TableCell><Badge variant="outline" className="text-[10px]">{duplicate}</Badge></TableCell>
              <TableCell className="border-r"><p>{workupText(item, "Product Line")}</p><p className="mt-1 text-[10px] text-muted-foreground">{workupText(item, "Part Classification", "Sub Product Line")}</p></TableCell>
              <TableCell>{workupText(item, "Cost Year")}</TableCell><TableCell>{workupText(item, "Cost Status Code")}</TableCell><TableCell className="text-right font-mono">{workupMoney(item, "2024 Burdened Cost", "Std. Cost")}</TableCell><TableCell className="text-right font-mono">{workupMoney(item, "Forward Cost", "2025 Est Cost", "Projected Cost")}</TableCell><TableCell>{workupText(item, "MOQ", "MinOrdQty")}</TableCell><TableCell>{workupText(item, "Package Qty", "PkgMultiple")}</TableCell><TableCell>{workupText(item, "Lead Time (weeks)", "L/T")}</TableCell><TableCell className="border-r">{workupText(item, "Bid or No Bid")}</TableCell>
              <TableCell>{workupText(item, "On Current LTA?")}</TableCell><TableCell>{workupText(item, "Current LTA Qty")}</TableCell><TableCell className="text-right font-mono">{workupMoney(item, "Current LTA Price")}</TableCell><TableCell className="text-right font-mono">{workupMoney(item, "Award Price")}</TableCell><TableCell>{workupText(item, "2024 Booking Qty")}</TableCell><TableCell className="text-right font-mono">{workupMoney(item, "2024 Booking Price")}</TableCell><TableCell>{workupText(item, "Booking History for Price Calc?", "Booking Global History for Price Calc?")}</TableCell><TableCell className="border-r">{workupText(item, "Vendors")}</TableCell>
              <TableCell className="text-right font-mono text-muted-foreground">{money(item.floorPrice)}</TableCell><TableCell className="text-right font-mono font-semibold">{money(item.targetPrice)}</TableCell><TableCell className="text-right font-mono">{spaTarget}</TableCell><TableCell className="text-right font-mono">{negotiation}</TableCell><TableCell className="text-right font-mono font-bold text-primary">{money(item.proposedPrice)}</TableCell><TableCell className="text-right font-mono"><span className={Number(item.grossMarginPct) >= 35 ? "text-emerald-700" : "text-amber-700"}>{percent(item.grossMarginPct)}</span><span className="block text-[10px] text-muted-foreground">{percent(item.winProbability)} win</span></TableCell><TableCell><Badge variant="outline" className={`whitespace-nowrap text-[10px] ${STATUS_STYLE[item.reviewStatus]}`}>{item.reviewStatus.replaceAll("_", " ")}</Badge></TableCell>
            </TableRow>;
          })}</TableBody>
        </Table>
      </div>
    </Card>
  );
}

function DecisionHeading({ number, title, hint }: { number: string; title: string; hint: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{number}</span>
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

export default function BulkOpportunities() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated, loading } = useAuth();
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<IntakeForm>(INITIAL_FORM);
  const [fileName, setFileName] = useState("");
  const [sheets, setSheets] = useState<ParsedSheet[]>([]);
  const [selectedSheetName, setSelectedSheetName] = useState("");
  const [activeToken, setActiveToken] = useState<string | null>(() =>
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("opportunity"),
  );
  const [competitorInput, setCompetitorInput] = useState("");

  const { data: customers = [] } = trpc.customers.list.useQuery({ search: "" }, { enabled: isAuthenticated });
  const { data: knownCompetitors = [] } = trpc.quoteWorkflow.getCompetitorNames.useQuery(undefined, { enabled: isAuthenticated });
  const { data: savedOpportunities = [] } = trpc.bulkOpportunities.list.useQuery(undefined, { enabled: isAuthenticated });
  const { data: review, isLoading: isReviewLoading } = trpc.bulkOpportunities.getReview.useQuery(
    { opportunityToken: activeToken ?? "" },
    { enabled: Boolean(activeToken) && isAuthenticated, refetchInterval: activeToken ? 20000 : false },
  );

  const createMutation = trpc.bulkOpportunities.create.useMutation();
  const importMutation = trpc.bulkOpportunities.importLines.useMutation();
  const priceMutation = trpc.bulkOpportunities.priceAll.useMutation();
  const updateMutation = trpc.bulkOpportunities.updateContext.useMutation();

  const selectedSheet = sheets.find((sheet) => sheet.name === selectedSheetName) ?? null;
  const importing = createMutation.isPending || importMutation.isPending || priceMutation.isPending;

  const setField = <K extends keyof IntakeForm>(key: K, value: IntakeForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const chooseCustomer = (id: string) => {
    const customer = customers.find((candidate) => candidate.id === Number(id));
    if (!customer) return;
    setForm((current) => ({
      ...current,
      customerId: customer.id,
      customerName: customer.name,
      customerTier: customer.tier ?? "Mid",
      quoteChannel: customer.channel === "Distribution" ? "Distribution" : "OEM",
    }));
  };

  const addCompetitor = (value: string) => {
    const clean = value.trim();
    if (!clean || form.competitors.some((competitor) => competitor.toLowerCase() === clean.toLowerCase())) return;
    setField("competitors", [...form.competitors, clean]);
    setCompetitorInput("");
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    const allowed = /\.(xlsx|xlsb|xls|csv)$/i.test(file.name);
    if (!allowed) {
      toast.error("Upload an Excel workbook (.xlsx, .xlsb, .xls) or CSV file.");
      return;
    }
    try {
      const bytes = await file.arrayBuffer();
      const workbook = XLSX.read(bytes, { type: "array", cellDates: true });
      const parsedSheets = workbook.SheetNames.map((name) => {
        const worksheet = workbook.Sheets[name];
        const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: "", raw: false });
        return parseSheet(file.name, name, rows);
      });
      const enrichmentByPart = new Map<string, ParsedLine>();
      parsedSheets.forEach((sheet) => sheet.lines.forEach((line) => {
        const partKey = normaliseHeader(line.sourcePartNumber || line.requestedPartNumber || line.ittPartNumber || "");
        const hasCommercialOrCostData = [line.standardCost, line.projectedCost, line.listPrice, line.minimumOrderQty, line.leadTimeWeeks].some((value) => Number(value) > 0);
        if (partKey && hasCommercialOrCostData && !enrichmentByPart.has(partKey)) enrichmentByPart.set(partKey, line);
      }));
      const candidates = parsedSheets.map((sheet) => ({
        ...sheet,
        lines: sheet.lines.map((line) => {
          const enrichment = enrichmentByPart.get(normaliseHeader(line.sourcePartNumber || line.requestedPartNumber || line.ittPartNumber || ""));
          if (!enrichment || enrichment === line) return line;
          return {
            ...line,
            ittPartNumber: line.ittPartNumber || enrichment.ittPartNumber,
            description: line.description || enrichment.description,
            family: line.family || enrichment.family,
            standardCost: Number(line.standardCost) > 0 ? line.standardCost : enrichment.standardCost,
            projectedCost: Number(line.projectedCost) > 0 ? line.projectedCost : enrichment.projectedCost,
            listPrice: Number(line.listPrice) > 0 ? line.listPrice : enrichment.listPrice,
            minimumOrderQty: Number(line.minimumOrderQty) > 0 ? line.minimumOrderQty : enrichment.minimumOrderQty,
            leadTimeWeeks: Number(line.leadTimeWeeks) > 0 ? line.leadTimeWeeks : enrichment.leadTimeWeeks,
            sourceData: { ...line.sourceData, __enrichedFrom: enrichment.sourceData?.["SAP Material"] ? "SAP XREF" : "Workbook cross-reference" },
          };
        }),
      })).sort((a, b) => sheetSuitabilityScore(b) - sheetSuitabilityScore(a));
      setSheets(candidates);
      setSelectedSheetName(candidates[0]?.name ?? "");
      setFileName(file.name);
      const firstUsable = candidates.find((candidate) => candidate.lines.length > 0);
      if (!firstUsable) toast.warning("The workbook was read, but no product rows were found. Choose another sheet or use a file with Requested Part No. and Qty.");
      else toast.success(`${firstUsable.lines.length} product rows found in ${firstUsable.name}.`);
    } catch (error) {
      toast.error(error instanceof Error ? `Could not read workbook: ${error.message}` : "Could not read workbook.");
    }
  };

  const toOptionalNumber = (value: string) => {
    const parsed = Number(value.replace(/[$,%\s,]/g, ""));
    return value.trim() && Number.isFinite(parsed) ? parsed : undefined;
  };

  const downloadValidationReport = () => {
    if (!selectedSheet) return;
    const invalidRows = selectedSheet.lines.filter((line) => line.validationErrors?.length);
    if (!invalidRows.length) return toast.success("No pre-import validation errors were found.");
    const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [
      ["Source Row", "Requested Part Number", "ITT Part Number", "Quantity", "Validation Error"].map(escape).join(","),
      ...invalidRows.map((line) => [line.sourceRow, line.requestedPartNumber || line.sourcePartNumber, line.ittPartNumber, line.quantity ?? line.annualUsage, line.validationErrors?.join(" | ")].map(escape).join(",")),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileName.replace(/\.[^.]+$/, "") || "spa-import"}-validation-errors.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadUploadTemplate = () => {
    try {
      XLSX.writeFile(buildBulkUploadTemplateWorkbook(), BULK_UPLOAD_TEMPLATE_FILE_NAME, { compression: true });
      toast.success("Bulk opportunity upload template downloaded.");
    } catch (error) {
      toast.error(error instanceof Error ? `Could not create template: ${error.message}` : "Could not create the upload template.");
    }
  };

  const handleCreateAndImport = async () => {
    if (!form.name.trim()) return toast.error("Give this opportunity a working name.");
    if (!form.customerName.trim()) return toast.error("Select a customer or enter a customer name.");
    if (!selectedSheet?.lines.length) return toast.error("Upload a spreadsheet containing at least one product line.");
    try {
      const opportunity = await createMutation.mutateAsync({
        name: form.name,
        customerName: form.customerName,
        customerId: form.customerId,
        customerTier: form.customerTier,
        quoteChannel: form.quoteChannel,
        quoteToCustomerSpec: form.quoteToCustomerSpec,
        customerSpecReference: form.customerSpecReference || undefined,
        sourcingPosition: form.sourcingPosition,
        competitors: form.competitors,
        targetRevenue: toOptionalNumber(form.targetRevenue),
        targetMarginPct: toOptionalNumber(form.targetMarginPct),
        targetWinProbability: toOptionalNumber(form.targetWinProbability),
        recentQuoteSummary: form.recentQuoteSummary || undefined,
        recentQuoteDate: form.recentQuoteDate || undefined,
        priorBookingValue: toOptionalNumber(form.priorBookingValue),
        expectedBookingValue: toOptionalNumber(form.expectedBookingValue),
        bookingEvidence: form.bookingEvidence || undefined,
        posValidation: form.quoteChannel === "Distribution" ? form.posValidation : "not_applicable",
        posSupporters: form.posSupporters || undefined,
        distributorMarginTargetPct: toOptionalNumber(form.distributorMarginTargetPct),
        ittMarginTargetPct: toOptionalNumber(form.ittMarginTargetPct),
        costValidationNotes: form.costValidationNotes || undefined,
        sourceFileName: fileName || undefined,
        sourceFormat: selectedSheet.format,
        sourceSheet: selectedSheet.name,
      });
      const chunkSize = 300;
      for (let start = 0; start < selectedSheet.lines.length; start += chunkSize) {
        await importMutation.mutateAsync({
          opportunityToken: opportunity!.opportunityToken,
          lines: selectedSheet.lines.slice(start, start + chunkSize),
        });
      }
      await priceMutation.mutateAsync({ opportunityToken: opportunity!.opportunityToken });
      await Promise.all([
        utils.bulkOpportunities.list.invalidate(),
        utils.bulkOpportunities.getReview.invalidate({ opportunityToken: opportunity!.opportunityToken }),
      ]);
      setActiveToken(opportunity!.opportunityToken);
      toast.success(`${selectedSheet.lines.length} lines imported and target-priced. Review the opportunity below.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The opportunity could not be imported.");
    }
  };

  const updateContext = async () => {
    if (!activeToken) return;
    try {
      await updateMutation.mutateAsync({
        opportunityToken: activeToken,
        customerName: form.customerName || undefined,
        customerId: form.customerId,
        customerTier: form.customerTier,
        quoteChannel: form.quoteChannel,
        quoteToCustomerSpec: form.quoteToCustomerSpec,
        customerSpecReference: form.customerSpecReference || undefined,
        sourcingPosition: form.sourcingPosition,
        competitors: form.competitors,
        targetRevenue: toOptionalNumber(form.targetRevenue),
        targetMarginPct: toOptionalNumber(form.targetMarginPct),
        targetWinProbability: toOptionalNumber(form.targetWinProbability),
        recentQuoteSummary: form.recentQuoteSummary || undefined,
        recentQuoteDate: form.recentQuoteDate || null,
        priorBookingValue: toOptionalNumber(form.priorBookingValue),
        expectedBookingValue: toOptionalNumber(form.expectedBookingValue),
        bookingEvidence: form.bookingEvidence || undefined,
        posValidation: form.quoteChannel === "Distribution" ? form.posValidation : "not_applicable",
        posSupporters: form.posSupporters || undefined,
        distributorMarginTargetPct: toOptionalNumber(form.distributorMarginTargetPct),
        ittMarginTargetPct: toOptionalNumber(form.ittMarginTargetPct),
        costValidationNotes: form.costValidationNotes || undefined,
      });
      await priceMutation.mutateAsync({ opportunityToken: activeToken });
      await utils.bulkOpportunities.getReview.invalidate({ opportunityToken: activeToken });
      toast.success("Decision context, target prices, and deal score recalculated. Review line decisions again before submitting.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Context could not be updated.");
    }
  };

  const populateForm = (opportunity: any) => {
    setForm({
      name: opportunity.name ?? "",
      customerId: opportunity.customerId ?? null,
      customerName: opportunity.customerName ?? "",
      customerTier: opportunity.customerTier ?? "Mid",
      quoteChannel: opportunity.quoteChannel ?? "OEM",
      quoteToCustomerSpec: opportunity.quoteToCustomerSpec ?? false,
      customerSpecReference: opportunity.customerSpecReference ?? "",
      sourcingPosition: opportunity.sourcingPosition ?? "unknown",
      competitors: Array.isArray(opportunity.competitors) ? opportunity.competitors : [],
      targetRevenue: opportunity.targetRevenue ? String(opportunity.targetRevenue) : "",
      targetMarginPct: String(opportunity.targetMarginPct ?? 35),
      targetWinProbability: opportunity.targetWinProbability ? String(opportunity.targetWinProbability) : "",
      recentQuoteSummary: opportunity.recentQuoteSummary ?? "",
      recentQuoteDate: opportunity.recentQuoteDate ? new Date(opportunity.recentQuoteDate).toISOString().slice(0, 10) : "",
      priorBookingValue: opportunity.priorBookingValue ? String(opportunity.priorBookingValue) : "",
      expectedBookingValue: opportunity.expectedBookingValue ? String(opportunity.expectedBookingValue) : "",
      bookingEvidence: opportunity.bookingEvidence ?? "",
      posValidation: opportunity.posValidation ?? "not_applicable",
      posSupporters: opportunity.posSupporters ?? "",
      distributorMarginTargetPct: opportunity.distributorMarginTargetPct ? String(opportunity.distributorMarginTargetPct) : "",
      ittMarginTargetPct: opportunity.ittMarginTargetPct ? String(opportunity.ittMarginTargetPct) : "",
      costValidationNotes: opportunity.costValidationNotes ?? "",
    });
  };

  useEffect(() => {
    if (review?.opportunity) populateForm(review.opportunity);
    // We only hydrate when a distinct saved opportunity is opened; subsequent score refreshes retain user edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [review?.opportunity?.opportunityToken]);

  if (loading) return <div className="min-h-screen bg-background" />;
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background"><TopNav />
        <main className="mx-auto flex max-w-xl flex-col items-center px-6 py-28 text-center">
          <ShieldAlert className="mb-4 h-10 w-10 text-primary" />
          <h1 className="text-2xl font-bold">Sign in to start a bulk opportunity</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Bulk SPA imports carry customer, cost, and pricing-decision information. Please sign in to create or review an opportunity.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/80 text-foreground">
      <TopNav />
      <main className="mx-auto max-w-[1540px] px-5 py-7 lg:px-8">
        <div className="mb-7 flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="-ml-2 mb-2 gap-1.5 text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back</Button>
            <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm"><FileSpreadsheet className="h-5 w-5" /></span><div><h1 className="text-2xl font-bold tracking-tight">Bulk Quote Opportunity</h1><p className="mt-0.5 text-sm text-muted-foreground">Import a multi-line SPA, establish the deal context, and govern target-price decisions at scale.</p></div></div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-primary/15 bg-primary/[0.035] px-3 py-2 text-xs text-muted-foreground"><Sparkles className="h-4 w-4 text-primary" /><span><strong className="text-foreground">Flexible import:</strong> Requested Part No. + Qty is enough. Rich SPA files enrich the review automatically.</span></div>
        </div>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <Card className="border-primary/15 shadow-sm">
              <CardHeader className="border-b bg-gradient-to-r from-primary/[0.04] to-transparent pb-5">
                <div className="flex items-start justify-between gap-4"><div><CardTitle className="flex items-center gap-2 text-lg"><UploadCloud className="h-5 w-5 text-primary" /> Import opportunity lines</CardTitle><CardDescription className="mt-1.5">Upload an Excel workbook, XLSB, or CSV. We automatically identify common ITT SPA columns and retain mapped source values per line.</CardDescription></div><Badge variant="outline" className="shrink-0 border-primary/25 bg-background text-primary">XLSX · XLSB · CSV</Badge></div>
              </CardHeader>
              <CardContent className="pt-5">
                <div className="mb-4 flex flex-col gap-3 rounded-lg border border-primary/15 bg-primary/[0.035] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div><p className="text-sm font-semibold">Need a starting file?</p><p className="mt-0.5 text-xs text-muted-foreground">Download the Excel template with required columns, optional enrichment fields, and an Instructions tab.</p></div>
                  <Button type="button" size="sm" variant="outline" onClick={downloadUploadTemplate} className="shrink-0 gap-1.5"><Download className="h-3.5 w-3.5" /> Download template</Button>
                </div>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xlsb,.xls,.csv" className="hidden" onChange={(event) => handleFile(event.target.files?.[0])} />
                <button type="button" onClick={() => fileInputRef.current?.click()} className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-primary/35 bg-primary/[0.025] px-5 py-7 transition-colors hover:bg-primary/[0.06]">
                  <UploadCloud className="mb-3 h-7 w-7 text-primary" />
                  <span className="text-sm font-semibold">{fileName || "Choose an SPA / opportunity spreadsheet"}</span>
                  <span className="mt-1 text-xs text-muted-foreground">Start with Requested Part No. and Qty — import richer work-up fields whenever available.</span>
                </button>
                {sheets.length > 0 && (
                  <div className="mt-5 grid gap-4 md:grid-cols-[220px_1fr] md:items-end">
                    <div className="space-y-1.5"><Label>Source worksheet</Label><Select value={selectedSheetName} onValueChange={setSelectedSheetName}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{sheets.map((sheet) => <SelectItem key={sheet.name} value={sheet.name}>{sheet.name} · {sheet.recognizedFields} mapped fields · {sheet.lines.length.toLocaleString()} rows</SelectItem>)}</SelectContent></Select></div>
                    <div className={`rounded-lg px-4 py-3 text-xs ${selectedSheet && selectedSheet.recognizedFields < 5 ? "border border-amber-200 bg-amber-50 text-amber-900" : "bg-muted/65 text-muted-foreground"}`}><strong className="text-foreground">{selectedSheet?.recognizedFields ?? 0} recognised fields</strong> from header row {selectedSheet?.headerRow ?? "—"}. {selectedSheet?.recognizedFields && selectedSheet.recognizedFields < 5 ? "This may be a supporting data tab; choose the suggested detailed worksheet from the menu above." : `${selectedSheet?.lines.filter((line) => line.validationErrors?.length).length ?? 0} rows need part-number correction before they can be submitted.`}</div>
                  </div>
                )}
                {selectedSheet && (
                  <div className="mt-5 overflow-hidden rounded-lg border border-border"><div className="flex items-center justify-between gap-3 bg-muted/45 px-4 py-2.5"><span className="text-xs font-semibold">Imported line preview</span><div className="flex items-center gap-3"><span className="text-xs text-muted-foreground">Showing {Math.min(5, selectedSheet.lines.length)} of {selectedSheet.lines.length}</span>{selectedSheet.lines.some((line) => line.validationErrors?.length) ? <Button type="button" size="sm" variant="ghost" className="h-7 gap-1 px-2 text-[11px]" onClick={downloadValidationReport}><FileSpreadsheet className="h-3.5 w-3.5" /> Download errors</Button> : null}</div></div><div className="divide-y divide-border">{selectedSheet.lines.slice(0, 5).map((line) => <div key={line.sourceRow} className="grid grid-cols-[52px_minmax(145px,1fr)_minmax(0,1.5fr)_80px] gap-3 px-4 py-2.5 text-xs"><span className="text-muted-foreground">#{line.sourceRow}</span><span className="font-mono font-medium">{line.ittPartNumber || line.requestedPartNumber || line.sourcePartNumber || <span className="text-rose-600">Missing part</span>}</span><span className="truncate text-muted-foreground">{line.description || "No description supplied"}</span><span className="text-right font-medium">{line.quantity ?? line.annualUsage ?? 1} qty</span></div>)}</div></div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b"><CardTitle className="flex items-center gap-2 text-lg"><ClipboardCheck className="h-5 w-5 text-primary" /> Opportunity decision context</CardTitle><CardDescription>These questions make the deal score explainable. You can import without a target price; the engine will generate line-level target recommendations after intake.</CardDescription></CardHeader>
              <CardContent className="space-y-8 pt-6">
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-1.5"><Label>Opportunity working name <span className="text-rose-600">*</span></Label><Input placeholder="e.g., Collins Cornelius 2027 SPA" value={form.name} onChange={(event) => setField("name", event.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Existing customer</Label><Select value={form.customerId ? String(form.customerId) : "manual"} onValueChange={(value) => value === "manual" ? setField("customerId", null) : chooseCustomer(value)}><SelectTrigger><SelectValue placeholder="Select a customer" /></SelectTrigger><SelectContent><SelectItem value="manual">Enter a customer manually</SelectItem>{customers.map((customer) => <SelectItem key={customer.id} value={String(customer.id)}>{customer.name}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-1.5"><Label>Customer name <span className="text-rose-600">*</span></Label><Input placeholder="Customer / account" value={form.customerName} onChange={(event) => { setField("customerName", event.target.value); setField("customerId", null); }} /></div>
                  <div className="space-y-1.5"><Label>Customer segment</Label><Select value={form.customerTier} onValueChange={(value) => setField("customerTier", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Enterprise", "Large", "Mid", "SMB"].map((tier) => <SelectItem key={tier} value={tier}>{tier}</SelectItem>)}</SelectContent></Select></div>
                </div>

                <Separator />
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="space-y-4"><DecisionHeading number="1" title="OEM or distributor quote?" hint="Select the commercial route so the score applies the right channel-economics checks." /><div className="grid grid-cols-2 gap-3"><button type="button" onClick={() => setField("quoteChannel", "OEM")} className={`rounded-lg border p-3 text-left transition-colors ${form.quoteChannel === "OEM" ? "border-primary bg-primary/[0.05] ring-1 ring-primary/25" : "hover:border-primary/40"}`}><Users className="mb-2 h-4 w-4 text-primary" /><span className="block text-sm font-semibold">OEM</span><span className="text-xs text-muted-foreground">Direct account quote</span></button><button type="button" onClick={() => setField("quoteChannel", "Distribution")} className={`rounded-lg border p-3 text-left transition-colors ${form.quoteChannel === "Distribution" ? "border-primary bg-primary/[0.05] ring-1 ring-primary/25" : "hover:border-primary/40"}`}><PackageSearch className="mb-2 h-4 w-4 text-primary" /><span className="block text-sm font-semibold">Distributor</span><span className="text-xs text-muted-foreground">Channel resale quote</span></button></div></div>
                  <div className="space-y-4"><DecisionHeading number="2" title="Quoting to a customer specification?" hint="A documented specification raises confidence and should be traceable in review." /><label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3"><Checkbox checked={form.quoteToCustomerSpec} onCheckedChange={(checked) => setField("quoteToCustomerSpec", Boolean(checked))} /><span className="text-sm font-medium">Yes — this is customer-spec controlled</span></label>{form.quoteToCustomerSpec && <Input placeholder="Specification / drawing reference" value={form.customerSpecReference} onChange={(event) => setField("customerSpecReference", event.target.value)} />}</div>
                </div>

                <Separator />
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="space-y-4"><DecisionHeading number="3" title="Commercial targets" hint="Targets are decision guardrails, not required source-file fields." /><div className="grid grid-cols-3 gap-3"><div className="space-y-1.5"><Label className="text-xs">Revenue target</Label><Input inputMode="decimal" placeholder="$" value={form.targetRevenue} onChange={(event) => setField("targetRevenue", event.target.value)} /></div><div className="space-y-1.5"><Label className="text-xs">Margin target %</Label><Input inputMode="decimal" value={form.targetMarginPct} onChange={(event) => setField("targetMarginPct", event.target.value)} /></div><div className="space-y-1.5"><Label className="text-xs">Win target %</Label><Input inputMode="decimal" placeholder="Optional" value={form.targetWinProbability} onChange={(event) => setField("targetWinProbability", event.target.value)} /></div></div></div>
                  <div className="space-y-4"><DecisionHeading number="4" title="Competitive or sole sourced?" hint="Capture the sourcing position and the known competitors in the deal." /><Select value={form.sourcingPosition} onValueChange={(value) => setField("sourcingPosition", value as IntakeForm["sourcingPosition"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="competitive">Competitive</SelectItem><SelectItem value="sole_source">ITT sole source</SelectItem><SelectItem value="mixed">Mixed opportunity</SelectItem><SelectItem value="unknown">Not yet validated</SelectItem></SelectContent></Select><div className="flex gap-2"><Select value="" onValueChange={addCompetitor}><SelectTrigger className="flex-1"><SelectValue placeholder="Select known competitor" /></SelectTrigger><SelectContent>{knownCompetitors.filter((name) => !form.competitors.includes(name)).map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent></Select><Input className="w-40" placeholder="Add name" value={competitorInput} onChange={(event) => setCompetitorInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCompetitor(competitorInput); } }} /><Button type="button" variant="outline" size="icon" onClick={() => addCompetitor(competitorInput)}><Plus className="h-4 w-4" /></Button></div>{form.competitors.length > 0 && <div className="flex flex-wrap gap-1.5">{form.competitors.map((competitor) => <Badge key={competitor} variant="outline" className="gap-1 border-violet-200 bg-violet-50 text-violet-800">{competitor}<button type="button" onClick={() => setField("competitors", form.competitors.filter((name) => name !== competitor))}><X className="h-3 w-3" /></button></Badge>)}</div>}</div>
                </div>

                <Separator />
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="space-y-4"><DecisionHeading number="5" title="Quote and booking history" hint="Record the evidence a reviewer would otherwise have to find manually." /><div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label className="text-xs">Most recent quote date</Label><Input type="date" value={form.recentQuoteDate} onChange={(event) => setField("recentQuoteDate", event.target.value)} /></div><div className="space-y-1.5"><Label className="text-xs">Prior booked value</Label><Input inputMode="decimal" placeholder="$" value={form.priorBookingValue} onChange={(event) => setField("priorBookingValue", event.target.value)} /></div><div className="space-y-1.5"><Label className="text-xs">Expected booking value</Label><Input inputMode="decimal" placeholder="$" value={form.expectedBookingValue} onChange={(event) => setField("expectedBookingValue", event.target.value)} /></div><div className="space-y-1.5"><Label className="text-xs">History summary</Label><Input placeholder="Who / how long ago" value={form.recentQuoteSummary} onChange={(event) => setField("recentQuoteSummary", event.target.value)} /></div></div><Textarea className="min-h-20" placeholder="Booking context: booked orders, expected awards, or risks…" value={form.bookingEvidence} onChange={(event) => setField("bookingEvidence", event.target.value)} /></div>
                  <div className="space-y-4"><DecisionHeading number="6" title="POS and distributor resale validation" hint="For channel business, confirm resale support and the intended distributor versus ITT margin trade-off." />{form.quoteChannel === "Distribution" ? <><div className="grid grid-cols-3 gap-3"><div className="space-y-1.5"><Label className="text-xs">POS evidence</Label><Select value={form.posValidation} onValueChange={(value) => setField("posValidation", value as IntakeForm["posValidation"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="validated">Validated</SelectItem><SelectItem value="partial">Partial</SelectItem><SelectItem value="unavailable">Unavailable</SelectItem></SelectContent></Select></div><div className="space-y-1.5"><Label className="text-xs">Disty margin %</Label><Input inputMode="decimal" placeholder="%" value={form.distributorMarginTargetPct} onChange={(event) => setField("distributorMarginTargetPct", event.target.value)} /></div><div className="space-y-1.5"><Label className="text-xs">ITT margin %</Label><Input inputMode="decimal" placeholder="%" value={form.ittMarginTargetPct} onChange={(event) => setField("ittMarginTargetPct", event.target.value)} /></div></div><Textarea className="min-h-20" placeholder="Supporting partners / end-customer resale validation…" value={form.posSupporters} onChange={(event) => setField("posSupporters", event.target.value)} /></> : <div className="rounded-lg border border-dashed bg-muted/35 p-4 text-sm text-muted-foreground"><Info className="mb-2 h-4 w-4 text-primary" />Distributor POS and resale economics are not required for an OEM quote.</div>}</div>
                </div>

                <Separator />
                <div className="space-y-4"><DecisionHeading number="7" title="Cost validation for quoted volume" hint="Projected cost is mapped from the source spreadsheet when provided. Use this space to identify assumptions, sourcing changes, or items that still require cost validation." /><Textarea className="min-h-20" placeholder="e.g., Projected tooling absorption and volume cost validated with Operations on 28 Aug…" value={form.costValidationNotes} onChange={(event) => setField("costValidationNotes", event.target.value)} /></div>

                <div className="flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs leading-5 text-muted-foreground"><strong className="text-foreground">Decision rule:</strong> import lines first, then select the pricing engine’s targets in bulk. Only exceptions need individual rationale and ownership.</p><Button size="lg" onClick={handleCreateAndImport} disabled={importing || !selectedSheet?.lines.length} className="gap-2 shadow-sm">{importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{importing ? "Importing & pricing…" : "Import and price opportunity"}<ChevronRight className="h-4 w-4" /></Button></div>
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
            <Card className="border-primary/15 bg-gradient-to-b from-primary/[0.055] to-background"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Target className="h-4 w-4 text-primary" /> Import approach</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><div className="flex gap-3"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">1</span><p><strong>Minimal:</strong> Requested Part No. + Qty begins a priced review.</p></div><div className="flex gap-3"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">2</span><p><strong>Enriched:</strong> import costs, award prices, MOQ, lead time, and competitors when available.</p></div><div className="flex gap-3"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">3</span><p><strong>Governed:</strong> bulk-approve targets and document the lines that need an exception.</p></div></CardContent></Card>
            <Card><CardHeader className="pb-3"><CardTitle className="text-base">Mapped SPA fields</CardTitle></CardHeader><CardContent className="space-y-2 text-xs text-muted-foreground"><p><strong className="text-foreground">Core:</strong> Requested/ITT part, description, quantity, annual usage, family.</p><p><strong className="text-foreground">Commercial:</strong> current award price, vendor count, source list price.</p><p><strong className="text-foreground">Cost & supply:</strong> standard/projected cost, MOQ, lead time.</p><p className="rounded-md bg-muted/60 p-2.5 leading-5">The provided Collins worksheet maps from RFQ, Bid Worksheet, SAP XREF, and Book Prices conventions. One-column extracts are supported but will need product rows below the header.</p></CardContent></Card>
            <Card><CardHeader className="pb-3"><CardTitle className="text-base">Saved opportunities</CardTitle></CardHeader><CardContent className="space-y-2">{savedOpportunities.slice(0, 6).map((opportunity) => <button type="button" key={opportunity.opportunityToken} onClick={() => { setActiveToken(opportunity.opportunityToken); populateForm(opportunity); }} className={`w-full rounded-lg border p-3 text-left transition-colors hover:border-primary/40 ${activeToken === opportunity.opportunityToken ? "border-primary bg-primary/[0.045]" : "bg-background"}`}><div className="flex items-center justify-between gap-2"><span className="truncate text-xs font-semibold">{opportunity.name}</span><Badge variant="outline" className="text-[10px] capitalize">{opportunity.status.replaceAll("_", " ")}</Badge></div><p className="mt-1 truncate text-[11px] text-muted-foreground">{opportunity.customerName} · {opportunity.validRows} lines</p></button>)}{!savedOpportunities.length && <p className="text-xs text-muted-foreground">Saved opportunity imports will appear here.</p>}</CardContent></Card>
          </aside>
        </section>

        {activeToken && (
          <section className="mt-8">
            {isReviewLoading || !review ? <Card><CardContent className="flex items-center gap-3 py-12 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin text-primary" />Loading bulk review…</CardContent></Card> : <BulkReview review={review} userName={user?.name ?? "Sales Rep"} onUpdateContext={updateContext} />}
          </section>
        )}
      </main>
    </div>
  );
}

function BulkReview({ review, userName, onUpdateContext }: { review: any; userName: string; onUpdateContext: () => void }) {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState("all");
  const [reviewMode, setReviewMode] = useState<"pricing" | "spa_detail">(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("view") === "spa_detail" ? "spa_detail" : "pricing",
  );
  const [tier, setTier] = useState<"aggressive" | "target" | "conservative">("target");
  const [detailItemId, setDetailItemId] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const value = Number(new URLSearchParams(window.location.search).get("line"));
    return Number.isInteger(value) && value > 0 ? value : null;
  });
  const [exceptionItem, setExceptionItem] = useState<any | null>(null);
  const [exceptionPrice, setExceptionPrice] = useState("");
  const [exceptionReason, setExceptionReason] = useState("");
  const [exceptionOwner, setExceptionOwner] = useState(userName);
  const [approvalConfirmationOpen, setApprovalConfirmationOpen] = useState(false);

  const actionMutation = trpc.bulkOpportunities.applyBulkAction.useMutation({
    onSuccess: async (result) => { await utils.bulkOpportunities.getReview.invalidate({ opportunityToken: review.opportunity.opportunityToken }); setSelected(new Set()); toast.success(`${result.updated} lines updated.`); },
    onError: (error) => toast.error(error.message),
  });
  const exceptionMutation = trpc.bulkOpportunities.setException.useMutation({
    onSuccess: async () => { await utils.bulkOpportunities.getReview.invalidate({ opportunityToken: review.opportunity.opportunityToken }); setExceptionItem(null); toast.success("Line flagged as an approval exception."); },
    onError: (error) => toast.error(error.message),
  });
  const submitMutation = trpc.bulkOpportunities.submitForApproval.useMutation({
    onSuccess: async (result) => { await utils.bulkOpportunities.getReview.invalidate({ opportunityToken: review.opportunity.opportunityToken }); toast.success(result.message); navigate("/approval-queue"); },
    onError: (error) => toast.error(error.message),
  });

  const visibleItems = useMemo(() => filter === "all" ? review.items : review.items.filter((item: any) => item.reviewStatus === filter), [filter, review.items]);
  const eligible = visibleItems.filter((item: any) => item.reviewStatus !== "invalid" && item.reviewStatus !== "rejected");
  const allVisibleSelected = eligible.length > 0 && eligible.every((item: any) => selected.has(item.id));
  const scoreStyle = SCORE_STYLE[review.score.scoreBand] ?? SCORE_STYLE.review;
  const scoreProgress = Math.max(0, Math.min(100, Number(review.score.score ?? 0)));
  const rejectedCount = review.items.filter((item: any) => item.reviewStatus === "rejected").length;
  const submissionLineCount = review.summary.counts.approved + review.summary.counts.exceptions;
  const decisionCount = submissionLineCount + rejectedCount;
  const unresolvedCount = review.summary.counts.pending + review.summary.counts.invalid;
  const approvalReady = unresolvedCount === 0 && submissionLineCount > 0;
  const startLevel = review.summary.averageDiscount <= 5 ? 1 : review.summary.averageDiscount <= 10 ? 2 : review.summary.averageDiscount <= 18 ? 3 : review.summary.averageDiscount <= 25 ? 4 : 5;
  const approverRole = ["Sales Rep", "Sales Manager", "Regional Director", "VP Sales", "CFO / Executive"][startLevel - 1];
  const exceptionValue = review.items.filter((item: any) => item.reviewStatus === "exception").reduce((total: number, item: any) => total + Number(item.proposedPrice ?? 0) * Math.max(1, Number(item.quantity ?? 1)), 0);
  const governedDecisionCount = review.summary.counts.exceptions + review.summary.counts.overrides;
  const openApprovalHandoff = () => {
    setApprovalConfirmationOpen(true);
    window.setTimeout(() => document.getElementById("bulk-approval-handoff")?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
  };

  const toggle = (id: number) => setSelected((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const toggleVisible = () => setSelected(allVisibleSelected ? new Set() : new Set(eligible.map((item: any) => item.id)));
  const runAction = (action: "approve_target" | "set_tier" | "reject", itemIds = Array.from(selected)) => {
    if (!itemIds.length) return toast.error("Select at least one eligible line.");
    actionMutation.mutate({ opportunityToken: review.opportunity.opportunityToken, itemIds, action, tier: action === "set_tier" ? tier : undefined });
  };
  const openException = (item: any) => { setExceptionItem(item); setExceptionPrice(String(item.proposedPrice ?? item.targetPrice ?? "")); setExceptionReason(item.exceptionReason ?? ""); setExceptionOwner(item.exceptionOwner ?? userName); };
  const saveException = () => { if (!exceptionItem) return; const price = Number(exceptionPrice); if (!Number.isFinite(price) || price <= 0) return toast.error("Enter a positive exception price."); exceptionMutation.mutate({ opportunityToken: review.opportunity.opportunityToken, itemId: exceptionItem.id, exceptionPrice: price, exceptionReason, exceptionOwner }); };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-xl border border-primary/20 bg-slate-950 px-5 py-5 text-white shadow-lg md:flex-row md:items-center md:justify-between"><div><div className="flex items-center gap-2"><Badge className="border-white/20 bg-white/10 text-white">Bulk pricing review</Badge><span className="font-mono text-xs text-slate-300">{review.opportunity.opportunityToken}</span></div><h2 className="mt-2 text-xl font-bold">{review.opportunity.name}</h2><p className="mt-1 text-sm text-slate-300">{review.opportunity.customerName} · {review.opportunity.quoteChannel} · {review.items.length} imported lines</p></div><div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm"><div><span className="block text-[10px] uppercase tracking-[.14em] text-slate-400">Quoted opportunity value</span><span className="font-mono text-lg font-bold">{money(review.summary.totalQuotedValue)}</span></div><div><span className="block text-[10px] uppercase tracking-[.14em] text-slate-400">Average discount</span><span className="font-mono text-lg font-bold">{percent(review.summary.averageDiscount)}</span></div><Button variant="secondary" onClick={onUpdateContext} className="gap-2"><ClipboardCheck className="h-4 w-4" /> Recalculate context</Button></div></div>

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="overflow-hidden"><CardHeader className="border-b pb-4"><CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="h-4 w-4 text-primary" /> Overall deal score</CardTitle><CardDescription>Transparent score from decision context, target margins, costs, and pricing exceptions.</CardDescription></CardHeader><CardContent className="pt-5"><div className="flex items-center gap-4"><div className={`flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-full border-4 ${scoreStyle.ring}`}><span className={`text-2xl font-bold ${scoreStyle.text}`}>{Math.round(scoreProgress)}</span><span className="text-[10px] font-semibold text-muted-foreground">/ 100</span></div><div><Badge variant="outline" className={`${scoreStyle.ring} ${scoreStyle.text} border`}>{scoreStyle.label}</Badge><p className="mt-2 text-sm font-medium leading-5">{review.score.scoreRecommendation}</p><p className="mt-1 text-xs text-muted-foreground">{review.score.confidence} confidence · {percent(review.score.avgWinProbability)} weighted win probability</p></div></div><Progress value={scoreProgress} className="mt-5 h-2" /><div className="mt-5 space-y-2 border-t pt-4">{review.score.drivers.slice(0, 7).map((driver: any) => <div key={driver.label} className="flex items-start justify-between gap-3 text-xs"><div><p className="font-semibold text-foreground">{driver.label}</p><p className="mt-0.5 leading-4 text-muted-foreground">{driver.detail}</p></div><span className={`shrink-0 font-mono font-semibold ${driver.impact >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{driver.impact >= 0 ? "+" : ""}{driver.impact}</span></div>)}</div></CardContent></Card>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
          { label: "Awaiting decision", value: review.summary.counts.pending, icon: ClipboardCheck, tone: "text-slate-700 bg-slate-100" },
          { label: "Target approved", value: review.summary.counts.approved, icon: CheckCircle2, tone: "text-emerald-700 bg-emerald-50" },
          { label: "Exceptions", value: review.summary.counts.exceptions, icon: Flag, tone: "text-amber-700 bg-amber-50" },
          { label: "Needs correction", value: review.summary.counts.invalid, icon: AlertTriangle, tone: "text-rose-700 bg-rose-50" },
        ].map((metric) => <Card key={metric.label}><CardContent className="p-5"><div className={`mb-4 flex h-9 w-9 items-center justify-center rounded-lg ${metric.tone}`}><metric.icon className="h-4 w-4" /></div><p className="text-2xl font-bold">{metric.value}</p><p className="mt-1 text-xs font-medium text-muted-foreground">{metric.label}</p></CardContent></Card>)}</div>
      </div>

      <Tabs value={reviewMode} onValueChange={(value) => setReviewMode(value as "pricing" | "spa_detail")}>
        <TabsList className="h-10 bg-muted/70">
          <TabsTrigger value="pricing" className="gap-2"><CircleDollarSign className="h-3.5 w-3.5" /> Price decision</TabsTrigger>
          <TabsTrigger value="spa_detail" className="gap-2"><FileSpreadsheet className="h-3.5 w-3.5" /> SPA detail work-up</TabsTrigger>
        </TabsList>
      </Tabs>

      {exceptionItem && <Card className="border-amber-300 bg-amber-50/50"><CardContent className="p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-end"><div className="flex-1"><p className="flex items-center gap-2 text-sm font-semibold text-amber-900"><Flag className="h-4 w-4" /> Price exception · {exceptionItem.ittPartNumber || exceptionItem.requestedPartNumber || exceptionItem.sourcePartNumber}</p><p className="mt-1 text-xs text-amber-800">Enter the proposed price, commercial justification, and accountable exception owner. This line will remain visible in the five-level approval chain.</p></div><div className="grid flex-[1.7] gap-3 sm:grid-cols-[120px_minmax(0,1fr)_150px_auto]"><Input inputMode="decimal" placeholder="Exception price" value={exceptionPrice} onChange={(event) => setExceptionPrice(event.target.value)} /><Input placeholder="Required business justification" value={exceptionReason} onChange={(event) => setExceptionReason(event.target.value)} /><Input placeholder="Exception owner" value={exceptionOwner} onChange={(event) => setExceptionOwner(event.target.value)} /><div className="flex gap-2"><Button size="sm" onClick={saveException} disabled={exceptionMutation.isPending}>{exceptionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button><Button size="sm" variant="ghost" onClick={() => setExceptionItem(null)}>Cancel</Button></div></div></div></CardContent></Card>}

      {reviewMode === "spa_detail" ? <SpaDetailGrid items={visibleItems} /> : null}
      <div
        hidden={reviewMode !== "pricing"}
        onDoubleClick={(event) => {
          const target = event.target as HTMLElement;
          if (target.closest("button, input, [role='checkbox']")) return;
          const row = target.closest("tbody tr");
          if (!row) return;
          const rows = Array.from(event.currentTarget.querySelectorAll("tbody tr"));
          const index = rows.indexOf(row);
          const line = visibleItems[index];
          if (line?.id) setDetailItemId(line.id);
        }}
      >
      <div className="flex items-center gap-2 px-1 pb-2 text-xs text-muted-foreground"><Info className="h-3.5 w-3.5 text-primary" />Double-click any line to open its complete pricing, peer-comparison, and decision workspace.</div>
      <Card className="overflow-hidden"><CardHeader className="border-b bg-background pb-4"><div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><div><CardTitle className="flex items-center gap-2 text-lg"><CircleDollarSign className="h-5 w-5 text-primary" /> Target-price decision grid</CardTitle><CardDescription className="mt-1">Select as many lines as needed, approve the calculated recommendation in bulk, and isolate the commercial exceptions.</CardDescription></div><div className="flex flex-wrap items-center gap-2"><Select value={filter} onValueChange={setFilter}><SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All lines ({review.items.length})</SelectItem><SelectItem value="pending">Awaiting decision ({review.summary.counts.pending})</SelectItem><SelectItem value="approved_target">Target approved ({review.summary.counts.approved})</SelectItem><SelectItem value="exception">Exceptions ({review.summary.counts.exceptions})</SelectItem><SelectItem value="invalid">Needs correction ({review.summary.counts.invalid})</SelectItem></SelectContent></Select><Button size="sm" variant="outline" onClick={() => runAction("approve_target", review.items.filter((item: any) => item.reviewStatus === "pending").map((item: any) => item.id))} disabled={!review.summary.counts.pending || actionMutation.isPending} className="gap-1.5 text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Approve all targets</Button></div></div></CardHeader>
        <div className="flex flex-col gap-3 border-b bg-muted/35 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2 text-xs text-muted-foreground"><strong className="text-foreground">{selected.size}</strong> selected<Separator orientation="vertical" className="mx-1 h-4" /><Select value={tier} onValueChange={(value) => setTier(value as typeof tier)}><SelectTrigger className="h-8 w-36 bg-background text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="aggressive">Aggressive tier</SelectItem><SelectItem value="target">Target tier</SelectItem><SelectItem value="conservative">Conservative tier</SelectItem></SelectContent></Select><Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => runAction("set_tier")} disabled={!selected.size || actionMutation.isPending}>Set tier</Button><Button size="sm" variant="outline" className="h-8 border-rose-200 text-xs text-rose-700 hover:bg-rose-50" onClick={() => runAction("reject")} disabled={!selected.size || actionMutation.isPending}>Remove</Button></div><p className="text-xs text-muted-foreground"><strong className="text-foreground">Target action:</strong> calculated price is retained; exceptions require a reason and owner.</p></div>
        <div className="overflow-x-auto"><Table className="min-w-[1280px]"><TableHeader><TableRow className="bg-muted/20"><TableHead className="w-11"><Checkbox checked={allVisibleSelected} onCheckedChange={toggleVisible} /></TableHead><TableHead className="w-14">Row</TableHead><TableHead>Requested / ITT Part</TableHead><TableHead className="min-w-48">Description</TableHead><TableHead className="text-right">Qty / EAU</TableHead><TableHead>Cost</TableHead><TableHead className="text-right">List</TableHead><TableHead className="text-right">Floor</TableHead><TableHead className="text-right">Target</TableHead><TableHead className="text-right">Proposed</TableHead><TableHead className="text-right">GM</TableHead><TableHead className="text-right">Win</TableHead><TableHead>Status</TableHead><TableHead className="w-24"></TableHead></TableRow></TableHeader><TableBody>{visibleItems.map((item: any) => { const part = item.ittPartNumber || item.requestedPartNumber || item.sourcePartNumber; const duplicate = item.sourceData?.__potentialDuplicate; return <TableRow key={item.id} className={selected.has(item.id) ? "bg-primary/[0.035]" : ""}><TableCell><Checkbox disabled={item.reviewStatus === "invalid" || item.reviewStatus === "rejected"} checked={selected.has(item.id)} onCheckedChange={() => toggle(item.id)} /></TableCell><TableCell className="font-mono text-xs text-muted-foreground">{item.sourceRow}</TableCell><TableCell><div className="flex items-center gap-1.5"><span className="font-mono text-xs font-semibold">{part || "—"}</span>{duplicate ? <Badge variant="outline" className="border-amber-200 bg-amber-50 px-1 py-0 text-[9px] text-amber-700">Dup.</Badge> : null}</div>{item.family && <span className="mt-1 block text-[10px] text-muted-foreground">{item.family}</span>}</TableCell><TableCell className="max-w-56 truncate text-xs text-muted-foreground" title={item.description ?? ""}>{item.description || "No description"}</TableCell><TableCell className="text-right text-xs"><strong>{Number(item.quantity).toLocaleString()}</strong>{item.annualUsage ? <span className="block text-[10px] text-muted-foreground">EAU {Number(item.annualUsage).toLocaleString()}</span> : null}</TableCell><TableCell><Badge variant="outline" className={`text-[10px] ${item.costValidation === "validated" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : item.costValidation === "estimated" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>{item.costValidation}</Badge>{item.projectedCost || item.standardCost ? <span className="mt-1 block font-mono text-[10px] text-muted-foreground">{money(item.projectedCost ?? item.standardCost)}</span> : null}</TableCell><TableCell className="text-right font-mono text-xs">{money(item.listPrice)}</TableCell><TableCell className="text-right font-mono text-xs text-muted-foreground">{money(item.floorPrice)}</TableCell><TableCell className="text-right font-mono text-xs font-semibold">{money(item.targetPrice)}</TableCell><TableCell className="text-right font-mono text-xs font-bold text-primary">{money(item.proposedPrice)}</TableCell><TableCell className={`text-right font-mono text-xs font-semibold ${Number(item.grossMarginPct) >= 35 ? "text-emerald-700" : Number(item.grossMarginPct) < 25 ? "text-rose-700" : "text-amber-700"}`}>{percent(item.grossMarginPct)}</TableCell><TableCell className="text-right font-mono text-xs">{percent(item.winProbability)}</TableCell><TableCell><Badge variant="outline" className={`whitespace-nowrap text-[10px] ${STATUS_STYLE[item.reviewStatus]}`}>{item.reviewStatus.replaceAll("_", " ")}</Badge>{item.validationErrors?.length ? <span title={item.validationErrors.join(" ")} className="mt-1 flex items-center gap-1 text-[10px] text-rose-700"><AlertTriangle className="h-3 w-3" /> correction</span> : null}</TableCell><TableCell><div className="flex justify-end gap-1"><Button size="sm" variant="ghost" className="h-7 px-2 text-[10px] text-emerald-700 hover:bg-emerald-50" onClick={() => runAction("approve_target", [item.id])} disabled={item.reviewStatus === "invalid" || actionMutation.isPending}><Check className="h-3.5 w-3.5" /></Button><Button size="sm" variant="ghost" className="h-7 px-2 text-[10px] text-amber-700 hover:bg-amber-50" onClick={() => openException(item)} disabled={item.reviewStatus === "invalid"}><Flag className="h-3.5 w-3.5" /></Button></div></TableCell></TableRow>; })}{!visibleItems.length && <TableRow><TableCell colSpan={14} className="py-10 text-center text-sm text-muted-foreground">No lines match this filter.</TableCell></TableRow>}</TableBody></Table></div>
      </Card>
      </div>

      {selected.size === 1 && reviewMode === "pricing" ? <Card className="border-violet-200 bg-violet-50/40"><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="flex items-center gap-2 text-sm font-semibold text-violet-950"><CircleDollarSign className="h-4 w-4 text-violet-700" /> Line-level pricing review</p><p className="mt-1 text-xs text-violet-800">Open the selected line to use the full one-line pricing view, change its recommendation tier, or enter a governed custom target.</p></div><Button size="sm" onClick={() => setDetailItemId(Array.from(selected)[0])} className="shrink-0 gap-2"><ChevronRight className="h-4 w-4" /> Review or override line</Button></CardContent></Card> : null}

      <Card id="bulk-approval-handoff" className={approvalReady ? "border-amber-300 bg-gradient-to-r from-amber-50 via-background to-primary/[0.05] shadow-md" : "border-rose-200 bg-rose-50/50"}>
        <CardContent className="p-5 md:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 gap-4">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${approvalReady ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-700"}`}>
                {approvalReady ? <ShieldAlert className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
              </div>
              <div>
                <p className={`text-[11px] font-bold uppercase tracking-[.14em] ${approvalReady ? "text-amber-800" : "text-rose-700"}`}>Exception approval handoff</p>
                <h3 className="mt-1 text-xl font-bold text-foreground">{approvalReady ? review.summary.counts.exceptions ? `${review.summary.counts.exceptions} exception${review.summary.counts.exceptions === 1 ? "" : "s"} ready for approval` : "Target-price package ready for approval" : `${unresolvedCount} line decision${unresolvedCount === 1 ? "" : "s"} still block approval`}</h3>
                <p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground">{approvalReady ? review.summary.counts.exceptions ? `The exception lines total ${money(exceptionValue)}. Their price, owner, and business rationale will be carried into a new governed quote; every other decided line is included at its approved or documented target.` : "All decided lines will be packaged into a governed quote at their approved target prices." : "Resolve every pending line and correct all invalid imports before this opportunity can be routed to the approval queue."}</p>
              </div>
            </div>
            <div className="grid shrink-0 grid-cols-2 gap-x-7 gap-y-3 rounded-lg border bg-white/80 px-4 py-3 text-xs sm:grid-cols-3">
              <div><span className="block text-[10px] font-semibold uppercase tracking-[.1em] text-muted-foreground">Decision coverage</span><strong className="font-mono text-base">{decisionCount} / {review.items.length}</strong></div>
              <div><span className="block text-[10px] font-semibold uppercase tracking-[.1em] text-muted-foreground">First approver</span><strong>Level {startLevel} · {approverRole}</strong></div>
              <div><span className="block text-[10px] font-semibold uppercase tracking-[.1em] text-muted-foreground">Approval chain</span><strong>Five levels</strong></div>
            </div>
          </div>
          {approvalReady && <div className="mt-5 grid gap-2 md:grid-cols-3"><div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900"><span className="flex items-center gap-1.5 font-semibold"><CheckCircle2 className="h-3.5 w-3.5" /> 1. Pricing decisions complete</span><p className="mt-1 leading-5 text-emerald-800">{decisionCount} of {review.items.length} lines are approved, overridden, exceptioned, or excluded.</p></div><div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-3 text-xs text-amber-950 shadow-sm"><span className="flex items-center gap-1.5 font-bold"><ShieldAlert className="h-3.5 w-3.5" /> 2. Submit the approval package</span><p className="mt-1 leading-5 text-amber-900">{governedDecisionCount ? `${governedDecisionCount} price exception / commercial override decision${governedDecisionCount === 1 ? " is" : "s are"} documented and ready to route.` : "The approved target-price package is ready to route."}</p></div><div className="rounded-lg border bg-slate-50 p-3 text-xs text-slate-800"><span className="flex items-center gap-1.5 font-semibold"><ChevronRight className="h-3.5 w-3.5" /> 3. Five-level authorization</span><p className="mt-1 leading-5 text-slate-600">The package starts at Level {startLevel} with {approverRole}, then appears in the Approval Queue.</p></div></div>}
          {approvalReady && <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/70 p-4"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="text-sm"><p className="font-semibold text-amber-950">Review the approval package before routing it.</p><p className="mt-1 text-xs leading-5 text-amber-800">Average discount is {percent(review.summary.averageDiscount)}, so the package begins with <strong>Level {startLevel}: {approverRole}</strong>. Flagged exceptions and target overrides remain visibly documented for every approval level.</p></div>{approvalConfirmationOpen ? <div className="flex shrink-0 flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => setApprovalConfirmationOpen(false)}>Back to review</Button><Button size="sm" onClick={() => submitMutation.mutate({ opportunityToken: review.opportunity.opportunityToken })} disabled={submitMutation.isPending} className="gap-2 bg-slate-950 text-white hover:bg-slate-800">{submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />} Submit {governedDecisionCount ? `${governedDecisionCount} governed pricing decision${governedDecisionCount === 1 ? "" : "s"}` : "quote"} for approval</Button></div> : <Button size="sm" onClick={() => setApprovalConfirmationOpen(true)} className="shrink-0 gap-2"><ShieldAlert className="h-4 w-4" /> Review & submit for approval</Button>}</div></div>}
          {!approvalReady && <div className="mt-5 flex flex-wrap gap-2 text-xs"><Badge variant="outline" className="border-rose-200 bg-white text-rose-700">{review.summary.counts.pending} awaiting decision</Badge><Badge variant="outline" className="border-rose-200 bg-white text-rose-700">{review.summary.counts.invalid} needs correction</Badge><span className="self-center text-muted-foreground">Use the Price Decision grid to approve a target, flag a documented exception, or correct the source line.</span></div>}
        </CardContent>
      </Card>

      <div className="sticky bottom-4 z-20 flex flex-col gap-4 rounded-xl border border-primary/20 bg-slate-950 px-5 py-4 text-white shadow-xl md:flex-row md:items-center md:justify-between"><div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm"><div><span className="block text-[10px] uppercase tracking-[.14em] text-slate-400">Decision coverage</span><strong>{decisionCount} / {review.items.length} lines</strong></div><div><span className="block text-[10px] uppercase tracking-[.14em] text-slate-400">Exceptions to route</span><strong className={review.summary.counts.exceptions ? "text-amber-300" : ""}>{review.summary.counts.exceptions}</strong></div><div><span className="block text-[10px] uppercase tracking-[.14em] text-slate-400">First approval</span><strong>Level {startLevel} · {approverRole}</strong></div></div><Button size="lg" onClick={openApprovalHandoff} disabled={!approvalReady || submitMutation.isPending} className="gap-2 bg-amber-400 text-slate-950 hover:bg-amber-300">{submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}{approvalReady ? review.summary.counts.exceptions ? `Review ${review.summary.counts.exceptions} exception${review.summary.counts.exceptions === 1 ? "" : "s"} for approval` : "Review quote for approval" : `Resolve ${unresolvedCount} line decision${unresolvedCount === 1 ? "" : "s"}`}</Button></div>
      <BulkLinePricingWorkspace opportunityToken={review.opportunity.opportunityToken} itemId={detailItemId} userName={userName} onClose={() => setDetailItemId(null)} onSaved={async () => { await utils.bulkOpportunities.getReview.invalidate({ opportunityToken: review.opportunity.opportunityToken }); setSelected(new Set()); }} />
    </div>
  );
}
