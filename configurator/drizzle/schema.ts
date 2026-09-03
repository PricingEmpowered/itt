import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  json,
  index,
  boolean,
  float,
  date,
} from "drizzle-orm/mysql-core";

// ─── Core Auth ────────────────────────────────────────────────────────────────

/**
 * Local user accounts, keyed by email and carrying their own password hash.
 * Provisioned with `pnpm create-user`; there is no self-service sign-up.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  /** scrypt hash written by server/_core/password.ts. Never a reversible value. */
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  name: text("name"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Product Catalog ──────────────────────────────────────────────────────────

export const products = mysqlTable(
  "products",
  {
    id: int("id").autoincrement().primaryKey(),
    description: varchar("description", { length: 255 }).notNull(),
    globalPn: varchar("globalPn", { length: 64 }),
    regionalPn: varchar("regionalPn", { length: 64 }),
    stripped: varchar("stripped", { length: 255 }),
    series: varchar("series", { length: 64 }),
    line: varchar("line", { length: 128 }),
    family: varchar("family", { length: 32 }),
  },
  (t) => [
    index("idx_description").on(t.description),
    index("idx_global_pn").on(t.globalPn),
    index("idx_family").on(t.family),
    index("idx_series").on(t.series),
  ]
);

export type Product = typeof products.$inferSelect;

// ─── Pricing Rules ────────────────────────────────────────────────────────────

export const pricingRules = mysqlTable(
  "pricing_rules",
  {
    id: int("id").autoincrement().primaryKey(),
    family: varchar("family", { length: 32 }).notNull(),
    shellSize: varchar("shellSize", { length: 16 }),
    contactType: varchar("contactType", { length: 16 }),
    material: varchar("material", { length: 16 }),
    basePrice: decimal("basePrice", { precision: 10, scale: 2 }).notNull().default("0.00"),
    customUpchargePct: decimal("customUpchargePct", { precision: 5, scale: 2 }).notNull().default("25.00"),
    notes: text("notes"),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    updatedBy: varchar("updatedBy", { length: 64 }),
  },
  (t) => [index("idx_pr_family").on(t.family)]
);

export type PricingRule = typeof pricingRules.$inferSelect;

// ─── Quote Sessions ───────────────────────────────────────────────────────────

export const quoteSessions = mysqlTable("quote_sessions", {
  id: int("id").autoincrement().primaryKey(),
  sessionToken: varchar("sessionToken", { length: 128 }).notNull().unique(),
  userId: int("userId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type QuoteSession = typeof quoteSessions.$inferSelect;

// ─── Quote Items ──────────────────────────────────────────────────────────────

export const quoteItems = mysqlTable(
  "quote_items",
  {
    id: int("id").autoincrement().primaryKey(),
    sessionToken: varchar("sessionToken", { length: 128 }).notNull(),
    partNumber: varchar("partNumber", { length: 255 }).notNull(),
    isCustom: boolean("isCustom").notNull().default(false),
    family: varchar("family", { length: 32 }),
    series: varchar("series", { length: 64 }),
    line: varchar("line", { length: 128 }),
    description: text("description"),
    attributes: json("attributes").$type<Record<string, string>>(),
    unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }),
    quantity: int("quantity").notNull().default(1),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("idx_qi_session").on(t.sessionToken)]
);

export type QuoteItem = typeof quoteItems.$inferSelect;

// ─── RFQ Submissions ──────────────────────────────────────────────────────────

export const rfqSubmissions = mysqlTable("rfq_submissions", {
  id: int("id").autoincrement().primaryKey(),
  sessionToken: varchar("sessionToken", { length: 128 }),
  contactName: varchar("contactName", { length: 128 }).notNull(),
  contactEmail: varchar("contactEmail", { length: 320 }).notNull(),
  company: varchar("company", { length: 128 }),
  phone: varchar("phone", { length: 32 }),
  notes: text("notes"),
  items: json("items").$type<Array<{
    partNumber: string;
    isCustom: boolean;
    family: string;
    description: string;
    attributes: Record<string, string>;
    unitPrice: string | null;
    quantity: number;
  }>>(),
  status: mysqlEnum("status", ["pending", "reviewing", "quoted", "closed"]).default("pending").notNull(),
  adminNotes: text("adminNotes"),
  submittedAt: timestamp("submittedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type RfqSubmission = typeof rfqSubmissions.$inferSelect;

// ─── Analytics: Monthly Snapshots ─────────────────────────────────────────────

export const analyticsSnapshots = mysqlTable(
  "analytics_snapshots",
  {
    id: int("id").autoincrement().primaryKey(),
    period: varchar("period", { length: 7 }).notNull(),
    productFamily: varchar("productFamily", { length: 64 }).notNull().default("All"),
    region: varchar("region", { length: 32 }).notNull().default("All"),
    channel: varchar("channel", { length: 64 }).notNull().default("All"),
    revenue: decimal("revenue", { precision: 14, scale: 2 }).notNull().default("0"),
    activeQuotes: int("activeQuotes").notNull().default(0),
    winRate: float("winRate").notNull().default(0),
    activeCustomers: int("activeCustomers").notNull().default(0),
    priceIndex: float("priceIndex").notNull().default(100),
    costIndex: float("costIndex").notNull().default(100),
    valueGapPct: float("valueGapPct").notNull().default(0),
  },
  (t) => [
    index("idx_snap_period").on(t.period),
    index("idx_snap_family").on(t.productFamily),
  ]
);

export type AnalyticsSnapshot = typeof analyticsSnapshots.$inferSelect;

// ─── Analytics: Margin Bridge ─────────────────────────────────────────────────

export const analyticsMarginBridge = mysqlTable(
  "analytics_margin_bridge",
  {
    id: int("id").autoincrement().primaryKey(),
    period: varchar("period", { length: 7 }).notNull(),
    productFamily: varchar("productFamily", { length: 64 }).notNull().default("All"),
    region: varchar("region", { length: 32 }).notNull().default("All"),
    channel: varchar("channel", { length: 64 }).notNull().default("All"),
    component: varchar("component", { length: 64 }).notNull(),
    value: decimal("value", { precision: 14, scale: 2 }).notNull(),
    sortOrder: int("sortOrder").notNull().default(0),
  },
  (t) => [index("idx_mb_period").on(t.period)]
);

export type AnalyticsMarginBridge = typeof analyticsMarginBridge.$inferSelect;

// ─── Analytics: Product Performance ──────────────────────────────────────────

export const analyticsProducts = mysqlTable(
  "analytics_products",
  {
    id: int("id").autoincrement().primaryKey(),
    partNumber: varchar("partNumber", { length: 64 }).notNull(),
    productFamily: varchar("productFamily", { length: 64 }).notNull(),
    sales: decimal("sales", { precision: 14, scale: 2 }).notNull().default("0"),
    marginAtListPct: float("marginAtListPct").notNull().default(0),
    avgDiscountPct: float("avgDiscountPct").notNull().default(0),
    discountType: mysqlEnum("discountType", ["list_price", "standard_discount", "custom_discount"]).notNull().default("list_price"),
    competitivePremiums: json("competitivePremiums").$type<Record<string, number>>(),
    paretoCategory: mysqlEnum("paretoCategory", ["A", "B", "C", "D"]).notNull().default("D"),
    period: varchar("period", { length: 7 }).notNull(),
  },
  (t) => [
    index("idx_ap_family").on(t.productFamily),
    index("idx_ap_period").on(t.period),
  ]
);

export type AnalyticsProduct = typeof analyticsProducts.$inferSelect;

// ─── Analytics: Quote Funnel ──────────────────────────────────────────────────

export const analyticsQuoteFunnel = mysqlTable(
  "analytics_quote_funnel",
  {
    id: int("id").autoincrement().primaryKey(),
    period: varchar("period", { length: 7 }).notNull(),
    region: varchar("region", { length: 32 }).notNull().default("All"),
    channel: varchar("channel", { length: 64 }).notNull().default("All"),
    segment: varchar("segment", { length: 64 }).notNull().default("All"),
    stage: mysqlEnum("stage", ["Technical Review", "Negotiation", "Won"]).notNull(),
    newBusiness: int("newBusiness").notNull().default(0),
    repeatBusiness: int("repeatBusiness").notNull().default(0),
    newValue: decimal("newValue", { precision: 14, scale: 2 }).notNull().default("0"),
    repeatValue: decimal("repeatValue", { precision: 14, scale: 2 }).notNull().default("0"),
    avgCycleTimeDays: float("avgCycleTimeDays").notNull().default(0),
  },
  (t) => [index("idx_qf_period").on(t.period)]
);

export type AnalyticsQuoteFunnel = typeof analyticsQuoteFunnel.$inferSelect;

// ─── Analytics: Price Waterfall ───────────────────────────────────────────────

export const analyticsPriceWaterfall = mysqlTable(
  "analytics_price_waterfall",
  {
    id: int("id").autoincrement().primaryKey(),
    period: varchar("period", { length: 7 }).notNull(),
    productFamily: varchar("productFamily", { length: 64 }).notNull().default("All"),
    region: varchar("region", { length: 32 }).notNull().default("All"),
    channel: varchar("channel", { length: 64 }).notNull().default("All"),
    segment: varchar("segment", { length: 64 }).notNull().default("All"),
    component: varchar("component", { length: 64 }).notNull(),
    value: decimal("value", { precision: 14, scale: 2 }).notNull(),
    sortOrder: int("sortOrder").notNull().default(0),
    isTotal: boolean("isTotal").notNull().default(false),
  },
  (t) => [index("idx_pw_period").on(t.period)]
);

export type AnalyticsPriceWaterfall = typeof analyticsPriceWaterfall.$inferSelect;

// ─── Customers ────────────────────────────────────────────────────────────────

export const customers = mysqlTable(
  "customers",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 128 }).notNull(),
    tier: mysqlEnum("tier", ["Enterprise", "Large", "Mid", "SMB"]).notNull().default("Mid"),
    industry: varchar("industry", { length: 64 }).notNull(),
    location: varchar("location", { length: 128 }),
    region: varchar("region", { length: 32 }).notNull().default("North America"),
    annualVolume: decimal("annualVolume", { precision: 14, scale: 2 }).notNull().default("0"),
    priceIndex: float("priceIndex").notNull().default(100),
    marginIndex: float("marginIndex").notNull().default(100),
    trend: mysqlEnum("trend", ["High", "Good", "Stable", "Low", "Declining"]).notNull().default("Stable"),
    channels: json("channels").$type<string[]>(),
    contracts: json("contracts").$type<string[]>(),
    primaryProducts: json("primaryProducts").$type<string[]>(), // product families
    contactName: varchar("contactName", { length: 128 }),
    contactEmail: varchar("contactEmail", { length: 320 }),
    notes: text("notes"),
    // Extended real-world fields
    country: varchar("country", { length: 64 }),
    state: varchar("state", { length: 8 }),
    channel: mysqlEnum("channel", ["OEM", "Distribution", "Intercompany"]).default("OEM"),
    industryCode: varchar("industryCode", { length: 16 }),
    salesRep: varchar("salesRep", { length: 128 }),
    contractStatus: varchar("contractStatus", { length: 32 }).default("Active"),
    contractExpiry: varchar("contractExpiry", { length: 16 }),
    preferredFamily: varchar("preferredFamily", { length: 64 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [
    index("idx_cust_tier").on(t.tier),
    index("idx_cust_industry").on(t.industry),
    index("idx_cust_region").on(t.region),
  ]
);

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;

// ─── Competitor Data ──────────────────────────────────────────────────────────

export const competitorData = mysqlTable(
  "competitor_data",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 128 }).notNull(),
    marketSharePct: float("marketSharePct").notNull().default(0),
    avgPrice: decimal("avgPrice", { precision: 10, scale: 2 }),
    priceTrend: mysqlEnum("priceTrend", ["up", "stable", "down"]).notNull().default("stable"),
    keyStrength: varchar("keyStrength", { length: 255 }),
    keyWeakness: varchar("keyWeakness", { length: 255 }),
    wins: int("wins").notNull().default(0),
    losses: int("losses").notNull().default(0),
    winRate: float("winRate").notNull().default(0),
    keyFactors: json("keyFactors").$type<string[]>(),
    segment: varchar("segment", { length: 64 }).notNull().default("All"),
    period: varchar("period", { length: 32 }).notNull().default("Last 12 Months"),
    isUs: boolean("isUs").notNull().default(false),
  }
);

export type CompetitorData = typeof competitorData.$inferSelect;

// ─── AI Model Stats ───────────────────────────────────────────────────────────

export const aiModelStats = mysqlTable("ai_model_stats", {
  id: int("id").autoincrement().primaryKey(),
  modelName: varchar("modelName", { length: 64 }).notNull(),
  modelType: mysqlEnum("modelType", ["price_optimization", "demand_forecasting", "customer_analytics", "anomaly_detection"]).notNull(),
  accuracy: float("accuracy").notNull().default(0),
  totalPredictions: int("totalPredictions").notNull().default(0),
  status: mysqlEnum("status", ["Active", "Training", "Inactive"]).notNull().default("Active"),
  lastRunAt: timestamp("lastRunAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AiModelStat = typeof aiModelStats.$inferSelect;

// ─── Managed Products (Product Management module) ─────────────────────────────

export const managedProducts = mysqlTable(
  "managed_products",
  {
    id: int("id").autoincrement().primaryKey(),
    sku: varchar("sku", { length: 64 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    category: varchar("category", { length: 64 }).notNull(),
    family: varchar("family", { length: 64 }).notNull(),
    isCustom: boolean("isCustom").notNull().default(false),
    listPrice: decimal("listPrice", { precision: 10, scale: 2 }).notNull(),
    unit: varchar("unit", { length: 16 }).notNull().default("EA"),
    complexityMultiplier: float("complexityMultiplier").notNull().default(1.0),
    moq: int("moq").notNull().default(1),
    customizationCount: int("customizationCount").notNull().default(0),
    status: mysqlEnum("status", ["Active", "Inactive", "Discontinued"]).notNull().default("Active"),
    basedOnSku: varchar("basedOnSku", { length: 64 }), // for custom products
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [
    index("idx_mp_family").on(t.family),
    index("idx_mp_category").on(t.category),
  ]
);

export type ManagedProduct = typeof managedProducts.$inferSelect;
export type InsertManagedProduct = typeof managedProducts.$inferInsert;

// ─── Price Lists ──────────────────────────────────────────────────────────────

export const priceLists = mysqlTable("price_lists", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description"),
  segment: varchar("segment", { length: 64 }).notNull().default("All"),
  isDefault: boolean("isDefault").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PriceList = typeof priceLists.$inferSelect;

// ─── Price List Items ─────────────────────────────────────────────────────────

export const priceListItems = mysqlTable(
  "price_list_items",
  {
    id: int("id").autoincrement().primaryKey(),
    priceListId: int("priceListId").notNull(),
    sku: varchar("sku", { length: 64 }).notNull(),
    productName: varchar("productName", { length: 255 }).notNull(),
    currentPrice: decimal("currentPrice", { precision: 10, scale: 2 }).notNull(),
    marginPct: float("marginPct").notNull().default(0),
    customers: int("customers").notNull().default(0),
    winRate: float("winRate").notNull().default(0),
    exceptionPct: float("exceptionPct").notNull().default(0),
    priceAttainment: float("priceAttainment").notNull().default(0),
    aiRecommendation: mysqlEnum("aiRecommendation", ["Increase", "Decrease", "Hold"]).notNull().default("Hold"),
    aiConfidence: float("aiConfidence").notNull().default(0),
    aiSuggestedPrice: decimal("aiSuggestedPrice", { precision: 10, scale: 2 }),
    status: mysqlEnum("status", ["Pending Review", "Approved", "Rejected"]).notNull().default("Pending Review"),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [
    index("idx_pli_list").on(t.priceListId),
    index("idx_pli_sku").on(t.sku),
  ]
);

export type PriceListItem = typeof priceListItems.$inferSelect;

// ─── Quote Management ─────────────────────────────────────────────────────────

export const quoteMgmt = mysqlTable(
  "quote_mgmt",
  {
    id: int("id").autoincrement().primaryKey(),
    quoteId: varchar("quoteId", { length: 32 }).notNull().unique(),
    customerId: int("customerId"),
    customerName: varchar("customerName", { length: 128 }).notNull(),
    contactName: varchar("contactName", { length: 128 }),
    totalValue: decimal("totalValue", { precision: 14, scale: 2 }).notNull().default("0"),
    status: mysqlEnum("status", ["Draft", "Pending Approval", "Auto-Approved", "Approved", "Rejected", "Expired", "Converted"]).notNull().default("Draft"),
    items: json("items").$type<Array<{
      sku: string;
      description: string;
      qty: number;
      unitPrice: number;
      discount: number;
      total: number;
    }>>(),
    notes: text("notes"),
    expiryDate: timestamp("expiryDate"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [
    index("idx_qm_status").on(t.status),
    index("idx_qm_customer").on(t.customerName),
  ]
);

export type QuoteMgmt = typeof quoteMgmt.$inferSelect;
export type InsertQuoteMgmt = typeof quoteMgmt.$inferInsert;

// ─── Dynamic Pricing Scenarios ────────────────────────────────────────────────

export const dynamicPricingScenarios = mysqlTable(
  "dynamic_pricing_scenarios",
  {
    id: int("id").autoincrement().primaryKey(),
    productSku: varchar("productSku", { length: 64 }).notNull(),
    productName: varchar("productName", { length: 255 }).notNull(),
    currentPrice: decimal("currentPrice", { precision: 10, scale: 2 }).notNull(),
    strategy: mysqlEnum("strategy", ["Market-Based", "Value-Based", "Cost-Plus", "Demand-Based"]).notNull(),
    suggestedPrice: decimal("suggestedPrice", { precision: 10, scale: 2 }).notNull(),
    priceLiftPct: float("priceLiftPct").notNull().default(0),
    volumeImpactPct: float("volumeImpactPct").notNull().default(0),
    revenueImpact: decimal("revenueImpact", { precision: 14, scale: 2 }).notNull().default("0"),
    confidence: float("confidence").notNull().default(0),
    elasticity: float("elasticity").notNull().default(-0.5),
    segment: varchar("segment", { length: 64 }).notNull().default("All"),
    period: varchar("period", { length: 32 }).notNull().default("Current"),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [index("idx_dps_sku").on(t.productSku)]
);

export type DynamicPricingScenario = typeof dynamicPricingScenarios.$inferSelect;

// ─── Quote Workflow Sessions ───────────────────────────────────────────────────────────────────────────────────

export const quoteWorkflows = mysqlTable(
  "quote_workflows",
  {
    id: int("id").autoincrement().primaryKey(),
    workflowToken: varchar("workflowToken", { length: 128 }).notNull().unique(),
    // Customer info (from master or manually entered)
    customerId: int("customerId"), // null = new/manual customer
    customerName: varchar("customerName", { length: 128 }).notNull(),
    customerTier: mysqlEnum("customerTier", ["Enterprise", "Large", "Mid", "SMB"]).default("Mid"),
    customerRegion: varchar("customerRegion", { length: 32 }),
    customerChannel: mysqlEnum("customerChannel", ["OEM", "Distribution", "Intercompany"]).default("OEM"),
    customerIndustry: varchar("customerIndustry", { length: 64 }),
    customerPriceIndex: float("customerPriceIndex").default(1.0),
    customerMarginIndex: float("customerMarginIndex").default(0.68),
    contactName: varchar("contactName", { length: 128 }),
    contactEmail: varchar("contactEmail", { length: 320 }),
    contactPhone: varchar("contactPhone", { length: 32 }),
    // Deal attributes
    dealType: mysqlEnum("dealType", ["New Business", "Repeat Business", "Renewal", "Expansion"]).default("New Business"),
    urgency: mysqlEnum("urgency", ["Standard", "Expedite", "Emergency"]).default("Standard"),
    targetMarginPct: float("targetMarginPct").default(35.0),
    notes: text("notes"),
        status: mysqlEnum("status", ["draft", "submitted", "quoted", "won", "lost"]).default("draft").notNull(),
    // Quote validity window
    effectiveDate: date("effectiveDate"),
    expirationDate: date("expirationDate"),
    validityDays: int("validityDays").default(30),
    // Competitors identified on this quote
    competitors: json("competitors").$type<string[]>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [
    index("idx_qw_token").on(t.workflowToken),
    index("idx_qw_customer").on(t.customerId),
    index("idx_qw_expiry").on(t.expirationDate),
  ]
);
export type QuoteWorkflow = typeof quoteWorkflows.$inferSelect;
export type InsertQuoteWorkflow = typeof quoteWorkflows.$inferInsert;

// ─── Quote Workflow Line Items ───────────────────────────────────────────────────────────────────────────

export const quoteWorkflowItems = mysqlTable(
  "quote_workflow_items",
  {
    id: int("id").autoincrement().primaryKey(),
    workflowToken: varchar("workflowToken", { length: 128 }).notNull(),
    // Item type drives the pricing path
    itemType: mysqlEnum("itemType", ["existing", "configured", "custom"]).notNull().default("existing"),
    // Part identification
    partNumber: varchar("partNumber", { length: 255 }),
    description: text("description"),
    family: varchar("family", { length: 32 }),
    series: varchar("series", { length: 64 }),
    isStandardCatalog: boolean("isStandardCatalog").default(false),
    // Configured item attributes (JSON from configurator)
    configuredAttributes: json("configuredAttributes").$type<Record<string, string>>(),
    // Custom item fields
    customDescription: text("customDescription"),
    customBaseFamily: varchar("customBaseFamily", { length: 32 }),
    customComplexity: mysqlEnum("customComplexity", ["Low", "Medium", "High", "Very High"]).default("Medium"),
    customMoq: int("customMoq").default(1),
    customLeadTimeDays: int("customLeadTimeDays").default(90),
    customCost: decimal("customCost", { precision: 10, scale: 2 }),  // User-entered cost for custom items
    // Pricing
    listPrice: decimal("listPrice", { precision: 10, scale: 2 }),
    targetPrice: decimal("targetPrice", { precision: 10, scale: 2 }),
    floorPrice: decimal("floorPrice", { precision: 10, scale: 2 }),
    quotedPrice: decimal("quotedPrice", { precision: 10, scale: 2 }),
    quantity: int("quantity").notNull().default(1),
    // Target price engine output
    pricingRationale: text("pricingRationale"),
    priceConfidence: mysqlEnum("priceConfidence", ["High", "Medium", "Low"]).default("Medium"),
    sortOrder: int("sortOrder").notNull().default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [index("idx_qwi_token").on(t.workflowToken)]
);

export type QuoteWorkflowItem = typeof quoteWorkflowItems.$inferSelect;
export type InsertQuoteWorkflowItem = typeof quoteWorkflowItems.$inferInsert;

// ─── Quote Approval Workflow ───────────────────────────────────────────────────────────────────────────────────
// 5-level approval chain: Level 1 = Sales Rep, 2 = Sales Manager, 3 = Regional Director, 4 = VP Sales, 5 = CFO/Executive
export const approvalLevels = [
  { level: 1, role: "Sales Rep",          title: "Sales Representative",  discountThreshold: 5  },
  { level: 2, role: "Sales Manager",      title: "Sales Manager",         discountThreshold: 10 },
  { level: 3, role: "Regional Director",  title: "Regional Director",     discountThreshold: 18 },
  { level: 4, role: "VP Sales",           title: "VP of Sales",           discountThreshold: 25 },
  { level: 5, role: "CFO",               title: "CFO / Executive",        discountThreshold: 100 },
] as const;

export const quoteApprovals = mysqlTable(
  "quote_approvals",
  {
    id: int("id").autoincrement().primaryKey(),
    workflowToken: varchar("workflowToken", { length: 128 }).notNull(),
    // Approval level (1-5)
    level: int("level").notNull(),
    role: varchar("role", { length: 64 }).notNull(),
    title: varchar("title", { length: 128 }).notNull(),
    // Status at this level
    status: mysqlEnum("status", ["pending", "approved", "rejected", "escalated", "delegated", "skipped"]).notNull().default("pending"),
    // Who acted (user id or name — stored as string since we may not have full user management)
    assignedTo: varchar("assignedTo", { length: 128 }),    // approver name/role
    actedBy: varchar("actedBy", { length: 128 }),          // who actually acted
    actedAt: timestamp("actedAt"),
    comments: text("comments"),
    // Escalation / delegation target
    escalatedToLevel: int("escalatedToLevel"),
    delegatedTo: varchar("delegatedTo", { length: 128 }),
    // Discount % at time of submission (used to determine required approval level)
    discountPct: float("discountPct").default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [
    index("idx_qa_token").on(t.workflowToken),
    index("idx_qa_level").on(t.level),
    index("idx_qa_status").on(t.status),
  ]
);
export type QuoteApproval = typeof quoteApprovals.$inferSelect;
export type InsertQuoteApproval = typeof quoteApprovals.$inferInsert;

// ─── Customer Pricing Agreements ─────────────────────────────────────────────
export const customerAgreements = mysqlTable(
  "customer_agreements",
  {
    id: int("id").autoincrement().primaryKey(),
    customerId: int("customerId"),
    customerName: varchar("customerName", { length: 128 }).notNull(),
    customerTier: varchar("customerTier", { length: 32 }),
    channel: varchar("channel", { length: 32 }),
    productFamily: varchar("productFamily", { length: 64 }),
    partNumber: varchar("partNumber", { length: 128 }),       // null = applies to whole family
    description: text("description"),
    // Price bounds
    floorPrice: decimal("floorPrice", { precision: 10, scale: 2 }),
    targetPrice: decimal("targetPrice", { precision: 10, scale: 2 }),
    ceilingPrice: decimal("ceilingPrice", { precision: 10, scale: 2 }),
    maxDiscountPct: float("maxDiscountPct"),
    // Validity
    effectiveDate: date("effectiveDate").notNull(),
    expirationDate: date("expirationDate").notNull(),
    autoRenew: boolean("autoRenew").default(false),
    renewalNoticeDays: int("renewalNoticeDays").default(30),
    // Status
    status: mysqlEnum("status", ["active", "pending", "expired", "cancelled"]).default("pending").notNull(),
    approvedBy: varchar("approvedBy", { length: 128 }),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [
    index("idx_ca_customer").on(t.customerId),
    index("idx_ca_family").on(t.productFamily),
    index("idx_ca_expiry").on(t.expirationDate),
    index("idx_ca_status").on(t.status),
  ]
);
export type CustomerAgreement = typeof customerAgreements.$inferSelect;
export type InsertCustomerAgreement = typeof customerAgreements.$inferInsert;

// ─── Price Change Audit Log ───────────────────────────────────────────────────
export const priceChangeAudit = mysqlTable(
  "price_change_audit",
  {
    id: int("id").autoincrement().primaryKey(),
    entityType: mysqlEnum("entityType", ["price_list_item", "product", "agreement", "quote"]).notNull(),
    entityId: int("entityId").notNull(),
    entityLabel: varchar("entityLabel", { length: 256 }),   // human-readable: part number or list name
    field: varchar("field", { length: 64 }).notNull(),      // e.g. "listPrice", "targetPrice"
    oldValue: varchar("oldValue", { length: 128 }),
    newValue: varchar("newValue", { length: 128 }),
    changePct: float("changePct"),                          // % change for numeric fields
    changedBy: varchar("changedBy", { length: 128 }).notNull(),
    reason: text("reason"),
    approvalToken: varchar("approvalToken", { length: 128 }), // link to approval if applicable
    changedAt: timestamp("changedAt").defaultNow().notNull(),
  },
  (t) => [
    index("idx_pca_entity").on(t.entityType, t.entityId),
    index("idx_pca_changed_at").on(t.changedAt),
  ]
);
export type PriceChangeAudit = typeof priceChangeAudit.$inferSelect;
export type InsertPriceChangeAudit = typeof priceChangeAudit.$inferInsert;

// ─── Channel Price Compliance ─────────────────────────────────────────────────
export const channelCompliance = mysqlTable(
  "channel_compliance",
  {
    id: int("id").autoincrement().primaryKey(),
    quoteToken: varchar("quoteToken", { length: 128 }),
    customerId: int("customerId"),
    customerName: varchar("customerName", { length: 128 }).notNull(),
    channel: varchar("channel", { length: 32 }).notNull(),
    partNumber: varchar("partNumber", { length: 128 }).notNull(),
    productFamily: varchar("productFamily", { length: 64 }),
    quotedPrice: decimal("quotedPrice", { precision: 10, scale: 2 }).notNull(),
    listPrice: decimal("listPrice", { precision: 10, scale: 2 }),
    authorisedFloor: decimal("authorisedFloor", { precision: 10, scale: 2 }),
    authorisedCeiling: decimal("authorisedCeiling", { precision: 10, scale: 2 }),
    discountPct: float("discountPct"),
    compliant: boolean("compliant").notNull().default(true),
    violationType: mysqlEnum("violationType", ["below_floor", "above_ceiling", "no_agreement", "compliant"]).default("compliant"),
    quoteDate: timestamp("quoteDate").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [
    index("idx_cc_customer").on(t.customerId),
    index("idx_cc_channel").on(t.channel),
    index("idx_cc_compliant").on(t.compliant),
    index("idx_cc_date").on(t.quoteDate),
  ]
);
export type ChannelCompliance = typeof channelCompliance.$inferSelect;
export type InsertChannelCompliance = typeof channelCompliance.$inferInsert;

// ─── Engine Pricing Rules ─────────────────────────────────────────────────────
export const engineRules = mysqlTable(
  "engine_rules",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 128 }).notNull(),
    ruleType: mysqlEnum("ruleType", [
      "min_margin",
      "min_markup",
      "family_tether",
      "competitor_tie",
      "max_discount_segment",
    ]).notNull(),
    // Scope: which products/customers this rule applies to
    scope: mysqlEnum("scope", ["global", "family", "channel", "customerTier"]).notNull().default("global"),
    scopeValue: varchar("scopeValue", { length: 64 }), // e.g. "MIL-38999", "OEM", "Enterprise"
    // Rule parameters
    paramValue: decimal("paramValue", { precision: 8, scale: 4 }).notNull(), // margin %, markup %, tether ratio, premium %, max discount %
    competitorName: varchar("competitorName", { length: 64 }), // for competitor_tie only
    // Priority: lower number = higher priority (applied first, overrides lower-priority rules)
    priority: int("priority").notNull().default(100),
    active: boolean("active").notNull().default(true),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    updatedBy: varchar("updatedBy", { length: 64 }),
  },
  (t) => [
    index("idx_er_ruleType").on(t.ruleType),
    index("idx_er_scope").on(t.scope),
    index("idx_er_priority").on(t.priority),
    index("idx_er_active").on(t.active),
  ]
);
export type EngineRule = typeof engineRules.$inferSelect;
export type InsertEngineRule = typeof engineRules.$inferInsert;

// ─── Bulk Quote Opportunities / SPA Imports ──────────────────────────────────
// An opportunity stores the commercial context once; its imported product lines
// are reviewed and priced independently in bulk_quote_opportunity_items.
export const bulkQuoteOpportunities = mysqlTable(
  "bulk_quote_opportunities",
  {
    id: int("id").autoincrement().primaryKey(),
    opportunityToken: varchar("opportunityToken", { length: 128 }).notNull().unique(),
    name: varchar("name", { length: 180 }).notNull(),
    status: mysqlEnum("status", ["draft", "imported", "pricing", "review", "ready_for_approval", "submitted", "closed"]).notNull().default("draft"),
    // Import provenance: raw input stays in the browser; these fields provide an auditable reference.
    sourceFileName: varchar("sourceFileName", { length: 255 }),
    sourceFormat: mysqlEnum("sourceFormat", ["minimal", "spa_extract", "parts_view", "worksheet", "csv", "other"]).default("minimal"),
    sourceSheet: varchar("sourceSheet", { length: 128 }),
    importedRows: int("importedRows").notNull().default(0),
    validRows: int("validRows").notNull().default(0),
    invalidRows: int("invalidRows").notNull().default(0),
    // Customer and commercial context.
    customerId: int("customerId"),
    customerName: varchar("customerName", { length: 128 }).notNull(),
    customerTier: varchar("customerTier", { length: 32 }).default("Mid"),
    quoteChannel: mysqlEnum("quoteChannel", ["OEM", "Distribution"]).notNull().default("OEM"),
    quoteToCustomerSpec: boolean("quoteToCustomerSpec").notNull().default(false),
    customerSpecReference: varchar("customerSpecReference", { length: 128 }),
    sourcingPosition: mysqlEnum("sourcingPosition", ["competitive", "sole_source", "mixed", "unknown"]).notNull().default("unknown"),
    competitors: json("competitors").$type<string[]>(),
    // Target metrics captured at the opportunity header.
    targetRevenue: decimal("targetRevenue", { precision: 14, scale: 2 }),
    targetMarginPct: float("targetMarginPct").default(35),
    targetWinProbability: float("targetWinProbability"),
    // History / booking evidence.
    recentQuoteSummary: text("recentQuoteSummary"),
    recentQuoteDate: date("recentQuoteDate"),
    priorBookingValue: decimal("priorBookingValue", { precision: 14, scale: 2 }),
    expectedBookingValue: decimal("expectedBookingValue", { precision: 14, scale: 2 }),
    bookingEvidence: text("bookingEvidence"),
    // POS and distribution economics.
    posValidation: mysqlEnum("posValidation", ["validated", "partial", "unavailable", "not_applicable"]).notNull().default("not_applicable"),
    posSupporters: text("posSupporters"),
    distributorMarginTargetPct: float("distributorMarginTargetPct"),
    ittMarginTargetPct: float("ittMarginTargetPct"),
    costValidationNotes: text("costValidationNotes"),
    // Scored decision output; calculated server-side and retained at review / submission.
    dealScore: float("dealScore"),
    scoreBand: mysqlEnum("scoreBand", ["strong", "review", "high_risk"]),
    scoreConfidence: mysqlEnum("scoreConfidence", ["high", "medium", "low"]),
    scoreRecommendation: varchar("scoreRecommendation", { length: 255 }),
    scoreDrivers: json("scoreDrivers").$type<Array<{ label: string; impact: number; detail: string }>>(),
    linkedWorkflowToken: varchar("linkedWorkflowToken", { length: 128 }),
    createdBy: varchar("createdBy", { length: 128 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [
    index("idx_bqo_status").on(t.status),
    index("idx_bqo_customer").on(t.customerId),
    index("idx_bqo_token").on(t.opportunityToken),
  ]
);
export type BulkQuoteOpportunity = typeof bulkQuoteOpportunities.$inferSelect;
export type InsertBulkQuoteOpportunity = typeof bulkQuoteOpportunities.$inferInsert;

export const bulkQuoteOpportunityItems = mysqlTable(
  "bulk_quote_opportunity_items",
  {
    id: int("id").autoincrement().primaryKey(),
    opportunityToken: varchar("opportunityToken", { length: 128 }).notNull(),
    sourceRow: int("sourceRow").notNull(),
    sourcePartNumber: varchar("sourcePartNumber", { length: 255 }),
    requestedPartNumber: varchar("requestedPartNumber", { length: 255 }),
    ittPartNumber: varchar("ittPartNumber", { length: 255 }),
    description: text("description"),
    family: varchar("family", { length: 64 }),
    productLine: varchar("productLine", { length: 64 }),
    customerRevision: varchar("customerRevision", { length: 64 }),
    quantity: int("quantity").notNull().default(1),
    annualUsage: int("annualUsage"),
    minimumOrderQty: int("minimumOrderQty"),
    leadTimeWeeks: int("leadTimeWeeks"),
    // Imported cost and quote signals.
    standardCost: decimal("standardCost", { precision: 12, scale: 4 }),
    projectedCost: decimal("projectedCost", { precision: 12, scale: 4 }),
    listPrice: decimal("listPrice", { precision: 12, scale: 4 }),
    currentAwardPrice: decimal("currentAwardPrice", { precision: 12, scale: 4 }),
    competitorPrice: decimal("competitorPrice", { precision: 12, scale: 4 }),
    currentAwardMoq: int("currentAwardMoq"),
    vendorCount: int("vendorCount"),
    // Bulk target-pricing output.
    targetPrice: decimal("targetPrice", { precision: 12, scale: 4 }),
    floorPrice: decimal("floorPrice", { precision: 12, scale: 4 }),
    recommendedTier: mysqlEnum("recommendedTier", ["aggressive", "target", "conservative"]),
    selectedTier: mysqlEnum("selectedTier", ["aggressive", "target", "conservative"]),
    proposedPrice: decimal("proposedPrice", { precision: 12, scale: 4 }),
    winProbability: float("winProbability"),
    grossMarginPct: float("grossMarginPct"),
    priceConfidence: mysqlEnum("priceConfidence", ["High", "Medium", "Low"]),
    // Decision state is separate from pricing so users can bulk-approve targets and flag exceptions.
    reviewStatus: mysqlEnum("reviewStatus", ["pending", "approved_target", "target_overridden", "exception", "rejected", "invalid"]).notNull().default("pending"),
    // A target override retains the original engine target and captures governed commercial rationale.
    targetOverridePrice: decimal("targetOverridePrice", { precision: 12, scale: 4 }),
    targetOverrideReason: text("targetOverrideReason"),
    targetOverrideOwner: varchar("targetOverrideOwner", { length: 128 }),
    targetOverrideAt: timestamp("targetOverrideAt"),
    exceptionPrice: decimal("exceptionPrice", { precision: 12, scale: 4 }),
    exceptionReason: text("exceptionReason"),
    exceptionOwner: varchar("exceptionOwner", { length: 128 }),
    costValidation: mysqlEnum("costValidation", ["validated", "estimated", "missing"]).notNull().default("missing"),
    validationErrors: json("validationErrors").$type<string[]>(),
    sourceData: json("sourceData").$type<Record<string, string | number | null>>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [
    index("idx_bqoi_opportunity").on(t.opportunityToken),
    index("idx_bqoi_status").on(t.reviewStatus),
    index("idx_bqoi_part").on(t.ittPartNumber),
  ]
);
export type BulkQuoteOpportunityItem = typeof bulkQuoteOpportunityItems.$inferSelect;
export type InsertBulkQuoteOpportunityItem = typeof bulkQuoteOpportunityItems.$inferInsert;

// Immutable audit trail for individual exceptions and bulk review decisions.
export const bulkQuoteReviewEvents = mysqlTable(
  "bulk_quote_review_events",
  {
    id: int("id").autoincrement().primaryKey(),
    opportunityToken: varchar("opportunityToken", { length: 128 }).notNull(),
    itemId: int("itemId"),
    action: mysqlEnum("action", ["imported", "priced", "bulk_approved", "tier_changed", "target_overridden", "exception_flagged", "exception_resolved", "rejected", "submitted"]).notNull(),
    details: text("details"),
    actedBy: varchar("actedBy", { length: 128 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [
    index("idx_bqre_opportunity").on(t.opportunityToken),
    index("idx_bqre_item").on(t.itemId),
  ]
);
export type BulkQuoteReviewEvent = typeof bulkQuoteReviewEvents.$inferSelect;
