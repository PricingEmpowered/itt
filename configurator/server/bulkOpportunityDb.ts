import { and, asc, desc, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  bulkQuoteOpportunities,
  bulkQuoteOpportunityItems,
  bulkQuoteReviewEvents,
  type InsertBulkQuoteOpportunity,
  type InsertBulkQuoteOpportunityItem,
} from "../drizzle/schema";
import {
  computeTargetPrice,
  createQuoteWorkflow,
  getDb,
  submitQuoteForApproval,
  upsertQuoteWorkflowItem,
} from "./db";

export type BulkOpportunityInput = {
  name: string;
  customerName: string;
  sourceFileName?: string;
  sourceFormat?: "minimal" | "spa_extract" | "parts_view" | "worksheet" | "csv" | "other";
  sourceSheet?: string;
  customerId?: number | null;
  customerTier?: string;
  quoteChannel?: "OEM" | "Distribution";
  quoteToCustomerSpec?: boolean;
  customerSpecReference?: string;
  sourcingPosition?: "competitive" | "sole_source" | "mixed" | "unknown";
  competitors?: string[];
  targetRevenue?: number;
  targetMarginPct?: number;
  targetWinProbability?: number;
  recentQuoteSummary?: string;
  recentQuoteDate?: string | Date | null;
  priorBookingValue?: number;
  expectedBookingValue?: number;
  bookingEvidence?: string;
  posValidation?: "validated" | "partial" | "unavailable" | "not_applicable";
  posSupporters?: string;
  distributorMarginTargetPct?: number;
  ittMarginTargetPct?: number;
  costValidationNotes?: string;
  createdBy?: string;
};

export type BulkOpportunityImportLine = {
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

export type DealScoreDriver = { label: string; impact: number; detail: string };

const asNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const asDecimal = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value) ? null : value.toFixed(4);

const normaliseDate = (value: string | Date | null | undefined) => {
  if (!value) return null;
  const dateValue = value instanceof Date ? value : new Date(value);
  return Number.isNaN(dateValue.getTime()) ? null : dateValue;
};

export async function createBulkQuoteOpportunity(data: BulkOpportunityInput) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");

  const opportunityToken = `SPA-${nanoid(12).toUpperCase()}`;
  const payload: InsertBulkQuoteOpportunity = {
    opportunityToken,
    name: data.name.trim(),
    customerName: data.customerName.trim(),
    status: "draft",
    sourceFileName: data.sourceFileName?.trim() || null,
    sourceFormat: data.sourceFormat ?? "minimal",
    sourceSheet: data.sourceSheet?.trim() || null,
    customerId: data.customerId ?? null,
    customerTier: data.customerTier ?? "Mid",
    quoteChannel: data.quoteChannel ?? "OEM",
    quoteToCustomerSpec: data.quoteToCustomerSpec ?? false,
    customerSpecReference: data.customerSpecReference?.trim() || null,
    sourcingPosition: data.sourcingPosition ?? "unknown",
    competitors: data.competitors ?? [],
    targetRevenue: data.targetRevenue == null ? null : data.targetRevenue.toFixed(2),
    targetMarginPct: data.targetMarginPct ?? 35,
    targetWinProbability: data.targetWinProbability ?? null,
    recentQuoteSummary: data.recentQuoteSummary?.trim() || null,
    recentQuoteDate: normaliseDate(data.recentQuoteDate) as never,
    priorBookingValue: data.priorBookingValue == null ? null : data.priorBookingValue.toFixed(2),
    expectedBookingValue: data.expectedBookingValue == null ? null : data.expectedBookingValue.toFixed(2),
    bookingEvidence: data.bookingEvidence?.trim() || null,
    posValidation: data.posValidation ?? "not_applicable",
    posSupporters: data.posSupporters?.trim() || null,
    distributorMarginTargetPct: data.distributorMarginTargetPct ?? null,
    ittMarginTargetPct: data.ittMarginTargetPct ?? null,
    costValidationNotes: data.costValidationNotes?.trim() || null,
    createdBy: data.createdBy ?? "Sales Rep",
  };
  const [result] = await db.insert(bulkQuoteOpportunities).values(payload);
  const id = (result as { insertId: number }).insertId;
  const [created] = await db.select().from(bulkQuoteOpportunities).where(eq(bulkQuoteOpportunities.id, id));
  return created ?? null;
}

export async function updateBulkQuoteOpportunity(opportunityToken: string, data: Partial<BulkOpportunityInput>) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const payload: Record<string, unknown> = { ...data };
  if ("recentQuoteDate" in data) payload.recentQuoteDate = normaliseDate(data.recentQuoteDate);
  if ("targetRevenue" in data) payload.targetRevenue = data.targetRevenue == null ? null : data.targetRevenue.toFixed(2);
  if ("priorBookingValue" in data) payload.priorBookingValue = data.priorBookingValue == null ? null : data.priorBookingValue.toFixed(2);
  if ("expectedBookingValue" in data) payload.expectedBookingValue = data.expectedBookingValue == null ? null : data.expectedBookingValue.toFixed(2);
  await db.update(bulkQuoteOpportunities).set(payload as Partial<InsertBulkQuoteOpportunity>)
    .where(eq(bulkQuoteOpportunities.opportunityToken, opportunityToken));
  return getBulkQuoteOpportunity(opportunityToken);
}

export async function getBulkQuoteOpportunity(opportunityToken: string) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.select().from(bulkQuoteOpportunities)
    .where(eq(bulkQuoteOpportunities.opportunityToken, opportunityToken));
  return result ?? null;
}

export async function listBulkQuoteOpportunities() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(bulkQuoteOpportunities).orderBy(desc(bulkQuoteOpportunities.updatedAt));
}

export async function getBulkOpportunityItems(opportunityToken: string, reviewStatus?: string) {
  const db = await getDb();
  if (!db) return [];
  const statuses = ["pending", "approved_target", "exception", "rejected", "invalid"] as const;
  const query = db.select().from(bulkQuoteOpportunityItems).where(
    reviewStatus && (statuses as readonly string[]).includes(reviewStatus)
      ? and(
          eq(bulkQuoteOpportunityItems.opportunityToken, opportunityToken),
          eq(bulkQuoteOpportunityItems.reviewStatus, reviewStatus as (typeof statuses)[number]),
        )
      : eq(bulkQuoteOpportunityItems.opportunityToken, opportunityToken),
  );
  return query.orderBy(asc(bulkQuoteOpportunityItems.sourceRow));
}

export async function importBulkQuoteOpportunityLines(
  opportunityToken: string,
  lines: BulkOpportunityImportLine[],
  actedBy: string,
) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  if (!lines.length) return { imported: 0, valid: 0, invalid: 0 };

  const seenPartNumbers = new Set<string>();
  const rows: InsertBulkQuoteOpportunityItem[] = lines.map((line) => {
    const requestedPartNumber = line.requestedPartNumber?.trim() || line.sourcePartNumber?.trim() || null;
    const ittPartNumber = line.ittPartNumber?.trim() || null;
    const partKey = (ittPartNumber || requestedPartNumber || "").toUpperCase();
    const importedQuantity = asNumber(line.quantity) || asNumber(line.annualUsage);
    const validationErrors = [...(line.validationErrors ?? [])];
    if (!partKey) validationErrors.push("A requested part number or ITT part number is required.");
    if (importedQuantity <= 0) validationErrors.push("Quantity or annual usage is required and must be greater than zero.");
    const sourceData = { ...(line.sourceData ?? {}) };
    if (partKey && seenPartNumbers.has(partKey)) sourceData.__potentialDuplicate = 1;
    if (partKey) seenPartNumbers.add(partKey);

    return {
      opportunityToken,
      sourceRow: Math.max(1, Math.round(asNumber(line.sourceRow))),
      sourcePartNumber: line.sourcePartNumber?.trim() || null,
      requestedPartNumber,
      ittPartNumber,
      description: line.description?.trim() || null,
      family: line.family?.trim() || null,
      productLine: line.productLine?.trim() || null,
      customerRevision: line.customerRevision?.trim() || null,
      quantity: Math.max(1, Math.round(importedQuantity || 1)),
      annualUsage: line.annualUsage == null ? null : Math.max(0, Math.round(asNumber(line.annualUsage))),
      minimumOrderQty: line.minimumOrderQty == null ? null : Math.max(0, Math.round(asNumber(line.minimumOrderQty))),
      leadTimeWeeks: line.leadTimeWeeks == null ? null : Math.max(0, Math.round(asNumber(line.leadTimeWeeks))),
      standardCost: asDecimal(line.standardCost),
      projectedCost: asDecimal(line.projectedCost),
      listPrice: asDecimal(line.listPrice),
      currentAwardPrice: asDecimal(line.currentAwardPrice),
      competitorPrice: asDecimal(line.competitorPrice),
      currentAwardMoq: line.currentAwardMoq == null ? null : Math.max(0, Math.round(asNumber(line.currentAwardMoq))),
      vendorCount: line.vendorCount == null ? null : Math.max(0, Math.round(asNumber(line.vendorCount))),
      costValidation: line.projectedCost != null ? "validated" : line.standardCost != null ? "estimated" : "missing",
      reviewStatus: validationErrors.length ? "invalid" : "pending",
      validationErrors,
      sourceData,
    } as InsertBulkQuoteOpportunityItem;
  });

  for (let offset = 0; offset < rows.length; offset += 150) {
    await db.insert(bulkQuoteOpportunityItems).values(rows.slice(offset, offset + 150));
  }
  const valid = rows.filter((row) => row.reviewStatus !== "invalid").length;
  await db.update(bulkQuoteOpportunities).set({
    status: "imported",
    importedRows: sql`${bulkQuoteOpportunities.importedRows} + ${rows.length}`,
    validRows: sql`${bulkQuoteOpportunities.validRows} + ${valid}`,
    invalidRows: sql`${bulkQuoteOpportunities.invalidRows} + ${rows.length - valid}`,
  }).where(eq(bulkQuoteOpportunities.opportunityToken, opportunityToken));
  await db.insert(bulkQuoteReviewEvents).values({
    opportunityToken,
    action: "imported",
    details: `${rows.length} lines imported (${valid} valid, ${rows.length - valid} requiring correction).`,
    actedBy,
  });
  return { imported: rows.length, valid, invalid: rows.length - valid };
}

const tierPrice = (target: number, floor: number, tier: "aggressive" | "target" | "conservative") =>
  tier === "aggressive" ? Math.max(floor, target * 0.88) : tier === "conservative" ? target * 1.1 : target;

export async function priceBulkQuoteOpportunity(opportunityToken: string, actedBy: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const opportunity = await getBulkQuoteOpportunity(opportunityToken);
  if (!opportunity) throw new Error("Opportunity not found");
  const items = await getBulkOpportunityItems(opportunityToken);
  const priceable = items.filter((item) => item.reviewStatus !== "invalid");
  let priced = 0;
  await db.update(bulkQuoteOpportunities).set({ status: "pricing" })
    .where(eq(bulkQuoteOpportunities.opportunityToken, opportunityToken));

  for (const item of priceable) {
    const partNumber = item.ittPartNumber || item.requestedPartNumber || item.sourcePartNumber || undefined;
    const cost = asNumber(item.projectedCost) || asNumber(item.standardCost) || undefined;
    const result = await computeTargetPrice({
      partNumber,
      family: item.family ?? item.productLine ?? undefined,
      isStandardCatalog: Boolean(item.ittPartNumber),
      itemType: "existing",
      customerTier: opportunity.customerTier ?? "Mid",
      customerChannel: opportunity.quoteChannel === "Distribution" ? "Distribution" : "OEM",
      dealType: "New Business",
      targetMarginPct: opportunity.targetMarginPct ?? 35,
      customCost: cost,
      quantity: item.quantity,
    });
    const targetTier = result.tiers.find((tier) => tier.label === "Target");
    const targetPrice = targetTier?.price ?? result.targetPrice;
    const recommendedTier: "aggressive" | "target" | "conservative" = asNumber(item.currentAwardPrice) > 0 && asNumber(item.currentAwardPrice) < targetPrice * 0.9 ? "aggressive" : "target";
    const proposedPrice = tierPrice(targetPrice, result.floorPrice, recommendedTier);
    const recommendedTierOutput = result.tiers.find((tier) => tier.label.toLowerCase() === recommendedTier);
    await db.update(bulkQuoteOpportunityItems).set({
      listPrice: asDecimal(result.listPrice),
      targetPrice: asDecimal(targetPrice),
      floorPrice: asDecimal(result.floorPrice),
      recommendedTier,
      selectedTier: recommendedTier,
      proposedPrice: asDecimal(proposedPrice),
      winProbability: recommendedTierOutput?.winProbability ?? targetTier?.winProbability ?? 50,
      grossMarginPct: recommendedTierOutput?.marginPct ?? targetTier?.marginPct ?? 0,
      priceConfidence: result.confidence,
      reviewStatus: "pending",
      targetOverridePrice: null,
      targetOverrideReason: null,
      targetOverrideOwner: null,
      targetOverrideAt: null,
      exceptionPrice: null,
      exceptionReason: null,
      exceptionOwner: null,
    }).where(eq(bulkQuoteOpportunityItems.id, item.id));
    priced++;
  }
  await db.update(bulkQuoteOpportunities).set({ status: "review" })
    .where(eq(bulkQuoteOpportunities.opportunityToken, opportunityToken));
  await db.insert(bulkQuoteReviewEvents).values({
    opportunityToken,
    action: "priced",
    details: `Target prices calculated for ${priced} valid lines with the active pricing rules.`,
    actedBy,
  });
  return { priced, invalid: items.length - priceable.length };
}

export async function applyBulkOpportunityAction(params: {
  opportunityToken: string;
  itemIds: number[];
  action: "approve_target" | "set_tier" | "reject";
  tier?: "aggressive" | "target" | "conservative";
  actedBy: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const items = await getBulkOpportunityItems(params.opportunityToken);
  const selected = items.filter((item) => params.itemIds.includes(item.id) && item.reviewStatus !== "invalid");
  for (const item of selected) {
    const selectedTier = params.action === "set_tier" ? (params.tier ?? "target") : (item.selectedTier ?? "target");
    await db.update(bulkQuoteOpportunityItems).set({
      reviewStatus: params.action === "reject" ? "rejected" : "approved_target",
      selectedTier,
      proposedPrice: params.action === "reject" ? item.proposedPrice : asDecimal(tierPrice(asNumber(item.targetPrice), asNumber(item.floorPrice), selectedTier)),
    }).where(eq(bulkQuoteOpportunityItems.id, item.id));
    await db.insert(bulkQuoteReviewEvents).values({
      opportunityToken: params.opportunityToken,
      itemId: item.id,
      action: params.action === "approve_target" ? "bulk_approved" : params.action === "set_tier" ? "tier_changed" : "rejected",
      details: params.action === "set_tier" ? `Selected ${selectedTier} recommendation.` : params.action === "approve_target" ? "Target recommendation approved." : "Line removed from opportunity.",
      actedBy: params.actedBy,
    });
  }
  return { updated: selected.length };
}

export async function updateBulkOpportunityItemCost(params: {
  opportunityToken: string;
  itemId: number;
  projectedCost: number;
  actedBy: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const opportunity = await getBulkQuoteOpportunity(params.opportunityToken);
  if (!opportunity) throw new Error("Opportunity not found");
  const [item] = await db.select().from(bulkQuoteOpportunityItems).where(and(
    eq(bulkQuoteOpportunityItems.id, params.itemId),
    eq(bulkQuoteOpportunityItems.opportunityToken, params.opportunityToken),
  ));
  if (!item) throw new Error("Opportunity line not found");
  if (!Number.isFinite(params.projectedCost) || params.projectedCost <= 0) throw new Error("Projected cost must be greater than zero.");

  const partNumber = item.ittPartNumber || item.requestedPartNumber || item.sourcePartNumber || undefined;
  const result = await computeTargetPrice({
    partNumber,
    family: item.family ?? item.productLine ?? undefined,
    isStandardCatalog: Boolean(item.ittPartNumber),
    itemType: "existing",
    customerTier: opportunity.customerTier ?? "Mid",
    customerChannel: opportunity.quoteChannel === "Distribution" ? "Distribution" : "OEM",
    dealType: "New Business",
    targetMarginPct: opportunity.targetMarginPct ?? 35,
    customCost: params.projectedCost,
    quantity: item.quantity,
  });
  const targetTier = result.tiers.find((tier) => tier.label === "Target");
  const targetPrice = targetTier?.price ?? result.targetPrice;
  const recommendedTier: "aggressive" | "target" | "conservative" = asNumber(item.currentAwardPrice) > 0 && asNumber(item.currentAwardPrice) < targetPrice * 0.9 ? "aggressive" : "target";
  const suggestedTier = result.tiers.find((tier) => tier.label.toLowerCase() === recommendedTier);
  await db.update(bulkQuoteOpportunityItems).set({
    projectedCost: asDecimal(params.projectedCost),
    costValidation: "validated",
    listPrice: asDecimal(result.listPrice),
    targetPrice: asDecimal(targetPrice),
    floorPrice: asDecimal(result.floorPrice),
    recommendedTier,
    selectedTier: recommendedTier,
    proposedPrice: asDecimal(tierPrice(targetPrice, result.floorPrice, recommendedTier)),
    winProbability: suggestedTier?.winProbability ?? targetTier?.winProbability ?? 50,
    grossMarginPct: suggestedTier?.marginPct ?? targetTier?.marginPct ?? 0,
    priceConfidence: result.confidence,
      reviewStatus: "pending",
      targetOverridePrice: null,
      targetOverrideReason: null,
      targetOverrideOwner: null,
      targetOverrideAt: null,
      exceptionPrice: null,
    exceptionReason: null,
    exceptionOwner: null,
  }).where(eq(bulkQuoteOpportunityItems.id, item.id));
  await db.insert(bulkQuoteReviewEvents).values({
    opportunityToken: params.opportunityToken,
    itemId: item.id,
    action: "priced",
    details: `Projected volume cost set to $${params.projectedCost.toFixed(4)}; target price recalculated and line returned to pending review.`,
    actedBy: params.actedBy,
  });
  return { success: true };
}

export async function setBulkOpportunityException(params: {
  opportunityToken: string;
  itemId: number;
  exceptionPrice: number;
  exceptionReason: string;
  exceptionOwner: string;
  actedBy: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const [item] = await db.select().from(bulkQuoteOpportunityItems).where(and(
    eq(bulkQuoteOpportunityItems.id, params.itemId),
    eq(bulkQuoteOpportunityItems.opportunityToken, params.opportunityToken),
  ));
  if (!item) throw new Error("Opportunity line not found");
  if (!params.exceptionReason.trim()) throw new Error("An exception reason is required");
  if (!params.exceptionOwner.trim()) throw new Error("An exception owner is required");
  const cost = asNumber(item.projectedCost) || asNumber(item.standardCost);
  await db.update(bulkQuoteOpportunityItems).set({
    reviewStatus: "exception",
    exceptionPrice: asDecimal(params.exceptionPrice),
    proposedPrice: asDecimal(params.exceptionPrice),
    exceptionReason: params.exceptionReason.trim(),
    exceptionOwner: params.exceptionOwner.trim(),
    grossMarginPct: cost > 0 ? ((params.exceptionPrice - cost) / params.exceptionPrice) * 100 : item.grossMarginPct,
  }).where(eq(bulkQuoteOpportunityItems.id, item.id));
  await db.insert(bulkQuoteReviewEvents).values({
    opportunityToken: params.opportunityToken,
    itemId: item.id,
    action: "exception_flagged",
    details: `Exception price $${params.exceptionPrice.toFixed(2)} — ${params.exceptionReason.trim()}`,
    actedBy: params.actedBy,
  });
  return { success: true };
}

export async function overrideBulkOpportunityTarget(params: {
  opportunityToken: string;
  itemId: number;
  proposedPrice: number;
  reason: string;
  owner: string;
  actedBy: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const [item] = await db.select().from(bulkQuoteOpportunityItems).where(and(
    eq(bulkQuoteOpportunityItems.id, params.itemId),
    eq(bulkQuoteOpportunityItems.opportunityToken, params.opportunityToken),
  ));
  if (!item) throw new Error("Opportunity line not found");
  if (!Number.isFinite(params.proposedPrice) || params.proposedPrice <= 0) throw new Error("Override price must be greater than zero.");
  if (!params.reason.trim()) throw new Error("Explain why the target price is being overridden.");
  if (!params.owner.trim()) throw new Error("Assign an accountable commercial owner.");

  const originalTarget = asNumber(item.targetPrice);
  const floor = asNumber(item.floorPrice);
  const cost = asNumber(item.projectedCost) || asNumber(item.standardCost);
  const priceDeltaPct = originalTarget > 0 ? ((params.proposedPrice - originalTarget) / originalTarget) * 100 : 0;
  const winProbability = Math.max(8, Math.min(96, asNumber(item.winProbability) - priceDeltaPct * 1.75));
  const belowFloor = floor > 0 && params.proposedPrice < floor;

  await db.update(bulkQuoteOpportunityItems).set({
    reviewStatus: belowFloor ? "exception" : "target_overridden",
    proposedPrice: asDecimal(params.proposedPrice),
    selectedTier: null,
    targetOverridePrice: asDecimal(params.proposedPrice),
    targetOverrideReason: params.reason.trim(),
    targetOverrideOwner: params.owner.trim(),
    targetOverrideAt: new Date(),
    exceptionPrice: belowFloor ? asDecimal(params.proposedPrice) : null,
    exceptionReason: belowFloor ? params.reason.trim() : null,
    exceptionOwner: belowFloor ? params.owner.trim() : null,
    grossMarginPct: cost > 0 ? ((params.proposedPrice - cost) / params.proposedPrice) * 100 : item.grossMarginPct,
    winProbability,
  }).where(eq(bulkQuoteOpportunityItems.id, item.id));
  await db.insert(bulkQuoteReviewEvents).values({
    opportunityToken: params.opportunityToken,
    itemId: item.id,
    action: "target_overridden",
    details: `Target ${originalTarget > 0 ? `$${originalTarget.toFixed(2)}` : "unavailable"} overridden to $${params.proposedPrice.toFixed(2)} (${priceDeltaPct >= 0 ? "+" : ""}${priceDeltaPct.toFixed(1)}%).${belowFloor ? " Below floor; routed as an approval exception." : ""} ${params.reason.trim()}`,
    actedBy: params.actedBy,
  });
  return { success: true, belowFloor, originalTarget, priceDeltaPct, winProbability };
}

export async function getBulkOpportunityLineDetail(opportunityToken: string, itemId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const [opportunity, item] = await Promise.all([
    getBulkQuoteOpportunity(opportunityToken),
    db.select().from(bulkQuoteOpportunityItems).where(and(
      eq(bulkQuoteOpportunityItems.id, itemId),
      eq(bulkQuoteOpportunityItems.opportunityToken, opportunityToken),
    )).then((rows) => rows[0] ?? null),
  ]);
  if (!opportunity || !item) throw new Error("Opportunity line not found");
  const cost = asNumber(item.projectedCost) || asNumber(item.standardCost) || undefined;
  const recommendation = await computeTargetPrice({
    partNumber: item.ittPartNumber || item.requestedPartNumber || item.sourcePartNumber || undefined,
    family: item.family ?? item.productLine ?? undefined,
    isStandardCatalog: Boolean(item.ittPartNumber),
    itemType: "existing",
    customerTier: opportunity.customerTier ?? "Mid",
    customerChannel: opportunity.quoteChannel === "Distribution" ? "Distribution" : "OEM",
    dealType: "New Business",
    targetMarginPct: opportunity.targetMarginPct ?? 35,
    customCost: cost,
    quantity: item.quantity,
  });
  return { opportunity, item, recommendation, cost };
}

export async function calculateBulkOpportunityDealScore(opportunityToken: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const opportunity = await getBulkQuoteOpportunity(opportunityToken);
  if (!opportunity) throw new Error("Opportunity not found");
  const items = await getBulkOpportunityItems(opportunityToken);
  const drivers: DealScoreDriver[] = [];
  const add = (label: string, impact: number, detail: string) => drivers.push({ label, impact, detail });

  if (opportunity.quoteChannel === "OEM") add("Channel", 4, "OEM quote aligns to direct-account coverage.");
  else add("Channel", 0, "Distributor economics and resale validation are assessed separately.");
  if (opportunity.quoteToCustomerSpec) add("Customer specification", 8, "Quote is tied to a documented customer specification.");
  else add("Customer specification", -3, "No customer-specification reference was supplied.");
  if (opportunity.sourcingPosition === "sole_source") add("Sourcing position", 15, "ITT is identified as sole source.");
  else if (opportunity.sourcingPosition === "mixed") add("Sourcing position", 4, "The opportunity has a mixed competitive position.");
  else if (opportunity.sourcingPosition === "competitive") add("Sourcing position", -4, "Competitive award requires more conservative governance.");
  else add("Sourcing position", -2, "Sourcing position has not been validated.");

  const desiredMargin = opportunity.targetMarginPct ?? 35;
  if (desiredMargin >= 35) add("Target margin", 7, `Commercial target is ${desiredMargin.toFixed(0)}%, aligned to governance.`);
  else if (desiredMargin >= 25) add("Target margin", 3, `Commercial target is ${desiredMargin.toFixed(0)}%, requiring normal review.`);
  else add("Target margin", -8, `Commercial target of ${desiredMargin.toFixed(0)}% is below the preferred range.`);
  if (asNumber(opportunity.priorBookingValue) > 0) add("Booked history", 8, `Prior booked business of $${asNumber(opportunity.priorBookingValue).toLocaleString()} supports continuity.`);
  if (asNumber(opportunity.expectedBookingValue) > 0) add("Expected bookings", 4, `Expected follow-on bookings of $${asNumber(opportunity.expectedBookingValue).toLocaleString()} recorded.`);
  if (opportunity.recentQuoteDate) add("Recent quote history", 3, "Recent quote context is available for comparison.");
  else add("Recent quote history", -3, "No recent quote history was supplied.");

  if (opportunity.quoteChannel === "Distribution") {
    if (opportunity.posValidation === "validated") add("POS validation", 8, "Distributor resale/POS evidence is validated.");
    else if (opportunity.posValidation === "partial") add("POS validation", 3, "Partial distributor resale/POS evidence is available.");
    else add("POS validation", -7, "Distributor resale/POS evidence requires validation.");
    const distyMargin = asNumber(opportunity.distributorMarginTargetPct);
    const ittMargin = asNumber(opportunity.ittMarginTargetPct);
    if (distyMargin && ittMargin && distyMargin <= ittMargin + 5) add("Channel economics", 4, "Distributor margin is within expected ITT trade-off.");
    else if (distyMargin && ittMargin) add("Channel economics", -5, "Distributor margin ask materially exceeds ITT margin.");
  }

  const valid = items.filter((item) => item.reviewStatus !== "invalid");
  const invalid = items.length - valid.length;
  const costValidated = valid.filter((item) => item.costValidation === "validated").length;
  const costMissing = valid.filter((item) => item.costValidation === "missing").length;
  const exceptions = valid.filter((item) => item.reviewStatus === "exception").length;
  const overrides = valid.filter((item) => item.reviewStatus === "target_overridden").length;
  const avgMargin = valid.length ? valid.reduce((total, item) => total + asNumber(item.grossMarginPct), 0) / valid.length : 0;
  const avgWinProbability = valid.length ? valid.reduce((total, item) => total + asNumber(item.winProbability), 0) / valid.length : 0;
  if (valid.length && costValidated / valid.length >= 0.8) add("Cost validation", 8, `${costValidated}/${valid.length} valid lines have projected cost at volume.`);
  else if (costMissing) add("Cost validation", -8, `${costMissing}/${valid.length || 0} valid lines need projected-cost evidence.`);
  else add("Cost validation", 2, "Standard cost is available, but projected volume cost needs validation.");
  if (avgMargin >= desiredMargin) add("Priced margin", 10, `Average target margin is ${avgMargin.toFixed(1)}%, meeting the ${desiredMargin.toFixed(0)}% goal.`);
  else add("Priced margin", -10, `Average target margin is ${avgMargin.toFixed(1)}%, below the ${desiredMargin.toFixed(0)}% goal.`);
  if (avgWinProbability >= 65) add("Win probability", 6, `Weighted line-level win probability is ${avgWinProbability.toFixed(0)}%.`);
  else if (avgWinProbability < 45) add("Win probability", -5, `Weighted line-level win probability is ${avgWinProbability.toFixed(0)}%.`);
  if (exceptions) add("Price exceptions", -Math.min(12, exceptions * 2), `${exceptions} lines require exception review.`);
  if (overrides) add("Target overrides", -Math.min(6, overrides), `${overrides} lines use a documented commercial target override.`);
  if (invalid) add("Import quality", -Math.min(12, invalid * 2), `${invalid} imported lines require correction.`);

  const score = Math.max(0, Math.min(100, 50 + drivers.reduce((total, driver) => total + driver.impact, 0)));
  const scoreBand = score >= 75 ? "strong" : score >= 55 ? "review" : "high_risk";
  const confidence = valid.length === 0 || costMissing / Math.max(1, valid.length) > 0.35 ? "low" : costValidated / Math.max(1, valid.length) >= 0.8 ? "high" : "medium";
  const scoreRecommendation = scoreBand === "strong"
    ? exceptions ? "Proceed with target pricing; route flagged exceptions for approval." : "Proceed with bulk target-price approval."
    : scoreBand === "review" ? "Review score drivers and resolve exceptions before approval." : "Escalate for commercial and cost review before approval.";
  await db.update(bulkQuoteOpportunities).set({ dealScore: score, scoreBand, scoreConfidence: confidence, scoreRecommendation, scoreDrivers: drivers })
    .where(eq(bulkQuoteOpportunities.opportunityToken, opportunityToken));
  return { score, scoreBand, confidence, scoreRecommendation, drivers, avgMargin, avgWinProbability, itemCount: items.length, validCount: valid.length, invalidCount: invalid, exceptions, overrides };
}

export async function getBulkOpportunityReview(opportunityToken: string) {
  const opportunity = await getBulkQuoteOpportunity(opportunityToken);
  if (!opportunity) return null;
  const [items, score] = await Promise.all([getBulkOpportunityItems(opportunityToken), calculateBulkOpportunityDealScore(opportunityToken)]);
  const totalQuotedValue = items.reduce((total, item) => total + asNumber(item.proposedPrice) * Math.max(1, item.quantity), 0);
  const totalListValue = items.reduce((total, item) => total + asNumber(item.listPrice) * Math.max(1, item.quantity), 0);
  return {
    opportunity: await getBulkQuoteOpportunity(opportunityToken),
    items,
    score,
    summary: {
      totalQuotedValue,
      totalListValue,
      averageDiscount: totalListValue > 0 ? ((totalListValue - totalQuotedValue) / totalListValue) * 100 : 0,
      counts: {
        pending: items.filter((item) => item.reviewStatus === "pending").length,
        approved: items.filter((item) => item.reviewStatus === "approved_target" || item.reviewStatus === "target_overridden").length,
        overrides: items.filter((item) => item.reviewStatus === "target_overridden").length,
        exceptions: items.filter((item) => item.reviewStatus === "exception").length,
        invalid: items.filter((item) => item.reviewStatus === "invalid").length,
      },
    },
  };
}

export async function submitBulkOpportunityForApproval(opportunityToken: string, submittedBy: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const opportunity = await getBulkQuoteOpportunity(opportunityToken);
  if (!opportunity) throw new Error("Opportunity not found");
  const items = await getBulkOpportunityItems(opportunityToken);
  const invalid = items.filter((item) => item.reviewStatus === "invalid").length;
  const pending = items.filter((item) => item.reviewStatus === "pending").length;
  const selected = items.filter((item) => item.reviewStatus === "approved_target" || item.reviewStatus === "target_overridden" || item.reviewStatus === "exception");
  if (invalid) throw new Error(`${invalid} imported lines must be corrected before submission.`);
  if (pending) throw new Error(`${pending} valid lines still need a decision or exception.`);
  if (!selected.length) throw new Error("Approve at least one line before submitting the opportunity.");

  const workflow = await createQuoteWorkflow({
    customerId: opportunity.customerId ?? undefined,
    customerName: opportunity.customerName,
    customerTier: (opportunity.customerTier ?? "Mid") as "Enterprise" | "Large" | "Mid" | "SMB",
    customerChannel: opportunity.quoteChannel === "Distribution" ? "Distribution" : "OEM",
    dealType: "New Business",
    urgency: "Standard",
    targetMarginPct: opportunity.targetMarginPct ?? 35,
    competitors: opportunity.competitors ?? [],
    notes: `Bulk SPA opportunity ${opportunity.name}. Deal score ${(opportunity.dealScore ?? 0).toFixed(0)}/100. ${opportunity.scoreRecommendation ?? ""}`,
  });
  if (!workflow) throw new Error("Could not create the approval quote workflow.");
  for (const [index, item] of Array.from(selected.entries())) {
    await upsertQuoteWorkflowItem({
      workflowToken: workflow.workflowToken,
      itemType: "existing",
      partNumber: item.ittPartNumber ?? item.requestedPartNumber ?? item.sourcePartNumber,
      description: item.description,
      family: item.family ?? item.productLine,
      isStandardCatalog: Boolean(item.ittPartNumber),
      listPrice: item.listPrice,
      targetPrice: item.targetPrice,
      floorPrice: item.floorPrice,
      quotedPrice: item.proposedPrice,
      quantity: item.quantity,
      customCost: item.projectedCost ?? item.standardCost,
      pricingRationale: item.reviewStatus === "exception" ? `Bulk exception: ${item.exceptionReason ?? "No reason recorded"}` : item.reviewStatus === "target_overridden" ? `Bulk target override: ${item.targetOverrideReason ?? "No reason recorded"}` : "Bulk target price approved.",
      priceConfidence: item.priceConfidence ?? "Medium",
      sortOrder: index,
    });
  }
  const approval = await submitQuoteForApproval(workflow.workflowToken, submittedBy);
  await db.update(bulkQuoteOpportunities).set({ status: "submitted", linkedWorkflowToken: workflow.workflowToken })
    .where(eq(bulkQuoteOpportunities.opportunityToken, opportunityToken));
  await db.insert(bulkQuoteReviewEvents).values({
    opportunityToken,
    action: "submitted",
    details: `${selected.length} selected lines submitted as ${workflow.workflowToken}; approval begins at Level ${approval.startLevel}.`,
    actedBy: submittedBy,
  });
  return { workflowToken: workflow.workflowToken, selectedLineCount: selected.length, ...approval };
}
