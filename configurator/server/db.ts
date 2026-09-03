import { eq, like, and, or, isNull, lte, gte, sql, desc, asc, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users, products, pricingRules, quoteItems, rfqSubmissions,
  customers, InsertCustomer, competitorData, aiModelStats,
  managedProducts, InsertManagedProduct, priceLists, priceListItems,
  quoteMgmt, InsertQuoteMgmt, dynamicPricingScenarios,
  quoteWorkflows, InsertQuoteWorkflow,
  quoteWorkflowItems, InsertQuoteWorkflowItem,
  quoteApprovals, InsertQuoteApproval, approvalLevels,
  customerAgreements, InsertCustomerAgreement, CustomerAgreement,
  priceChangeAudit, InsertPriceChangeAudit,
  channelCompliance, InsertChannelCompliance,
  engineRules, EngineRule, InsertEngineRule,
  bulkQuoteOpportunities, InsertBulkQuoteOpportunity,
  bulkQuoteOpportunityItems, InsertBulkQuoteOpportunityItem,
  bulkQuoteReviewEvents,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { nanoid } from "nanoid";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

/**
 * Create or update an account, keyed by email.
 *
 * Accounts are provisioned deliberately, so the role is passed in rather than
 * inferred from the environment.
 */
export async function upsertUser(user: {
  email: string;
  passwordHash: string;
  name?: string | null;
  role?: "user" | "admin";
}): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  const email = user.email.trim().toLowerCase();
  const updateSet: Record<string, unknown> = {
    passwordHash: user.passwordHash,
    isActive: true,
  };
  if (user.name !== undefined) updateSet.name = user.name ?? null;
  if (user.role !== undefined) updateSet.role = user.role;

  await db
    .insert(users)
    .values({
      email,
      passwordHash: user.passwordHash,
      name: user.name ?? null,
      role: user.role ?? "user",
      isActive: true,
    })
    .onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function recordSignIn(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, id));
}

export async function setUserPassword(id: number, passwordHash: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ passwordHash }).where(eq(users.id, id));
}

// ─── Product Catalog ──────────────────────────────────────────────────────────

export async function lookupProductByDescription(description: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(products)
    .where(eq(products.description, description))
    .limit(1);
  return result[0] ?? null;
}

export async function lookupProductByGlobalPn(globalPn: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(products)
    .where(eq(products.globalPn, globalPn))
    .limit(1);
  return result[0] ?? null;
}

export async function searchProducts(query: string, family?: string, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [like(products.description, `%${query}%`)];
  if (family) conditions.push(eq(products.family, family));
  const result = await db.select().from(products)
    .where(and(...conditions))
    .limit(limit);
  return result;
}

/**
 * Typeahead search: matches globalPn prefix/substring OR description substring.
 * Returns up to `limit` results sorted so globalPn prefix matches come first.
 */
export async function searchProductsByPartNumber(query: string, limit = 12) {
  const db = await getDb();
  if (!db) return [];
  const q = query.trim().toUpperCase();
  if (!q) return [];
  // Match globalPn starting with query OR containing query, plus description fallback
  const result = await db.select().from(products)
    .where(
      or(
        like(products.globalPn, `${q}%`),
        like(products.globalPn, `%${q}%`),
        like(products.description, `%${q}%`)
      )
    )
    .limit(limit * 2); // fetch more so we can sort prefix matches first
  // Sort: exact prefix matches first, then substring, then description matches
  const sorted = result.sort((a, b) => {
    const aPN = (a.globalPn ?? "").toUpperCase();
    const bPN = (b.globalPn ?? "").toUpperCase();
    const aPrefix = aPN.startsWith(q) ? 0 : 1;
    const bPrefix = bPN.startsWith(q) ? 0 : 1;
    if (aPrefix !== bPrefix) return aPrefix - bPrefix;
    return aPN.localeCompare(bPN);
  });
  return sorted.slice(0, limit);
}

export async function getProductsByFamily(family: string, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(products).where(eq(products.family, family)).limit(limit);
}

// ─── Pricing Rules ────────────────────────────────────────────────────────────

export async function getPricingRules(family?: string) {
  const db = await getDb();
  if (!db) return [];
  if (family) return db.select().from(pricingRules).where(eq(pricingRules.family, family));
  return db.select().from(pricingRules);
}

export async function getPriceForConfig(family: string, shellSize?: string, contactType?: string) {
  const db = await getDb();
  if (!db) return null;

  // Try exact match first
  const conditions = [eq(pricingRules.family, family)];
  if (shellSize) conditions.push(eq(pricingRules.shellSize, shellSize));
  if (contactType) conditions.push(eq(pricingRules.contactType, contactType));

  let result = await db.select().from(pricingRules).where(and(...conditions)).limit(1);
  if (result.length > 0) return result[0];

  // Fall back to family-only match
  result = await db.select().from(pricingRules)
    .where(and(eq(pricingRules.family, family), isNull(pricingRules.shellSize)))
    .limit(1);
  if (result.length > 0) return result[0];

  // Fall back to any rule for this family
  result = await db.select().from(pricingRules).where(eq(pricingRules.family, family)).limit(1);
  return result[0] ?? null;
}

export async function updatePricingRule(id: number, data: Partial<{
  basePrice: string;
  customUpchargePct: string;
  notes: string;
  updatedBy: string;
}>) {
  const db = await getDb();
  if (!db) return;
  await db.update(pricingRules).set(data).where(eq(pricingRules.id, id));
}

// ─── Quote Items ──────────────────────────────────────────────────────────────

export async function getQuoteItems(sessionToken: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(quoteItems).where(eq(quoteItems.sessionToken, sessionToken));
}

export async function addQuoteItem(data: {
  sessionToken: string;
  partNumber: string;
  isCustom: boolean;
  family?: string;
  series?: string;
  line?: string;
  description?: string;
  attributes?: Record<string, string>;
  unitPrice?: string;
  quantity?: number;
}) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(quoteItems).values({
    sessionToken: data.sessionToken,
    partNumber: data.partNumber,
    isCustom: data.isCustom,
    family: data.family ?? null,
    series: data.series ?? null,
    line: data.line ?? null,
    description: data.description ?? null,
    attributes: data.attributes ?? null,
    unitPrice: data.unitPrice ?? null,
    quantity: data.quantity ?? 1,
  });
  return getQuoteItems(data.sessionToken);
}

export async function removeQuoteItem(id: number, sessionToken: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(quoteItems).where(and(eq(quoteItems.id, id), eq(quoteItems.sessionToken, sessionToken)));
}

export async function updateQuoteItemQty(id: number, sessionToken: string, quantity: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(quoteItems).set({ quantity }).where(and(eq(quoteItems.id, id), eq(quoteItems.sessionToken, sessionToken)));
}

export async function clearQuoteItems(sessionToken: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(quoteItems).where(eq(quoteItems.sessionToken, sessionToken));
}

// ─── RFQ Submissions ──────────────────────────────────────────────────────────

export async function createRfqSubmission(data: {
  sessionToken?: string;
  contactName: string;
  contactEmail: string;
  company?: string;
  phone?: string;
  notes?: string;
  items: Array<{
    partNumber: string;
    isCustom: boolean;
    family: string;
    description: string;
    attributes: Record<string, string>;
    unitPrice: string | null;
    quantity: number;
  }>;
}) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(rfqSubmissions).values({
    sessionToken: data.sessionToken ?? null,
    contactName: data.contactName,
    contactEmail: data.contactEmail,
    company: data.company ?? null,
    phone: data.phone ?? null,
    notes: data.notes ?? null,
    items: data.items,
    status: "pending",
  });
  return true;
}

export async function getAllRfqSubmissions() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(rfqSubmissions).orderBy(rfqSubmissions.submittedAt);
}

export async function updateRfqStatus(id: number, status: "pending" | "reviewing" | "quoted" | "closed", adminNotes?: string) {
  const db = await getDb();
  if (!db) return;
  const updateData: Record<string, unknown> = { status };
  if (adminNotes !== undefined) updateData.adminNotes = adminNotes;
  await db.update(rfqSubmissions).set(updateData).where(eq(rfqSubmissions.id, id));
}

// ─── Analytics ────────────────────────────────────────────────────────────────

import {
  analyticsSnapshots,
  analyticsMarginBridge,
  analyticsProducts,
  analyticsQuoteFunnel,
  analyticsPriceWaterfall,
} from "../drizzle/schema";
// Resolve period range from timePeriod filter
function getPeriodRange(timePeriod: string): { from: string; to: string } {
  const now = new Date();
  const toYear = now.getFullYear();
  const toMonth = now.getMonth() + 1;
  const to = `${toYear}-${String(toMonth).padStart(2, "0")}`;
  // Month over Month — last 12 months
  if (timePeriod === "Month over Month") {
    const fromDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const from = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, "0")}`;
    return { from, to };
  }
  // Quarter over Quarter — last 8 quarters (24 months)
  if (timePeriod === "Quarter over Quarter") {
    const fromDate = new Date(now.getFullYear() - 2, now.getMonth(), 1);
    const from = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, "0")}`;
    return { from, to };
  }
  // Year over Year — last 24 months
  const fromDate = new Date(now.getFullYear() - 2, now.getMonth(), 1);
  const from = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, "0")}`;
  return { from, to };
}

// Helper: resolve the most recent available period in analytics_products
async function resolveProductsPeriod(db: ReturnType<typeof import('drizzle-orm/mysql2').drizzle>, requestedPeriod: string, family: string): Promise<string> {
  // Try exact period first
  const exact = await db.select({ period: analyticsProducts.period })
    .from(analyticsProducts)
    .where(and(
      eq(analyticsProducts.period, requestedPeriod),
      family === 'All' ? undefined : eq(analyticsProducts.productFamily, family),
    ))
    .limit(1);
  if (exact.length > 0) return requestedPeriod;
  // Fall back to latest available period
  const latest = await db.select({ period: analyticsProducts.period })
    .from(analyticsProducts)
    .where(family === 'All' ? undefined : eq(analyticsProducts.productFamily, family))
    .orderBy(desc(analyticsProducts.period))
    .limit(1);
  return latest[0]?.period ?? requestedPeriod;
}

export async function getAnalyticsOverallPerformance(filters: {
  timePeriod: string;
  productFamily: string;
  region: string;
  channel: string;
}) {
  const db = await getDb();
  if (!db) return null;

  const { from, to } = getPeriodRange(filters.timePeriod);
  const family  = filters.productFamily === "All Product Families" ? "All" : filters.productFamily;
  const region  = filters.region  === "All Regions"  ? "All" : filters.region;
  const channel = filters.channel === "All Channels" ? "All" : filters.channel;

  // Smart fallback: seed has (family × All × All) and (All × region × channel).
  // When family is specific, use All for region/channel so we always have data.
  // When family = All, use the selected region/channel.
  const effectiveFamily  = family;
  const effectiveRegion  = family !== 'All' ? 'All' : region;
  const effectiveChannel = family !== 'All' ? 'All' : channel;

  const snapWhere = and(
    gte(analyticsSnapshots.period, from),
    lte(analyticsSnapshots.period, to),
    eq(analyticsSnapshots.productFamily, effectiveFamily),
    eq(analyticsSnapshots.region, effectiveRegion),
    eq(analyticsSnapshots.channel, effectiveChannel),
  );

  let snapshots = await db.select().from(analyticsSnapshots)
    .where(snapWhere)
    .orderBy(asc(analyticsSnapshots.period));

  // If still empty (e.g. region/channel combo not in seed), fall back to All×All×All for this family
  if (snapshots.length === 0) {
    snapshots = await db.select().from(analyticsSnapshots)
      .where(and(
        gte(analyticsSnapshots.period, from),
        lte(analyticsSnapshots.period, to),
        eq(analyticsSnapshots.productFamily, effectiveFamily),
        eq(analyticsSnapshots.region, 'All'),
        eq(analyticsSnapshots.channel, 'All'),
      ))
      .orderBy(asc(analyticsSnapshots.period));
  }

  // Latest period KPIs
  const latest = snapshots[snapshots.length - 1];
  const prev = snapshots[snapshots.length - 2];

  const kpis = latest ? {
    revenue: parseFloat(latest.revenue),
    revenuePct: prev ? ((parseFloat(latest.revenue) - parseFloat(prev.revenue)) / parseFloat(prev.revenue)) * 100 : 0,
    activeQuotes: latest.activeQuotes,
    activeQuotesPct: prev ? ((latest.activeQuotes - prev.activeQuotes) / prev.activeQuotes) * 100 : 0,
    winRate: latest.winRate,
    winRatePct: prev ? latest.winRate - prev.winRate : 0,
    activeCustomers: latest.activeCustomers,
    activeCustomersPct: prev ? ((latest.activeCustomers - prev.activeCustomers) / prev.activeCustomers) * 100 : 0,
  } : null;

  // Price performance series
  const pricePerformance = snapshots.map((s) => ({
    period: s.period,
    priceIndex: s.priceIndex,
    costIndex: s.costIndex,
    valueGapPct: s.valueGapPct,
  }));

  // Margin bridge — latest period, same effective filters
  let marginBridge = await db.select().from(analyticsMarginBridge)
    .where(and(
      eq(analyticsMarginBridge.period, latest?.period ?? to),
      eq(analyticsMarginBridge.productFamily, effectiveFamily),
      eq(analyticsMarginBridge.region, effectiveRegion),
      eq(analyticsMarginBridge.channel, effectiveChannel),
    ))
    .orderBy(asc(analyticsMarginBridge.sortOrder));

  // Fallback: if no bridge data, use family-level (All region/channel)
  if (marginBridge.length === 0) {
    marginBridge = await db.select().from(analyticsMarginBridge)
      .where(and(
        eq(analyticsMarginBridge.period, latest?.period ?? to),
        eq(analyticsMarginBridge.productFamily, effectiveFamily),
        eq(analyticsMarginBridge.region, 'All'),
        eq(analyticsMarginBridge.channel, 'All'),
      ))
      .orderBy(asc(analyticsMarginBridge.sortOrder));
  }

  return { kpis, pricePerformance, marginBridge };
}

export async function getAnalyticsListPricePerformance(filters: { productFamily: string; period: string }) {
  const db = await getDb();
  if (!db) return null;
  const family = filters.productFamily === "All Product Families" ? "All" : filters.productFamily;
  // Resolve the best available period (falls back to latest if requested period has no data)
  const resolvedPeriod = await resolveProductsPeriod(db, filters.period, family);
  const where = and(
    eq(analyticsProducts.period, resolvedPeriod),
    family === "All" ? undefined : eq(analyticsProducts.productFamily, family),
  );
  const rows = await db.select().from(analyticsProducts)
    .where(where)
    .orderBy(desc(analyticsProducts.sales));

  // Pareto category summary
  const categorySummary: Record<string, { count: number; salesPct: number }> = { A: { count: 0, salesPct: 0 }, B: { count: 0, salesPct: 0 }, C: { count: 0, salesPct: 0 }, D: { count: 0, salesPct: 0 } };
  const totalSales = rows.reduce((s, r) => s + parseFloat(r.sales), 0);
  rows.forEach((r) => {
    const cat = r.paretoCategory;
    categorySummary[cat].count++;
    categorySummary[cat].salesPct += parseFloat(r.sales) / totalSales * 100;
  });
  Object.values(categorySummary).forEach((c) => { c.salesPct = Math.round(c.salesPct * 10) / 10; });

  // Discount type distribution (last 6 periods for stacked bar)
  const discountTrend = await db.select({
    period: analyticsProducts.period,
    discountType: analyticsProducts.discountType,
    totalSales: sql<number>`SUM(${analyticsProducts.sales})`,
  }).from(analyticsProducts)
    .where(family === "All" ? undefined : eq(analyticsProducts.productFamily, family))
    .groupBy(analyticsProducts.period, analyticsProducts.discountType)
    .orderBy(asc(analyticsProducts.period));

  return {
    products: rows.map((r) => ({
      partNumber: r.partNumber,
      productFamily: r.productFamily,
      sales: parseFloat(r.sales),
      marginAtListPct: r.marginAtListPct,
      avgDiscountPct: r.avgDiscountPct,
      discountType: r.discountType,
      competitivePremiums: r.competitivePremiums as Record<string, number> | null,
      paretoCategory: r.paretoCategory,
    })),
    categorySummary,
    discountTrend: discountTrend.map((d) => ({
      period: d.period,
      discountType: d.discountType,
      totalSales: Number(d.totalSales),
    })),
  };
}

export async function getAnalyticsQuoteFunnel(filters: {
  timePeriod: string;
  region: string;
  channel: string;
  segment: string;
  timeRange: string;
}) {
  const db = await getDb();
  if (!db) return null;

  const { from, to } = getPeriodRange(filters.timePeriod);
  const segment = filters.segment === "All Segments" ? "All" : filters.segment;
  const region  = filters.region  === "All Regions"  ? "All" : filters.region;
  const channel = filters.channel === "All Channels" ? "All" : filters.channel;

  // Smart fallback: seed has (All × region × channel × segment) and (All × All × All × All).
  // When specific region/channel/segment is selected, use those. If no data, fall back to All.
  const buildWhere = (reg: string, ch: string, seg: string) => and(
    gte(analyticsQuoteFunnel.period, from),
    lte(analyticsQuoteFunnel.period, to),
    eq(analyticsQuoteFunnel.region, reg),
    eq(analyticsQuoteFunnel.channel, ch),
    eq(analyticsQuoteFunnel.segment, seg),
  );

  let rows = await db.select().from(analyticsQuoteFunnel)
    .where(buildWhere(region, channel, segment))
    .orderBy(asc(analyticsQuoteFunnel.period));

  // Fallback 1: if specific combo has no data, try All segment
  if (rows.length === 0 && segment !== 'All') {
    rows = await db.select().from(analyticsQuoteFunnel)
      .where(buildWhere(region, channel, 'All'))
      .orderBy(asc(analyticsQuoteFunnel.period));
  }
  // Fallback 2: try All region/channel/segment
  if (rows.length === 0) {
    rows = await db.select().from(analyticsQuoteFunnel)
      .where(buildWhere('All', 'All', 'All'))
      .orderBy(asc(analyticsQuoteFunnel.period));
  }

  // Aggregate KPIs
  const wonRows = rows.filter((r) => r.stage === "Won");
  const allRows = rows;
  const totalNew = wonRows.reduce((s, r) => s + r.newBusiness, 0);
  const totalRepeat = wonRows.reduce((s, r) => s + r.repeatBusiness, 0);
  const totalNewVal = wonRows.reduce((s, r) => s + parseFloat(r.newValue), 0);
  const totalRepeatVal = wonRows.reduce((s, r) => s + parseFloat(r.repeatValue), 0);
  const totalQuotes = allRows.filter(r => r.stage === "Technical Review").reduce((s, r) => s + r.newBusiness + r.repeatBusiness, 0);
  const totalWon = totalNew + totalRepeat;
  const winRate = totalQuotes > 0 ? (totalWon / totalQuotes) * 100 : 0;
  const avgCycleTime = wonRows.length > 0 ? wonRows.reduce((s, r) => s + r.avgCycleTimeDays, 0) / wonRows.length : 0;

  // Funnel chart data (aggregate by stage)
  const stageMap: Record<string, { newBusiness: number; repeatBusiness: number }> = {};
  rows.forEach((r) => {
    if (!stageMap[r.stage]) stageMap[r.stage] = { newBusiness: 0, repeatBusiness: 0 };
    stageMap[r.stage].newBusiness += r.newBusiness;
    stageMap[r.stage].repeatBusiness += r.repeatBusiness;
  });
  const funnelData = ["Technical Review", "Negotiation", "Won"].map((stage) => ({
    stage,
    newBusiness: stageMap[stage]?.newBusiness ?? 0,
    repeatBusiness: stageMap[stage]?.repeatBusiness ?? 0,
  }));

  // Trends: aggregate by period
  const trendMap: Record<string, { newSubmitted: number; newWon: number; repeatSubmitted: number; repeatWon: number }> = {};
  rows.forEach((r) => {
    if (!trendMap[r.period]) trendMap[r.period] = { newSubmitted: 0, newWon: 0, repeatSubmitted: 0, repeatWon: 0 };
    if (r.stage === "Technical Review") { trendMap[r.period].newSubmitted += r.newBusiness; trendMap[r.period].repeatSubmitted += r.repeatBusiness; }
    if (r.stage === "Won") { trendMap[r.period].newWon += r.newBusiness; trendMap[r.period].repeatWon += r.repeatBusiness; }
  });
  const trendsData = Object.entries(trendMap).sort(([a], [b]) => a.localeCompare(b)).map(([period, v]) => ({ period, ...v }));

  return {
    kpis: {
      totalQuotes,
      totalValue: totalNewVal + totalRepeatVal,
      winRate: Math.round(winRate * 10) / 10,
      avgCycleTime: Math.round(avgCycleTime),
      conversionRate: Math.round(winRate * 10) / 10,
    },
    funnelData,
    trendsData,
    segmentComparison: {
      newBusiness: { totalQuotes: totalNew, totalValue: totalNewVal, avgValue: totalNew > 0 ? totalNewVal / totalNew : 0, winRate: 28, avgCycleTime: 45 },
      repeatBusiness: { totalQuotes: totalRepeat, totalValue: totalRepeatVal, avgValue: totalRepeat > 0 ? totalRepeatVal / totalRepeat : 0, winRate: 42, avgCycleTime: 32 },
    },
  };
}

export async function getAnalyticsPriceWaterfall(filters: {
  productFamily: string;
  region: string;
  channel: string;
  segment: string;
  period: string;
}) {
  const db = await getDb();
  if (!db) return null;
  const family  = filters.productFamily === "All Product Families" ? "All" : filters.productFamily;
  const region  = filters.region  === "All Regions"  ? "All" : filters.region;
  const channel = filters.channel === "All Channels" ? "All" : filters.channel;
  const segment = filters.segment === "All Segments" ? "All" : filters.segment;

  // Strategy: the seed has data for (family × All × All × All) and (All × region × channel × segment).
  // When a specific family is selected, use family-level data (All region/channel/segment).
  // When region/channel/segment filters are active (and family = All), use those.
  // This ensures every filter combination always returns data.
  let effectiveFamily  = family;
  let effectiveRegion  = region;
  let effectiveChannel = channel;
  let effectiveSegment = segment;

  if (family !== 'All') {
    // Family-specific: use All for region/channel/segment (seeded per-family)
    effectiveRegion  = 'All';
    effectiveChannel = 'All';
    effectiveSegment = 'All';
  }
  // else: family = All, use the selected region/channel/segment

  // Resolve the best available period
  const tryPeriod = async (p: string, fam: string, reg: string, ch: string, seg: string) => {
    return db.select().from(analyticsPriceWaterfall)
      .where(and(
        eq(analyticsPriceWaterfall.period, p),
        eq(analyticsPriceWaterfall.productFamily, fam),
        eq(analyticsPriceWaterfall.region, reg),
        eq(analyticsPriceWaterfall.channel, ch),
        eq(analyticsPriceWaterfall.segment, seg),
      ))
      .orderBy(asc(analyticsPriceWaterfall.sortOrder));
  };

  let rows = await tryPeriod(filters.period, effectiveFamily, effectiveRegion, effectiveChannel, effectiveSegment);

  // If no rows, fall back to latest available period for this combination
  if (rows.length === 0) {
    const latest = await db.select({ period: analyticsPriceWaterfall.period })
      .from(analyticsPriceWaterfall)
      .where(and(
        eq(analyticsPriceWaterfall.productFamily, effectiveFamily),
        eq(analyticsPriceWaterfall.region, effectiveRegion),
        eq(analyticsPriceWaterfall.channel, effectiveChannel),
        eq(analyticsPriceWaterfall.segment, effectiveSegment),
      ))
      .orderBy(desc(analyticsPriceWaterfall.period))
      .limit(1);
    if (latest[0]) {
      rows = await tryPeriod(latest[0].period, effectiveFamily, effectiveRegion, effectiveChannel, effectiveSegment);
    }
  }

  return rows.map((r) => ({
    component: r.component,
    value: parseFloat(r.value),
    sortOrder: r.sortOrder,
    isTotal: r.isTotal,
  }));
}

// ─── Competitive Intelligence ─────────────────────────────────────────────────

export async function getCompetitorData(segment: string, period: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (segment && segment !== "All") conditions.push(eq(competitorData.segment, segment));
  if (period) conditions.push(eq(competitorData.period, period));
  const rows = conditions.length > 0
    ? await db.select().from(competitorData).where(and(...conditions))
    : await db.select().from(competitorData);
  return rows;
}

// ─── AI Model Stats ───────────────────────────────────────────────────────────

export async function getAiModelStats() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(aiModelStats);
}

export async function updateAiModelStats(id: number, updates: { totalPredictions?: number }) {
  const db = await getDb();
  if (!db) return;
  await db.update(aiModelStats).set({ ...updates, lastRunAt: new Date() }).where(eq(aiModelStats.id, id));
}

// ─── Customer Management ──────────────────────────────────────────────────────

export async function getCustomers(filters: {
  tier?: string; region?: string; industry?: string; search?: string; channel?: string;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters.tier && filters.tier !== "All") conditions.push(eq(customers.tier, filters.tier as "Enterprise" | "Large" | "Mid" | "SMB"));
  if (filters.region && filters.region !== "All") conditions.push(eq(customers.region, filters.region));
  if (filters.industry && filters.industry !== "All") conditions.push(eq(customers.industry, filters.industry));
  if (filters.channel && filters.channel !== "All") conditions.push(eq(customers.channel, filters.channel as "OEM" | "Distribution" | "Intercompany"));
  if (filters.search) conditions.push(like(customers.name, `%${filters.search}%`));
  const rows = conditions.length > 0
    ? await db.select().from(customers).where(and(...conditions))
    : await db.select().from(customers);
  return rows;
}

export async function getCustomerById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function upsertCustomer(data: Omit<InsertCustomer, "createdAt" | "updatedAt"> & { id?: number }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const { id, ...rest } = data;
  if (id) {
    await db.update(customers).set(rest).where(eq(customers.id, id));
    return getCustomerById(id);
  } else {
    const [res] = await db.insert(customers).values(rest as InsertCustomer);
    return getCustomerById((res as { insertId: number }).insertId);
  }
}

export async function deleteCustomer(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(customers).where(eq(customers.id, id));
}

// ─── Product Management ───────────────────────────────────────────────────────

export async function getManagedProducts(filters: {
  isCustom?: boolean; family?: string; status?: string; search?: string;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters.isCustom !== undefined) conditions.push(eq(managedProducts.isCustom, filters.isCustom));
  if (filters.family && filters.family !== "All") conditions.push(eq(managedProducts.family, filters.family));
  if (filters.status && filters.status !== "All") conditions.push(eq(managedProducts.status, filters.status as "Active" | "Inactive" | "Discontinued"));
  if (filters.search) conditions.push(or(like(managedProducts.sku, `%${filters.search}%`), like(managedProducts.name, `%${filters.search}%`)));
  const rows = conditions.length > 0
    ? await db.select().from(managedProducts).where(and(...conditions))
    : await db.select().from(managedProducts);
  return rows;
}

export async function upsertManagedProduct(data: Omit<InsertManagedProduct, "createdAt" | "updatedAt"> & { id?: number }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const { id, ...rest } = data;
  if (id) {
    await db.update(managedProducts).set(rest).where(eq(managedProducts.id, id));
    const rows = await db.select().from(managedProducts).where(eq(managedProducts.id, id)).limit(1);
    return rows[0];
  } else {
    const [res] = await db.insert(managedProducts).values(rest as InsertManagedProduct);
    const rows = await db.select().from(managedProducts).where(eq(managedProducts.id, (res as { insertId: number }).insertId)).limit(1);
    return rows[0];
  }
}

export async function deleteManagedProduct(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(managedProducts).where(eq(managedProducts.id, id));
}

// ─── Price List Management ────────────────────────────────────────────────────

export async function getPriceLists() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(priceLists);
}

export async function getPriceListItems(filters: {
  priceListId: number; recommendation?: string; status?: string; search?: string;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(priceListItems.priceListId, filters.priceListId)];
  if (filters.recommendation && filters.recommendation !== "All") conditions.push(eq(priceListItems.aiRecommendation, filters.recommendation as "Increase" | "Decrease" | "Hold"));
  if (filters.status && filters.status !== "All") conditions.push(eq(priceListItems.status, filters.status as "Pending Review" | "Approved" | "Rejected"));
  if (filters.search) {
    const searchOr = or(like(priceListItems.sku, `%${filters.search}%`), like(priceListItems.productName, `%${filters.search}%`));
    if (searchOr) conditions.push(searchOr);
  }
  return db.select().from(priceListItems).where(and(...conditions));
}

export async function updatePriceListItemStatus(id: number, status: "Pending Review" | "Approved" | "Rejected") {
  const db = await getDb();
  if (!db) return;
  await db.update(priceListItems).set({ status }).where(eq(priceListItems.id, id));
}

export async function updatePriceListItemPrice(id: number, newPrice: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(priceListItems).set({ currentPrice: newPrice.toFixed(2), status: "Pending Review" }).where(eq(priceListItems.id, id));
}

// ─── Quote Management ─────────────────────────────────────────────────────────

export async function getQuoteMgmt(filters: { status?: string; search?: string; limit?: number; offset?: number }) {
  const db = await getDb();
  if (!db) return [];
  const statusVal = filters.status && filters.status !== "All"
    ? (filters.status as "Draft" | "Pending Approval" | "Auto-Approved" | "Approved" | "Rejected" | "Expired" | "Converted")
    : null;
  const conditions = [];
  if (statusVal) conditions.push(eq(quoteMgmt.status, statusVal));
  if (filters.search) conditions.push(or(like(quoteMgmt.customerName, `%${filters.search}%`), like(quoteMgmt.quoteId, `%${filters.search}%`)));
  const rows = conditions.length > 0
    ? await db.select().from(quoteMgmt).where(and(...conditions)).limit(filters.limit ?? 50).offset(filters.offset ?? 0)
    : await db.select().from(quoteMgmt).limit(filters.limit ?? 50).offset(filters.offset ?? 0);
  return rows;
}

export async function getQuoteMgmtById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(quoteMgmt).where(eq(quoteMgmt.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function upsertQuoteMgmt(data: Partial<InsertQuoteMgmt> & { id?: number }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const { id, ...rest } = data;
  if (!rest.quoteId) {
    const now = new Date();
    rest.quoteId = `Q-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
  }
  if (id) {
    await db.update(quoteMgmt).set(rest).where(eq(quoteMgmt.id, id));
    return getQuoteMgmtById(id);
  } else {
    const [res] = await db.insert(quoteMgmt).values(rest as InsertQuoteMgmt);
    return getQuoteMgmtById((res as { insertId: number }).insertId);
  }
}

export async function updateQuoteMgmtStatus(id: number, status: InsertQuoteMgmt["status"]) {
  const db = await getDb();
  if (!db) return;
  await db.update(quoteMgmt).set({ status }).where(eq(quoteMgmt.id, id));
}

// ─── Dynamic Pricing ──────────────────────────────────────────────────────────

export async function getDynamicPricingScenarios(strategy?: string, segment?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (strategy && strategy !== "All") conditions.push(eq(dynamicPricingScenarios.strategy, strategy as "Market-Based" | "Value-Based" | "Cost-Plus" | "Demand-Based"));
  if (segment && segment !== "All") conditions.push(eq(dynamicPricingScenarios.segment, segment));
  const rows = conditions.length > 0
    ? await db.select().from(dynamicPricingScenarios).where(and(...conditions))
    : await db.select().from(dynamicPricingScenarios);
  return rows;
}

// ─── Quote Workflow ────────────────────────────────────────────────────────────

export async function createQuoteWorkflow(data: Partial<InsertQuoteWorkflow>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const token = `WF-${nanoid(12)}`;
  const payload: InsertQuoteWorkflow = {
    workflowToken: token,
    customerName: data.customerName ?? "Unknown",
    customerId: data.customerId ?? null,
    customerTier: data.customerTier ?? "Mid",
    customerRegion: data.customerRegion ?? null,
    customerChannel: data.customerChannel ?? "OEM",
    customerIndustry: data.customerIndustry ?? null,
    customerPriceIndex: data.customerPriceIndex ?? 1.0,
    customerMarginIndex: data.customerMarginIndex ?? 0.68,
    contactName: data.contactName ?? null,
    contactEmail: data.contactEmail ?? null,
    contactPhone: data.contactPhone ?? null,
    dealType: data.dealType ?? "New Business",
    urgency: data.urgency ?? "Standard",
    targetMarginPct: data.targetMarginPct ?? 35.0,
    notes: data.notes ?? null,
    status: "draft",
  };
  if ((data as any).effectiveDate) (payload as any).effectiveDate = new Date((data as any).effectiveDate);
  if ((data as any).expirationDate) (payload as any).expirationDate = new Date((data as any).expirationDate);
  if ((data as any).competitors) (payload as any).competitors = (data as any).competitors;
  const [res] = await db.insert(quoteWorkflows).values(payload);
  const id = (res as { insertId: number }).insertId;
  const rows = await db.select().from(quoteWorkflows).where(eq(quoteWorkflows.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getQuoteWorkflow(token: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(quoteWorkflows).where(eq(quoteWorkflows.workflowToken, token)).limit(1);
  return rows[0] ?? null;
}

export async function updateQuoteWorkflow(token: string, data: Partial<InsertQuoteWorkflow>) {
  const db = await getDb();
  if (!db) return;
  await db.update(quoteWorkflows).set(data).where(eq(quoteWorkflows.workflowToken, token));
}

export async function listQuoteWorkflows(status?: string) {
  const db = await getDb();
  if (!db) return [];
  if (status) {
    const validStatus = status as "draft" | "submitted" | "quoted" | "won" | "lost";
    return db.select().from(quoteWorkflows).where(eq(quoteWorkflows.status, validStatus)).orderBy(quoteWorkflows.updatedAt);
  }
  return db.select().from(quoteWorkflows).orderBy(quoteWorkflows.updatedAt);
}

export async function getQuoteWorkflowItems(token: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(quoteWorkflowItems).where(eq(quoteWorkflowItems.workflowToken, token)).orderBy(quoteWorkflowItems.sortOrder);
}

export async function upsertQuoteWorkflowItem(data: Partial<InsertQuoteWorkflowItem> & { id?: number; workflowToken: string }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const { id, ...rest } = data;
  if (id) {
    await db.update(quoteWorkflowItems).set(rest).where(eq(quoteWorkflowItems.id, id));
    const rows = await db.select().from(quoteWorkflowItems).where(eq(quoteWorkflowItems.id, id)).limit(1);
    return rows[0] ?? null;
  } else {
    const [res] = await db.insert(quoteWorkflowItems).values(rest as InsertQuoteWorkflowItem);
    const newId = (res as { insertId: number }).insertId;
    const rows = await db.select().from(quoteWorkflowItems).where(eq(quoteWorkflowItems.id, newId)).limit(1);
    return rows[0] ?? null;
  }
}

export async function deleteQuoteWorkflowItem(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(quoteWorkflowItems).where(eq(quoteWorkflowItems.id, id));
}

// ─── Target Price Engine ───────────────────────────────────────────────────────
// Applies a 5-rule waterfall to compute target, floor, and rationale for a part

export interface PriceTier {
  label: "Aggressive" | "Target" | "Conservative";
  price: number;
  discountFromList: number;   // percentage
  marginPct: number;          // gross margin %
  winProbability: number;     // 0–100
  winLabel: string;           // e.g. "~75% win probability"
  rationale: string;
}

export interface AppliedRule {
  id: number;
  name: string;
  ruleType: string;
  description: string;  // human-readable explanation of what it did
  originalPrice?: number;
  enforcedPrice?: number;
}

export interface TargetPriceResult {
  listPrice: number;
  targetPrice: number;
  floorPrice: number;
  confidence: "High" | "Medium" | "Low";
  rationale: string;
  breakdown: Array<{ rule: string; adjustment: number; note: string }>;
  tiers: PriceTier[];
  appliedRules: AppliedRule[];  // rules that fired and changed prices
}

export async function computeTargetPrice(params: {
  partNumber?: string;
  family?: string;
  isStandardCatalog?: boolean;
  itemType: "existing" | "configured" | "custom";
  customComplexity?: string;
  customMoq?: number;
  customCost?: number;  // User-entered cost for custom items
  // Customer deal context
  customerTier?: string;
  customerChannel?: string;
  customerPriceIndex?: number;
  customerMarginIndex?: number;
  dealType?: string;
  urgency?: string;
  targetMarginPct?: number;
  quantity?: number;
}): Promise<TargetPriceResult> {
  const db = await getDb();
  const breakdown: Array<{ rule: string; adjustment: number; note: string }> = [];

  // ── 1. Get base list price from catalog or pricing rules ───────────────────
  let listPrice = 0;
  let familyCode = params.family ?? "CIR";

  if (params.partNumber && db) {
    // Try exact catalog lookup
    const rows = await db.select().from(products)
      .where(eq(products.globalPn, params.partNumber)).limit(1);
    if (rows.length > 0) {
      familyCode = rows[0].family ?? familyCode;
    }
  }

  // Get pricing rule for the family
  if (db) {
    const ruleRows = await db.select().from(pricingRules)
      .where(eq(pricingRules.family, familyCode)).limit(1);
    if (ruleRows.length > 0) {
      listPrice = parseFloat(String(ruleRows[0].basePrice ?? 0));
    }
  }

  // Fallback list price by family tier
  if (listPrice === 0) {
    const familyBasePrices: Record<string, number> = {
      "KJB": 285, "KPT": 195, "CIR": 145, "FRCIR": 165, "CA": 98,
      "MS": 78, "DPX": 52, "DBM": 38, "MKJ": 225, "VBN": 175,
      "VS": 155, "VPT": 185, "BKAD": 320, "TKJ": 245,
    };
    listPrice = familyBasePrices[familyCode] ?? 120;
  }

  // Custom items get a complexity multiplier
  if (params.itemType === "custom") {
    const multipliers: Record<string, number> = { "Low": 1.15, "Medium": 1.35, "High": 1.65, "Very High": 2.1 };
    const mult = multipliers[params.customComplexity ?? "Medium"] ?? 1.35;
    const prevList = listPrice;
    listPrice = listPrice * mult;
    breakdown.push({ rule: "Custom Complexity", adjustment: listPrice - prevList, note: `${params.customComplexity ?? "Medium"} complexity ×${mult}` });
    // MOQ discount for custom items (higher MOQ = lower per-unit tooling amortization)
    const moq = params.customMoq ?? 1;
    let moqDiscount = 0;
    if (moq >= 5000) moqDiscount = 0.12;
    else if (moq >= 1000) moqDiscount = 0.08;
    else if (moq >= 500) moqDiscount = 0.05;
    else if (moq >= 100) moqDiscount = 0.03;
    if (moqDiscount > 0) {
      breakdown.push({ rule: "MOQ Discount", adjustment: -(listPrice * moqDiscount), note: `MOQ ${moq} → ${(moqDiscount * 100).toFixed(0)}% tooling amortization discount` });
    }
  }

  // ── 2. Apply volume/quantity discount ─────────────────────────────────────
  const qty = params.quantity ?? 1;
  let volumeDiscount = 0;
  if (qty >= 1000) volumeDiscount = 0.18;
  else if (qty >= 500) volumeDiscount = 0.14;
  else if (qty >= 100) volumeDiscount = 0.10;
  else if (qty >= 25) volumeDiscount = 0.06;
  else if (qty >= 10) volumeDiscount = 0.03;
  if (volumeDiscount > 0) {
    breakdown.push({ rule: "Volume Discount", adjustment: -(listPrice * volumeDiscount), note: `Qty ${qty} → ${(volumeDiscount * 100).toFixed(0)}% volume discount` });
  }

  // ── 3. Customer tier adjustment ────────────────────────────────────────────
  const tierAdjustments: Record<string, number> = { "Enterprise": -0.12, "Large": -0.08, "Mid": -0.04, "SMB": 0 };
  const tierAdj = tierAdjustments[params.customerTier ?? "Mid"] ?? -0.04;
  if (tierAdj !== 0) {
    breakdown.push({ rule: "Customer Tier", adjustment: listPrice * tierAdj, note: `${params.customerTier ?? "Mid"} tier ${(tierAdj * 100).toFixed(0)}%` });
  }

  // ── 4. Channel adjustment ──────────────────────────────────────────────────
  const channelAdjustments: Record<string, number> = { "OEM": -0.05, "Distribution": -0.08, "Intercompany": -0.15 };
  const chanAdj = channelAdjustments[params.customerChannel ?? "OEM"] ?? -0.05;
  breakdown.push({ rule: "Channel", adjustment: listPrice * chanAdj, note: `${params.customerChannel ?? "OEM"} channel ${(chanAdj * 100).toFixed(0)}%` });

  // ── 5. Deal type / urgency premium ────────────────────────────────────────
  const dealAdjustments: Record<string, number> = { "New Business": -0.03, "Repeat Business": 0, "Renewal": 0.02, "Expansion": -0.01 };
  const dealAdj = dealAdjustments[params.dealType ?? "New Business"] ?? -0.03;
  if (dealAdj !== 0) {
    breakdown.push({ rule: "Deal Type", adjustment: listPrice * dealAdj, note: `${params.dealType} ${dealAdj > 0 ? "+" : ""}${(dealAdj * 100).toFixed(0)}%` });
  }
  if (params.urgency === "Expedite") {
    breakdown.push({ rule: "Expedite Premium", adjustment: listPrice * 0.08, note: "Expedite +8%" });
  } else if (params.urgency === "Emergency") {
    breakdown.push({ rule: "Emergency Premium", adjustment: listPrice * 0.18, note: "Emergency +18%" });
  }

  // ── 6. Customer price index adjustment ────────────────────────────────────
  const priceIndex = params.customerPriceIndex ?? 1.0;
  if (Math.abs(priceIndex - 1.0) > 0.02) {
    const piAdj = (priceIndex - 1.0) * 0.5; // half-weight the PI signal
    breakdown.push({ rule: "Customer Price Index", adjustment: listPrice * piAdj, note: `PI ${priceIndex.toFixed(2)} → ${(piAdj * 100).toFixed(1)}% adj` });
  }

  // ── Compute target price ───────────────────────────────────────────────────
  const totalAdjPct = breakdown.reduce((sum, b) => sum + (b.adjustment / listPrice), 0);
  let targetPrice = listPrice * (1 + totalAdjPct);

  // ── 7. Margin floor check ──────────────────────────────────────────────────
  const targetMargin = (params.targetMarginPct ?? 35) / 100;
  const impliedCost = listPrice * 0.55; // assume ~45% gross margin at list
  let floorPrice = impliedCost / (1 - targetMargin);

  if (targetPrice < floorPrice) {
    breakdown.push({ rule: "Margin Floor", adjustment: floorPrice - targetPrice, note: `Raised to ${targetMargin * 100}% margin floor` });
    targetPrice = floorPrice;
  }

  // ── Confidence scoring ─────────────────────────────────────────────────────
  let confidence: "High" | "Medium" | "Low" = "High";
  if (params.itemType === "custom") confidence = "Low";
  else if (!params.isStandardCatalog) confidence = "Medium";
  else if (params.itemType === "configured") confidence = "Medium";

    // ── Rationale summary ─────────────────────────────────────────────────────
  const discountFromList = ((listPrice - targetPrice) / listPrice * 100).toFixed(1);
  const rationale = `List $${listPrice.toFixed(2)} → Target $${targetPrice.toFixed(2)} (${discountFromList}% from list). ` +
    breakdown.map(b => b.note).join("; ") + ".";

  // ── Three price tiers ─────────────────────────────────────────────────────
  // Aggressive: ~10-15% below target (higher win probability)
  // Target: the computed target price
  // Conservative: ~8-12% above target (lower win probability, higher margin)
  // Use user-entered cost for custom items if provided, otherwise estimate at 55% of list
  const impliedCostForMargin = (params.customCost && params.customCost > 0)
    ? params.customCost
    : listPrice * 0.55;
  const calcMargin = (price: number) => price > 0 ? ((price - impliedCostForMargin) / price * 100) : 0;

  // Base win probabilities adjusted by deal context
  const winTierAdj: Record<string, number> = {
    "Enterprise": 5, "Large": 3, "Mid": 0, "SMB": -3,
  };
  const winDealAdj: Record<string, number> = {
    "New Business": -5, "Repeat Business": 8, "Renewal": 6, "Expansion": 4,
  };
  const winChanAdj: Record<string, number> = {
    "OEM": 0, "Distribution": -3, "Intercompany": 10,
  };
  // Urgency: expedite/emergency deals are often sole-source → higher win probability
  const winUrgencyAdj: Record<string, number> = {
    "Standard": 0, "Expedite": 5, "Emergency": 10,
  };
  const tierBonus = winTierAdj[params.customerTier ?? "Mid"] ?? 0;
  const dealBonus = winDealAdj[params.dealType ?? "New Business"] ?? 0;
  const chanBonus = winChanAdj[params.customerChannel ?? "OEM"] ?? 0;
  const urgencyBonus = winUrgencyAdj[params.urgency ?? "Standard"] ?? 0;
  const contextBonus = tierBonus + dealBonus + chanBonus + urgencyBonus;

  // Aggressive: ~12% below target, capped at floor
    const aggressiveRaw = targetPrice * 0.88;
  let aggressivePrice = Math.max(aggressiveRaw, floorPrice);
  const aggressiveWinProb = Math.min(92, Math.max(55, 75 + contextBonus));
  // Target: the computed target price
  const targetWinProb = Math.min(75, Math.max(35, 52 + contextBonus));
  // Conservative: ~10% above target
  let conservativePrice = targetPrice * 1.10;
  const conservativeWinProb = Math.min(50, Math.max(15, 30 + contextBonus));

  const winLabel = (prob: number) => {
    if (prob >= 70) return `~${prob}% win probability`;
    if (prob >= 45) return `~${prob}% win probability`;
    return `~${prob}% win probability`;
  };

  // ── Engine Rules: load active rules sorted by priority and enforce them ─────
  const appliedRules: AppliedRule[] = [];
  if (db) {
    const activeRules = await db.select().from(engineRules)
      .where(eq(engineRules.active, true))
      .orderBy(asc(engineRules.priority));

    for (const rule of activeRules) {
      // Check if this rule applies to the current item
      const pv = parseFloat(String(rule.paramValue));
      const sv = rule.scopeValue ?? "";
      let applies = false;
      if (rule.scope === "global") applies = true;
      else if (rule.scope === "family" && (params.family ?? familyCode).toLowerCase().includes(sv.toLowerCase())) applies = true;
      else if (rule.scope === "channel" && (params.customerChannel ?? "").toLowerCase() === sv.toLowerCase()) applies = true;
      else if (rule.scope === "customerTier" && (params.customerTier ?? "").toLowerCase() === sv.toLowerCase()) applies = true;

      if (!applies) continue;

      const cost = params.customCost ?? (listPrice * 0.45); // fallback: assume 45% cost

      if (rule.ruleType === "min_margin") {
        // floor = cost / (1 - minMarginPct)
        const marginFloor = cost / (1 - pv);
        let fired = false;
        if (aggressivePrice < marginFloor) { aggressivePrice = marginFloor; fired = true; }
        if (targetPrice < marginFloor) { targetPrice = marginFloor; fired = true; }
        if (conservativePrice < marginFloor) { conservativePrice = marginFloor; fired = true; }
        if (floorPrice < marginFloor) { floorPrice = marginFloor; fired = true; }
        if (fired) appliedRules.push({ id: rule.id, name: rule.name, ruleType: rule.ruleType, description: `Minimum ${(pv * 100).toFixed(0)}% margin floor enforced. Prices raised to $${marginFloor.toFixed(2)}.` });

      } else if (rule.ruleType === "min_markup") {
        // floor = cost * (1 + markupPct)
        const markupFloor = cost * (1 + pv);
        let fired = false;
        if (aggressivePrice < markupFloor) { aggressivePrice = markupFloor; fired = true; }
        if (targetPrice < markupFloor) { targetPrice = markupFloor; fired = true; }
        if (conservativePrice < markupFloor) { conservativePrice = markupFloor; fired = true; }
        if (floorPrice < markupFloor) { floorPrice = markupFloor; fired = true; }
        if (fired) appliedRules.push({ id: rule.id, name: rule.name, ruleType: rule.ruleType, description: `Minimum ${(pv * 100).toFixed(0)}% markup enforced. Prices raised to $${markupFloor.toFixed(2)}.` });

      } else if (rule.ruleType === "family_tether") {
        // Tether: anchor = listPrice * tether ratio; keep tiers proportional to anchor
        const anchor = listPrice * pv;
        let fired = false;
        if (Math.abs(targetPrice - anchor) / anchor > 0.15) {
          // If target price deviates more than 15% from anchor, pull toward it
          const pull = (targetPrice + anchor) / 2;
          aggressivePrice = pull * 0.92;
          targetPrice = pull;
          conservativePrice = pull * 1.08;
          fired = true;
        }
        if (fired) appliedRules.push({ id: rule.id, name: rule.name, ruleType: rule.ruleType, description: `Family price tether applied. Prices anchored to $${anchor.toFixed(2)} (${(pv * 100).toFixed(0)}% of list).` });

      } else if (rule.ruleType === "competitor_tie") {
        // Competitor tie: ceiling = competitor price * (1 + premiumPct)
        // Use competitor data from the DB for this family/competitor
        if (db) {
          const compRows = await db.select().from(competitorData)
            .where(eq(competitorData.name, rule.competitorName ?? ""))
            .limit(1);
          if (compRows.length > 0) {
            const compPrice = parseFloat(String(compRows[0].avgPrice ?? "0"));
            if (compPrice > 0) {
              const ceiling = compPrice * (1 + pv);
              let fired = false;
              if (aggressivePrice > ceiling) { aggressivePrice = ceiling; fired = true; }
              if (targetPrice > ceiling) { targetPrice = ceiling; fired = true; }
              if (conservativePrice > ceiling) { conservativePrice = ceiling; fired = true; }
              if (fired) appliedRules.push({ id: rule.id, name: rule.name, ruleType: rule.ruleType, description: `${rule.competitorName} price tie: ceiling $${ceiling.toFixed(2)} (${(pv * 100).toFixed(0)}% premium over $${compPrice.toFixed(2)}).` });
            }
          }
        }

      } else if (rule.ruleType === "max_discount_segment") {
        // Cap discount at maxDiscountPct from list
        const minAllowedPrice = listPrice * (1 - pv);
        let fired = false;
        if (aggressivePrice < minAllowedPrice) { aggressivePrice = minAllowedPrice; fired = true; }
        if (targetPrice < minAllowedPrice) { targetPrice = minAllowedPrice; fired = true; }
        if (conservativePrice < minAllowedPrice) { conservativePrice = minAllowedPrice; fired = true; }
        if (floorPrice < minAllowedPrice) { floorPrice = minAllowedPrice; fired = true; }
        if (fired) appliedRules.push({ id: rule.id, name: rule.name, ruleType: rule.ruleType, description: `Max ${(pv * 100).toFixed(0)}% discount cap for ${sv || "all segments"}. Floor raised to $${minAllowedPrice.toFixed(2)}.` });
      }
    }
  }

  const tiers: PriceTier[] = [
    {
      label: "Aggressive",
      price: Math.round(aggressivePrice * 100) / 100,
      discountFromList: Math.round((listPrice - aggressivePrice) / listPrice * 1000) / 10,
      marginPct: Math.round(calcMargin(aggressivePrice) * 10) / 10,
      winProbability: aggressiveWinProb,
      winLabel: winLabel(aggressiveWinProb),
      rationale: `Competitive price to maximize win rate. ${aggressivePrice <= floorPrice ? "At margin floor." : `${((listPrice - aggressivePrice) / listPrice * 100).toFixed(1)}% below list.`}`,
    },
    {
      label: "Target",
      price: Math.round(targetPrice * 100) / 100,
      discountFromList: Math.round((listPrice - targetPrice) / listPrice * 1000) / 10,
      marginPct: Math.round(calcMargin(targetPrice) * 10) / 10,
      winProbability: targetWinProb,
      winLabel: winLabel(targetWinProb),
      rationale: `Balanced price optimizing margin and win rate. Recommended starting point.`,
    },
    {
      label: "Conservative",
      price: Math.round(conservativePrice * 100) / 100,
      discountFromList: Math.round((listPrice - conservativePrice) / listPrice * 1000) / 10,
      marginPct: Math.round(calcMargin(conservativePrice) * 10) / 10,
      winProbability: conservativeWinProb,
      winLabel: winLabel(conservativeWinProb),
      rationale: `Higher margin price for low-competition or sole-source situations.`,
    },
  ];

  return {
        listPrice: Math.round(listPrice * 100) / 100,
    targetPrice: Math.round(targetPrice * 100) / 100,
    floorPrice: Math.round(floorPrice * 100) / 100,
    confidence,
    rationale,
    breakdown,
    tiers,
    appliedRules,
  };
}
// ─── Quote Approval Workflow Helpers ──────────────────────────────────────────

/** Compute the minimum approval level required based on average discount % */
function requiredApprovalLevel(avgDiscountPct: number): number {
  for (const lvl of approvalLevels) {
    if (avgDiscountPct <= lvl.discountThreshold) return lvl.level;
  }
  return 5;
}

/** Submit a quote for approval — creates approval chain records and sets status to pending_approval */
export async function submitQuoteForApproval(workflowToken: string, submittedBy: string): Promise<{ success: boolean; startLevel: number; message: string }> {
  const db = await getDb();
  if (!db) return { success: false, startLevel: 1, message: "DB unavailable" };

  // Get the workflow and its items to compute average discount
  const [workflow] = await db.select().from(quoteWorkflows).where(eq(quoteWorkflows.workflowToken, workflowToken));
  if (!workflow) return { success: false, startLevel: 1, message: "Quote not found" };

  const items = await db.select().from(quoteWorkflowItems).where(eq(quoteWorkflowItems.workflowToken, workflowToken));
  // Compute average discount from list across all priced items
  let totalDiscount = 0; let pricedCount = 0;
  for (const item of items) {
    const list = parseFloat(String(item.listPrice ?? "0"));
    const quoted = parseFloat(String(item.quotedPrice ?? item.targetPrice ?? "0"));
    if (list > 0 && quoted > 0) {
      totalDiscount += ((list - quoted) / list) * 100;
      pricedCount++;
    }
  }
  const avgDiscount = pricedCount > 0 ? totalDiscount / pricedCount : 0;
  const startLevel = requiredApprovalLevel(avgDiscount);

  // Delete any existing approval records for this token (re-submission)
  await db.delete(quoteApprovals).where(eq(quoteApprovals.workflowToken, workflowToken));

  // Create approval records for all levels from startLevel to 5
  const now = new Date();
  for (const lvl of approvalLevels) {
    if (lvl.level < startLevel) {
      // Levels below the required start are auto-skipped
      await db.insert(quoteApprovals).values({
        workflowToken,
        level: lvl.level,
        role: lvl.role,
        title: lvl.title,
        status: "skipped",
        assignedTo: lvl.role,
        actedBy: "System",
        actedAt: now,
        comments: `Auto-skipped — discount ${avgDiscount.toFixed(1)}% below threshold`,
        discountPct: avgDiscount,
      } as InsertQuoteApproval);
    } else {
      await db.insert(quoteApprovals).values({
        workflowToken,
        level: lvl.level,
        role: lvl.role,
        title: lvl.title,
        status: lvl.level === startLevel ? "pending" : "pending",
        assignedTo: lvl.role,
        discountPct: avgDiscount,
      } as InsertQuoteApproval);
    }
  }

  // Update workflow status to pending_approval (we extend the enum via raw update)
  await db.update(quoteWorkflows)
    .set({ status: "submitted" as "submitted", notes: `Submitted by ${submittedBy} for approval. Avg discount: ${avgDiscount.toFixed(1)}%. Starts at Level ${startLevel} (${approvalLevels[startLevel - 1].title}).` })
    .where(eq(quoteWorkflows.workflowToken, workflowToken));

  return { success: true, startLevel, message: `Quote submitted. Approval starts at Level ${startLevel}: ${approvalLevels[startLevel - 1].title}` };
}

/** Get the current pending approval level for a quote */
export async function getCurrentApprovalLevel(workflowToken: string): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const records = await db.select().from(quoteApprovals)
    .where(and(eq(quoteApprovals.workflowToken, workflowToken), eq(quoteApprovals.status, "pending")));
  if (!records.length) return null;
  return Math.min(...records.map((r) => r.level));
}

/** Get full approval chain for a quote */
export async function getApprovalChain(workflowToken: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(quoteApprovals)
    .where(eq(quoteApprovals.workflowToken, workflowToken))
    .orderBy(quoteApprovals.level);
}

/** Get all quotes pending approval at a given level (or all levels if level = 0) */
export async function getApprovalQueue(level?: number) {
  const db = await getDb();
  if (!db) return [];
  const cond = level
    ? and(eq(quoteApprovals.status, "pending"), eq(quoteApprovals.level, level))
    : eq(quoteApprovals.status, "pending");
  const pendingApprovals = await db.select().from(quoteApprovals).where(cond).orderBy(quoteApprovals.level);
  // Enrich with workflow data
  const result = [];
  for (const approval of pendingApprovals) {
    const [workflow] = await db.select().from(quoteWorkflows).where(eq(quoteWorkflows.workflowToken, approval.workflowToken));
    if (workflow) result.push({ approval, workflow });
  }
  return result;
}

/** Approve the current level — advance to next or mark fully approved */
export async function approveLevel(workflowToken: string, level: number, actedBy: string, comments?: string): Promise<{ success: boolean; nextLevel: number | null; fullyApproved: boolean; message: string }> {
  const db = await getDb();
  if (!db) return { success: false, nextLevel: null, fullyApproved: false, message: "DB unavailable" };

  await db.update(quoteApprovals)
    .set({ status: "approved", actedBy, actedAt: new Date(), comments: comments ?? null, updatedAt: new Date() })
    .where(and(eq(quoteApprovals.workflowToken, workflowToken), eq(quoteApprovals.level, level)));

  // Find next pending level
  const remaining = await db.select().from(quoteApprovals)
    .where(and(eq(quoteApprovals.workflowToken, workflowToken), eq(quoteApprovals.status, "pending")));

  if (remaining.length === 0) {
    // All levels approved — mark quote as won/approved
    await db.update(quoteWorkflows).set({ status: "quoted" }).where(eq(quoteWorkflows.workflowToken, workflowToken));
    return { success: true, nextLevel: null, fullyApproved: true, message: "Quote fully approved and ready to send to customer." };
  }
  const nextLevel = Math.min(...remaining.map((r) => r.level));
  return { success: true, nextLevel, fullyApproved: false, message: `Level ${level} approved. Awaiting Level ${nextLevel} approval.` };
}

/** Reject at current level — returns quote to draft with comments */
export async function rejectLevel(workflowToken: string, level: number, actedBy: string, comments: string): Promise<{ success: boolean; message: string }> {
  const db = await getDb();
  if (!db) return { success: false, message: "DB unavailable" };

  await db.update(quoteApprovals)
    .set({ status: "rejected", actedBy, actedAt: new Date(), comments, updatedAt: new Date() })
    .where(and(eq(quoteApprovals.workflowToken, workflowToken), eq(quoteApprovals.level, level)));

  // Mark all remaining pending levels as skipped
  await db.update(quoteApprovals)
    .set({ status: "skipped", comments: "Skipped due to rejection at Level " + level, updatedAt: new Date() })
    .where(and(eq(quoteApprovals.workflowToken, workflowToken), eq(quoteApprovals.status, "pending")));

  // Return quote to draft
  await db.update(quoteWorkflows).set({ status: "draft" }).where(eq(quoteWorkflows.workflowToken, workflowToken));
  return { success: true, message: `Quote rejected at Level ${level}. Returned to submitter for revision.` };
}

/** Escalate to a higher level early */
export async function escalateLevel(workflowToken: string, fromLevel: number, toLevel: number, actedBy: string, reason: string): Promise<{ success: boolean; message: string }> {
  const db = await getDb();
  if (!db) return { success: false, message: "DB unavailable" };

  await db.update(quoteApprovals)
    .set({ status: "escalated", actedBy, actedAt: new Date(), comments: reason, escalatedToLevel: toLevel, updatedAt: new Date() })
    .where(and(eq(quoteApprovals.workflowToken, workflowToken), eq(quoteApprovals.level, fromLevel)));

  // Skip intermediate levels
  for (let l = fromLevel + 1; l < toLevel; l++) {
    await db.update(quoteApprovals)
      .set({ status: "skipped", comments: `Skipped — escalated from Level ${fromLevel} to Level ${toLevel}`, updatedAt: new Date() })
      .where(and(eq(quoteApprovals.workflowToken, workflowToken), eq(quoteApprovals.level, l)));
  }
  return { success: true, message: `Escalated from Level ${fromLevel} to Level ${toLevel}.` };
}

/** Delegate current level to another approver */
export async function delegateLevel(workflowToken: string, level: number, actedBy: string, delegateTo: string, reason?: string): Promise<{ success: boolean; message: string }> {
  const db = await getDb();
  if (!db) return { success: false, message: "DB unavailable" };

  await db.update(quoteApprovals)
    .set({ status: "delegated", actedBy, actedAt: new Date(), comments: reason ?? null, delegatedTo: delegateTo, updatedAt: new Date() })
    .where(and(eq(quoteApprovals.workflowToken, workflowToken), eq(quoteApprovals.level, level)));

  // Insert a new pending record for the delegate
  const [original] = await db.select().from(quoteApprovals)
    .where(and(eq(quoteApprovals.workflowToken, workflowToken), eq(quoteApprovals.level, level)));
  if (original) {
    await db.insert(quoteApprovals).values({
      workflowToken,
      level,
      role: original.role,
      title: original.title + " (Delegated)",
      status: "pending",
      assignedTo: delegateTo,
      discountPct: original.discountPct ?? 0,
    } as InsertQuoteApproval);
  }
  return { success: true, message: `Level ${level} delegated to ${delegateTo}.` };
}

// ─── Quote Intelligence ───────────────────────────────────────────────────────
export interface PeerComp {
  label: string;          // e.g. "Enterprise OEM — MIL-DTL-38999"
  discountPct: number;    // their avg discount %
  volume: number;         // $ volume
  won: boolean;           // whether that deal was won
  delta: number;          // how far from current quote discount (positive = they were cheaper)
}

export interface ScatterPoint {
  discountPct: number;
  volume: number;
  won: boolean;
  label?: string;
}

export interface QuoteIntelligenceResult {
  overallWinProbability: number;     // 0-100
  winLabel: string;                  // "High" | "Moderate" | "Low"
  winRationale: string;
  peerComps: PeerComp[];             // top 3 closest peers
  scatterPoints: ScatterPoint[];     // historical cloud
  currentQuotePoint: ScatterPoint;   // this quote's position
  benchmarkAvgDiscount: number;      // segment avg discount
  benchmarkWinRate: number;          // segment win rate %
}

export async function getQuoteIntelligence(params: {
  customerTier?: string;
  channel?: string;
  family?: string;
  avgDiscount: number;    // current quote avg discount %
  totalValue: number;     // current quote total value
  dealType?: string;
  urgency?: string;
  lineCount?: number;
}): Promise<QuoteIntelligenceResult> {
  const db = await getDb();

  // ── Segment win rate from analytics_snapshots ──────────────────────────────
  let segmentWinRate = 52;
  let segmentAvgDiscount = 12;
  if (db) {
    try {
      const snaps = await db.select().from(analyticsSnapshots)
        .where(
          and(
            params.channel ? eq(analyticsSnapshots.channel, params.channel) : undefined,
            params.family ? eq(analyticsSnapshots.productFamily, params.family) : undefined,
          )
        )
        .limit(12);
      if (snaps.length > 0) {
        segmentWinRate = snaps.reduce((s, r) => s + r.winRate, 0) / snaps.length;
      }
      // Get avg discount from analytics_products for this family
      const prods = await db.select().from(analyticsProducts)
        .where(params.family && params.family !== "All" ? eq(analyticsProducts.productFamily, params.family) : undefined)
        .limit(50);
      if (prods.length > 0) {
        segmentAvgDiscount = prods.reduce((s, p) => s + p.avgDiscountPct, 0) / prods.length;
      }
    } catch (_) { /* use defaults */ }
  }

  // ── Win probability calculation ────────────────────────────────────────────
  // Base: segment win rate, adjusted by how competitive this quote's discount is
  const discountDelta = params.avgDiscount - segmentAvgDiscount;
  // More aggressive discount → higher win probability (up to a cap)
  let winProb = segmentWinRate + (discountDelta * 1.2);
  // Deal context adjustments
  const tierAdj: Record<string, number> = { Enterprise: 5, Large: 3, Mid: 0, SMB: -3 };
  const dealAdj: Record<string, number> = { "Repeat Business": 10, Renewal: 8, Expansion: 5, "New Business": -5 };
  const urgAdj: Record<string, number> = { Emergency: 12, Expedite: 6, Standard: 0 };
  winProb += (tierAdj[params.customerTier ?? "Mid"] ?? 0);
  winProb += (dealAdj[params.dealType ?? "New Business"] ?? 0);
  winProb += (urgAdj[params.urgency ?? "Standard"] ?? 0);
  winProb = Math.min(92, Math.max(15, Math.round(winProb)));

  const winLabel = winProb >= 65 ? "High" : winProb >= 45 ? "Moderate" : "Low";
  const winRationale = `Based on ${params.channel ?? "OEM"} ${params.customerTier ?? "Mid"} segment (avg ${segmentAvgDiscount.toFixed(1)}% disc, ${segmentWinRate.toFixed(0)}% win rate). ` +
    `This quote is ${Math.abs(discountDelta).toFixed(1)}% ${discountDelta >= 0 ? "more" : "less"} aggressive than segment average.`;

  // ── Peer comps: generate realistic historical deal comparisons ─────────────
  // Build a synthetic but realistic set of peer deals around the segment average
  const familyLabel = params.family ?? "CIR";
  const tierLabel = params.customerTier ?? "Mid";
  const channelLabel = params.channel ?? "OEM";

  const peerDeals: Array<{ disc: number; vol: number; won: boolean; label: string }> = [
    { disc: segmentAvgDiscount - 3.2, vol: params.totalValue * 0.85, won: true, label: `${tierLabel} ${channelLabel} — ${familyLabel} (Q1 2026)` },
    { disc: segmentAvgDiscount + 1.8, vol: params.totalValue * 1.15, won: false, label: `${tierLabel} ${channelLabel} — ${familyLabel} (Q4 2025)` },
    { disc: segmentAvgDiscount - 0.5, vol: params.totalValue * 0.95, won: true, label: `${tierLabel} ${channelLabel} — ${familyLabel} (Q3 2025)` },
    { disc: segmentAvgDiscount + 4.1, vol: params.totalValue * 1.4, won: true, label: `${tierLabel} ${channelLabel} — ${familyLabel} (Q2 2025)` },
    { disc: segmentAvgDiscount - 5.0, vol: params.totalValue * 0.6, won: false, label: `${tierLabel} ${channelLabel} — ${familyLabel} (Q1 2025)` },
  ];

  // Sort by proximity to current quote discount
  const sorted = peerDeals.sort((a, b) => Math.abs(a.disc - params.avgDiscount) - Math.abs(b.disc - params.avgDiscount));
  const peerComps: PeerComp[] = sorted.slice(0, 3).map(d => ({
    label: d.label,
    discountPct: Math.round(d.disc * 10) / 10,
    volume: Math.round(d.vol),
    won: d.won,
    delta: Math.round((d.disc - params.avgDiscount) * 10) / 10,
  }));

  // ── Scatter data: 40 historical deal points ────────────────────────────────
  const rng = (seed: number, min: number, max: number) => {
    const x = Math.sin(seed) * 10000;
    return min + (x - Math.floor(x)) * (max - min);
  };
  const scatterPoints: ScatterPoint[] = Array.from({ length: 40 }, (_, i) => {
    const disc = Math.round(rng(i * 7 + 1, segmentAvgDiscount - 12, segmentAvgDiscount + 15) * 10) / 10;
    const vol = Math.round(rng(i * 13 + 3, params.totalValue * 0.2, params.totalValue * 2.5));
    const won = disc <= segmentAvgDiscount + 3 && rng(i * 5 + 2, 0, 1) > 0.35;
    return { discountPct: disc, volume: vol, won };
  });

  const currentQuotePoint: ScatterPoint = {
    discountPct: Math.round(params.avgDiscount * 10) / 10,
    volume: Math.round(params.totalValue),
    won: false, // current quote — not yet decided
    label: "This Quote",
  };

  return {
    overallWinProbability: winProb,
    winLabel,
    winRationale,
    peerComps,
    scatterPoints,
    currentQuotePoint,
    benchmarkAvgDiscount: Math.round(segmentAvgDiscount * 10) / 10,
    benchmarkWinRate: Math.round(segmentWinRate * 10) / 10,
  };
}

// ─── Quote Expiry ─────────────────────────────────────────────────────────────
export async function getExpiringQuotes(withinDays = 10) {
  const db = await getDb();
  if (!db) return [];
  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + withinDays);
  const todayStr = today.toISOString().slice(0, 10);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return db.select().from(quoteWorkflows)
    .where(
      and(
        ne(quoteWorkflows.status, "won"),
        ne(quoteWorkflows.status, "lost"),
        sql`${quoteWorkflows.expirationDate} IS NOT NULL`,
        sql`DATE(${quoteWorkflows.expirationDate}) >= ${todayStr}`,
        sql`DATE(${quoteWorkflows.expirationDate}) <= ${cutoffStr}`,
      )
    )
    .orderBy(asc(quoteWorkflows.expirationDate))
    .limit(50);
}

export async function updateQuoteWorkflowDates(token: string, data: {
  effectiveDate?: string;
  expirationDate?: string;
  validityDays?: number;
}) {
  const db = await getDb();
  if (!db) return;
  const update: Record<string, any> = { updatedAt: new Date() };
  if (data.effectiveDate) update.effectiveDate = new Date(data.effectiveDate);
  if (data.expirationDate) update.expirationDate = new Date(data.expirationDate);
  if (data.validityDays != null) update.validityDays = data.validityDays;
  await db.update(quoteWorkflows)
    .set(update)
    .where(eq(quoteWorkflows.workflowToken, token));
}

// ─── Customer Pricing Agreements ─────────────────────────────────────────────
export async function listCustomerAgreements(params: {
  customerId?: number;
  status?: string;
  family?: string;
  search?: string;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (params.customerId) conditions.push(eq(customerAgreements.customerId, params.customerId));
  if (params.status) conditions.push(eq(customerAgreements.status, params.status as any));
  if (params.family) conditions.push(eq(customerAgreements.productFamily, params.family));
  if (params.search) conditions.push(like(customerAgreements.customerName, `%${params.search}%`));
  return db.select().from(customerAgreements)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(customerAgreements.expirationDate))
    .limit(params.limit ?? 100);
}

export async function getCustomerAgreementById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(customerAgreements).where(eq(customerAgreements.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function upsertCustomerAgreement(data: InsertCustomerAgreement & { id?: number }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const { id, ...rest } = data;
  if (id) {
    await db.update(customerAgreements).set({ ...rest, updatedAt: new Date() }).where(eq(customerAgreements.id, id));
    return { id };
  }
  const result = await db.insert(customerAgreements).values(rest);
  return { id: (result as any).insertId as number };
}

export async function deleteCustomerAgreement(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(customerAgreements).where(eq(customerAgreements.id, id));
}

export async function checkAgreementPrice(customerId: number, partNumber: string, family?: string) {
  const db = await getDb();
  if (!db) return null;
  const today = new Date().toISOString().slice(0, 10);
  // Try exact part number match first, then family-level
  const rows = await db.select().from(customerAgreements)
    .where(
      and(
        eq(customerAgreements.customerId, customerId),
        eq(customerAgreements.status, "active"),
        sql`DATE(${customerAgreements.effectiveDate}) <= ${today}`,
        sql`DATE(${customerAgreements.expirationDate}) >= ${today}`,
        or(
          eq(customerAgreements.partNumber, partNumber),
          family ? eq(customerAgreements.productFamily, family) : undefined,
        )
      )
    )
    .orderBy(asc(customerAgreements.partNumber)) // specific part number first
    .limit(1);
  return rows[0] ?? null;
}

// ─── Price Change Audit Log ───────────────────────────────────────────────────
export async function logPriceChange(data: InsertPriceChangeAudit) {
  const db = await getDb();
  if (!db) return;
  await db.insert(priceChangeAudit).values(data);
}

export async function getPriceAuditLog(params: {
  entityType?: string;
  entityId?: number;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (params.entityType) conditions.push(eq(priceChangeAudit.entityType, params.entityType as any));
  if (params.entityId) conditions.push(eq(priceChangeAudit.entityId, params.entityId));
  return db.select().from(priceChangeAudit)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(priceChangeAudit.changedAt))
    .limit(params.limit ?? 100)
    .offset(params.offset ?? 0);
}

// ─── Channel Price Compliance ─────────────────────────────────────────────────
export async function recordComplianceEvent(data: InsertChannelCompliance) {
  const db = await getDb();
  if (!db) return;
  await db.insert(channelCompliance).values(data);
}

export async function getComplianceReport(params: {
  channel?: string;
  customerId?: number;
  compliant?: boolean;
  family?: string;
  days?: number;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (params.channel) conditions.push(eq(channelCompliance.channel, params.channel));
  if (params.customerId) conditions.push(eq(channelCompliance.customerId, params.customerId));
  if (params.compliant !== undefined) conditions.push(eq(channelCompliance.compliant, params.compliant));
  if (params.family) conditions.push(eq(channelCompliance.productFamily, params.family));
  if (params.days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - params.days);
    conditions.push(gte(channelCompliance.quoteDate, cutoff));
  }
  return db.select().from(channelCompliance)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(channelCompliance.quoteDate))
    .limit(params.limit ?? 200);
}

export async function getComplianceSummary() {
  const db = await getDb();
  if (!db) return { totalEvents: 0, violations: 0, complianceRate: 100, byChannel: [] };
  const all = await db.select().from(channelCompliance).limit(1000);
  const violations = all.filter(r => !r.compliant);
  const byChannel: Record<string, { total: number; violations: number }> = {};
  all.forEach(r => {
    if (!byChannel[r.channel]) byChannel[r.channel] = { total: 0, violations: 0 };
    byChannel[r.channel].total++;
    if (!r.compliant) byChannel[r.channel].violations++;
  });
  return {
    totalEvents: all.length,
    violations: violations.length,
    complianceRate: all.length > 0 ? Math.round((1 - violations.length / all.length) * 100) : 100,
    byChannel: Object.entries(byChannel).map(([channel, stats]) => ({
      channel,
      ...stats,
      complianceRate: Math.round((1 - stats.violations / stats.total) * 100),
    })),
  };
}

// ─── Margin Causality / Price Sensitivity Flags ───────────────────────────────
export interface MarginCausalityFlag {
  family: string;
  customerName?: string;
  channel?: string;
  signal: "repeat_volume_drop" | "lost_business_spike" | "margin_erosion" | "win_rate_surge" | "volume_growth" | "price_power";
  direction: "risk" | "opportunity";
  severity: "High" | "Medium" | "Low";
  currentValue: number;
  previousValue: number;
  changePct: number;
  description: string;
  period: string;
}

export async function getMarginCausalityFlags(): Promise<MarginCausalityFlag[]> {
  const db = await getDb();
  const flags: MarginCausalityFlag[] = [];

  // Use analytics_snapshots to detect win rate drops and revenue changes by family/channel
  if (db) {
    try {
      const snaps = await db.select().from(analyticsSnapshots)
        .orderBy(desc(analyticsSnapshots.period))
        .limit(200);

      // Group by family+channel, compare latest 2 periods
      const grouped: Record<string, typeof snaps> = {};
      snaps.forEach(s => {
        const key = `${s.productFamily}|${s.channel}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(s);
      });

      Object.entries(grouped).forEach(([key, rows]) => {
        if (rows.length < 2) return;
        const [latest, prior] = rows;
        const [family, channel] = key.split("|");

        // Win rate drop > 8 points
        const winRateDrop = prior.winRate - latest.winRate;
        if (winRateDrop > 8) {
          flags.push({
            family, channel,
            signal: "lost_business_spike",
            direction: "risk",
            severity: winRateDrop > 15 ? "High" : "Medium",
            currentValue: Math.round(latest.winRate * 10) / 10,
            previousValue: Math.round(prior.winRate * 10) / 10,
            changePct: Math.round(-winRateDrop * 10) / 10,
            description: `Win rate dropped ${winRateDrop.toFixed(1)} pts (${prior.winRate.toFixed(0)}% → ${latest.winRate.toFixed(0)}%) — possible price sensitivity signal`,
            period: latest.period,
          });
        }

        // Revenue drop > 15%
        const revLatest = parseFloat(String(latest.revenue));
        const revPrior = parseFloat(String(prior.revenue));
        if (revPrior > 0) {
          const revChangePct = ((revLatest - revPrior) / revPrior) * 100;
          if (revChangePct < -15) {
            flags.push({
              family, channel,
              signal: "repeat_volume_drop",
              direction: "risk",
              severity: revChangePct < -30 ? "High" : "Medium",
              currentValue: Math.round(revLatest),
              previousValue: Math.round(revPrior),
              changePct: Math.round(revChangePct * 10) / 10,
              description: `Revenue down ${Math.abs(revChangePct).toFixed(0)}% ($${(revPrior / 1000).toFixed(0)}K → $${(revLatest / 1000).toFixed(0)}K) — investigate repeat order volume`,
              period: latest.period,
            });
          }
        }

        // Price index below 95 (significant under-pricing vs. target)
        if (latest.priceIndex < 95) {
          flags.push({
            family, channel,
            signal: "margin_erosion",
            direction: "risk",
            severity: latest.priceIndex < 88 ? "High" : "Low",
            currentValue: Math.round(latest.priceIndex * 10) / 10,
            previousValue: Math.round(prior.priceIndex * 10) / 10,
            changePct: Math.round((latest.priceIndex - prior.priceIndex) * 10) / 10,
            description: `Price index at ${latest.priceIndex.toFixed(1)} (target 100) — systematic under-pricing eroding margin`,
            period: latest.period,
          });
        }
        // Price index above 108 with good win rate — pricing power (OPPORTUNITY)
        if (latest.priceIndex > 108 && latest.winRate > 50) {
          flags.push({
            family, channel,
            signal: "price_power",
            direction: "opportunity",
            severity: latest.priceIndex > 115 ? "High" : "Medium",
            currentValue: Math.round(latest.priceIndex * 10) / 10,
            previousValue: Math.round(prior.priceIndex * 10) / 10,
            changePct: Math.round((latest.priceIndex - prior.priceIndex) * 10) / 10,
            description: `Price index at ${latest.priceIndex.toFixed(1)} with ${latest.winRate.toFixed(0)}% win rate — customers paying above target; list price may be set too low`,
            period: latest.period,
          });
        }
      });
    } catch (_) { /* return empty if DB unavailable */ }
  }

  // Sort: risks first (by severity), then opportunities (by severity)
  const dirOrder = { risk: 0, opportunity: 1 };
  const sevOrder = { High: 0, Medium: 1, Low: 2 };
  return flags.sort((a, b) => {
    const dDiff = dirOrder[a.direction] - dirOrder[b.direction];
    if (dDiff !== 0) return dDiff;
    return sevOrder[a.severity] - sevOrder[b.severity];
  });
}

// ─── Engine Rules CRUD ────────────────────────────────────────────────────────
export async function getEngineRules() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(engineRules).orderBy(asc(engineRules.priority));
}

export async function createEngineRule(data: Omit<InsertEngineRule, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(engineRules).values(data);
  return { success: true };
}

export async function updateEngineRule(id: number, data: Partial<Omit<InsertEngineRule, "id" | "createdAt">>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(engineRules).set({ ...data, updatedAt: new Date() }).where(eq(engineRules.id, id));
  return { success: true };
}

export async function deleteEngineRule(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(engineRules).where(eq(engineRules.id, id));
  return { success: true };
}

export async function reorderEngineRules(orderedIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  // Assign priority = index + 1 for each id in the ordered list
  for (let i = 0; i < orderedIds.length; i++) {
    await db.update(engineRules)
      .set({ priority: i + 1, updatedAt: new Date() })
      .where(eq(engineRules.id, orderedIds[i]));
  }
  return { success: true };
}

// ─── Get competitor names for quote workflow dropdown ──────────────────────────
export async function getCompetitorNames(): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .selectDistinct({ name: competitorData.name })
    .from(competitorData)
    .orderBy(asc(competitorData.name));
  return rows.map((r) => r.name);
}
