import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { hashPassword, verifyPassword } from "./_core/password";
import {
  clearSessionCookie,
  createSessionToken,
  setSessionCookie,
} from "./_core/session";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import {
  getUserByEmail,
  getUserById,
  recordSignIn,
  setUserPassword,
  lookupProductByDescription,
  searchProducts,
  getPricingRules,
  getPriceForConfig,
  updatePricingRule,
  getQuoteItems,
  addQuoteItem,
  removeQuoteItem,
  updateQuoteItemQty,
  clearQuoteItems,
  createRfqSubmission,
  getAllRfqSubmissions,
  updateRfqStatus,
  getAnalyticsOverallPerformance,
  getAnalyticsListPricePerformance,
  getAnalyticsQuoteFunnel,
  getAnalyticsPriceWaterfall,
  // New module helpers
  getCustomers,
  getCustomerById,
  upsertCustomer,
  deleteCustomer,
  getCompetitorData,
  getAiModelStats,
  updateAiModelStats,
  getManagedProducts,
  upsertManagedProduct,
  deleteManagedProduct,
  getPriceLists,
  getPriceListItems,
  updatePriceListItemStatus,
  updatePriceListItemPrice,
  getQuoteMgmt,
  createQuoteWorkflow,
  getQuoteWorkflow,
  updateQuoteWorkflow,
  listQuoteWorkflows,
  getQuoteWorkflowItems,
  upsertQuoteWorkflowItem,
  deleteQuoteWorkflowItem,
  computeTargetPrice,
  getQuoteIntelligence,
  getCompetitorNames,
  getQuoteMgmtById,
  upsertQuoteMgmt,
  updateQuoteMgmtStatus,
  getDynamicPricingScenarios,
  searchProductsByPartNumber,
  submitQuoteForApproval,
  getApprovalChain,
  getApprovalQueue,
  approveLevel,
  rejectLevel,
  escalateLevel,
  delegateLevel,
  getExpiringQuotes,
  updateQuoteWorkflowDates,
  listCustomerAgreements,
  getCustomerAgreementById,
  upsertCustomerAgreement,
  deleteCustomerAgreement,
  checkAgreementPrice,
  logPriceChange,
  getPriceAuditLog,
  recordComplianceEvent,
  getComplianceReport,
  getComplianceSummary,
  getMarginCausalityFlags,
  getEngineRules,
  createEngineRule,
  updateEngineRule,
  deleteEngineRule,
  reorderEngineRules,
} from "./db";
import {
  applyBulkOpportunityAction,
  calculateBulkOpportunityDealScore,
  createBulkQuoteOpportunity,
  getBulkOpportunityItems,
  getBulkOpportunityReview,
  importBulkQuoteOpportunityLines,
  getBulkOpportunityLineDetail,
  listBulkQuoteOpportunities,
  overrideBulkOpportunityTarget,
  priceBulkQuoteOpportunity,
  setBulkOpportunityException,
  submitBulkOpportunityForApproval,
  updateBulkQuoteOpportunity,
  updateBulkOpportunityItemCost,
} from "./bulkOpportunityDb";
import { FAMILY_ATTRIBUTES, FAMILIES, assemblePartNumber, decodePartNumber } from "../shared/connectorData";

// ─── Admin guard ──────────────────────────────────────────────────────────────

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

// ─── Router ───────────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),

    /**
     * The same message is returned for an unknown email, a wrong password and
     * a deactivated account, and a dummy hash is verified in those cases so
     * response time does not reveal which emails exist.
     */
    signIn: publicProcedure
      .input(
        z.object({
          email: z.string().trim().min(3).max(320).email(),
          password: z.string().min(1).max(200),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const user = await getUserByEmail(input.email);

        const storedHash =
          user && user.isActive
            ? user.passwordHash
            : "scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

        const passwordMatches = await verifyPassword(input.password, storedHash);

        if (!user || !user.isActive || !passwordMatches) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid email or password",
          });
        }

        await recordSignIn(user.id);
        setSessionCookie(ctx.req, ctx.res, await createSessionToken(user.id));

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      clearSessionCookie(ctx.req, ctx.res);
      return { success: true } as const;
    }),

    changePassword: protectedProcedure
      .input(
        z.object({
          currentPassword: z.string().min(1).max(200),
          newPassword: z.string().min(12).max(200),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const user = await getUserById(ctx.user.id);
        if (
          !user ||
          !(await verifyPassword(input.currentPassword, user.passwordHash))
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Current password is incorrect",
          });
        }
        await setUserPassword(user.id, await hashPassword(input.newPassword));
        return { success: true } as const;
      }),
  }),

  // ─── Configurator ───────────────────────────────────────────────────────────

  configurator: router({
    getFamilies: publicProcedure.query(() => FAMILIES),

    getAttributes: publicProcedure
      .input(z.object({ family: z.string() }))
      .query(({ input }) => {
        const attrs = FAMILY_ATTRIBUTES[input.family];
        if (!attrs) throw new TRPCError({ code: "NOT_FOUND", message: `Unknown family: ${input.family}` });
        return attrs;
      }),

    lookupPart: publicProcedure
      .input(z.object({ partNumber: z.string().min(1) }))
      .query(async ({ input }) => {
        const product = await lookupProductByDescription(input.partNumber);
        return product ?? null;
      }),

    searchParts: publicProcedure
      .input(z.object({ query: z.string(), family: z.string().optional(), limit: z.number().default(20) }))
      .query(async ({ input }) => {
        return searchProducts(input.query, input.family, input.limit);
      }),
    searchPartNumbers: publicProcedure
      .input(z.object({ query: z.string(), limit: z.number().default(12) }))
      .query(async ({ input }) => {
        if (input.query.trim().length < 2) return [];
        return searchProductsByPartNumber(input.query, input.limit);
      }),

    buildAndLookup: publicProcedure
      .input(z.object({
        family: z.string(),
        style: z.string().optional(),
        material: z.string().optional(),
        size: z.string().optional(),
        insert: z.string().optional(),
        contact: z.string().optional(),
        suffix: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const partNumber = assemblePartNumber(input);
        const product = await lookupProductByDescription(partNumber);
        const isCustom = !product;

        const priceRule = await getPriceForConfig(input.family, input.size, input.contact);
        let unitPrice: string | null = null;

        if (priceRule) {
          const base = parseFloat(priceRule.basePrice);
          if (isCustom) {
            const upcharge = parseFloat(priceRule.customUpchargePct) / 100;
            unitPrice = (base * (1 + upcharge)).toFixed(2);
          } else {
            unitPrice = base.toFixed(2);
          }
        }

        const decoded = decodePartNumber(input.family, partNumber);

        return {
          partNumber,
          isCustom,
          product: product ?? null,
          unitPrice,
          decoded,
          family: input.family,
          attributes: {
            style: input.style,
            material: input.material,
            size: input.size,
            insert: input.insert,
            contact: input.contact,
            suffix: input.suffix,
          },
        };
      }),
  }),

  // ─── Quote Cart ─────────────────────────────────────────────────────────────

  quote: router({
    getItems: publicProcedure
      .input(z.object({ sessionToken: z.string() }))
      .query(async ({ input }) => {
        return getQuoteItems(input.sessionToken);
      }),

    addItem: publicProcedure
      .input(z.object({
        sessionToken: z.string(),
        partNumber: z.string(),
        isCustom: z.boolean(),
        family: z.string().optional(),
        series: z.string().optional(),
        line: z.string().optional(),
        description: z.string().optional(),
        attributes: z.record(z.string(), z.string()).optional(),
        unitPrice: z.string().optional(),
        quantity: z.number().min(1).default(1),
      }))
      .mutation(async ({ input }) => {
        return addQuoteItem(input);
      }),

    removeItem: publicProcedure
      .input(z.object({ id: z.number(), sessionToken: z.string() }))
      .mutation(async ({ input }) => {
        await removeQuoteItem(input.id, input.sessionToken);
        return getQuoteItems(input.sessionToken);
      }),

    updateQuantity: publicProcedure
      .input(z.object({ id: z.number(), sessionToken: z.string(), quantity: z.number().min(1) }))
      .mutation(async ({ input }) => {
        await updateQuoteItemQty(input.id, input.sessionToken, input.quantity);
        return getQuoteItems(input.sessionToken);
      }),

    clear: publicProcedure
      .input(z.object({ sessionToken: z.string() }))
      .mutation(async ({ input }) => {
        await clearQuoteItems(input.sessionToken);
        return [];
      }),

    submitRfq: publicProcedure
      .input(z.object({
        sessionToken: z.string(),
        contactName: z.string().min(1),
        contactEmail: z.string().email(),
        company: z.string().optional(),
        phone: z.string().optional(),
        notes: z.string().optional(),
        items: z.array(z.object({
          partNumber: z.string(),
          isCustom: z.boolean(),
          family: z.string(),
          description: z.string(),
          attributes: z.record(z.string(), z.string()),
          unitPrice: z.string().nullable(),
          quantity: z.number(),
        })),
      }))
      .mutation(async ({ input }) => {
        await createRfqSubmission(input);
        await clearQuoteItems(input.sessionToken);
        return { success: true };
      }),
  }),

  // ─── Admin ──────────────────────────────────────────────────────────────────

  admin: router({
    getPricingRules: adminProcedure
      .input(z.object({ family: z.string().optional() }))
      .query(async ({ input }) => {
        return getPricingRules(input.family);
      }),

    updatePricingRule: adminProcedure
      .input(z.object({
        id: z.number(),
        basePrice: z.string().optional(),
        customUpchargePct: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await updatePricingRule(input.id, {
          basePrice: input.basePrice,
          customUpchargePct: input.customUpchargePct,
          notes: input.notes,
          updatedBy: ctx.user.name ?? ctx.user.email,
        });
        return { success: true };
      }),

    getRfqSubmissions: adminProcedure.query(async () => {
      return getAllRfqSubmissions();
    }),

    updateRfqStatus: adminProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["pending", "reviewing", "quoted", "closed"]),
        adminNotes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await updateRfqStatus(input.id, input.status, input.adminNotes);
        return { success: true };
      }),
  }),

  // ─── Analytics ──────────────────────────────────────────────────────────────

  analytics: router({
    getOverallPerformance: publicProcedure
      .input(z.object({
        timePeriod: z.string().default("Year over Year"),
        productFamily: z.string().default("All Product Families"),
        region: z.string().default("All Regions"),
        channel: z.string().default("All Channels"),
      }))
      .query(async ({ input }) => {
        return getAnalyticsOverallPerformance(input);
      }),

    getListPricePerformance: publicProcedure
      .input(z.object({
        productFamily: z.string().default("All Product Families"),
        period: z.string().default("2025-12"),
      }))
      .query(async ({ input }) => {
        return getAnalyticsListPricePerformance(input);
      }),

    getQuoteFunnel: publicProcedure
      .input(z.object({
        timePeriod: z.string().default("Year over Year"),
        region: z.string().default("All Regions"),
        channel: z.string().default("All Channels"),
        segment: z.string().default("All Segments"),
        timeRange: z.string().default("Last Year"),
      }))
      .query(async ({ input }) => {
        return getAnalyticsQuoteFunnel(input);
      }),

    getPriceWaterfall: publicProcedure
      .input(z.object({
        productFamily: z.string().default("All Product Families"),
        region: z.string().default("All Regions"),
        channel: z.string().default("All Channels"),
        segment: z.string().default("All Segments"),
        period: z.string().default("2025-12"),
      }))
      .query(async ({ input }) => {
        return getAnalyticsPriceWaterfall(input);
      }),
  }),

  // ─── Competitive Intelligence ────────────────────────────────────────────────

  competitive: router({
    getData: publicProcedure
      .input(z.object({
        segment: z.string().default("All"),
        period: z.string().default("Last 12 Months"),
      }))
      .query(async ({ input }) => {
        return getCompetitorData(input.segment, input.period);
      }),
  }),

  // ─── Dynamic Pricing ─────────────────────────────────────────────────────────

  dynamicPricing: router({
    getScenarios: publicProcedure
      .input(z.object({
        strategy: z.string().optional(),
        segment: z.string().optional(),
      }))
      .query(async ({ input }) => {
        return getDynamicPricingScenarios(input.strategy, input.segment);
      }),
  }),

  // ─── AI Tools ────────────────────────────────────────────────────────────────

  aiTools: router({
    getModels: publicProcedure.query(async () => {
      return getAiModelStats();
    }),

    runModel: publicProcedure
      .input(z.object({
        modelType: z.enum(["price_optimization", "demand_forecasting", "customer_analytics", "anomaly_detection"]),
      }))
      .mutation(async ({ input }) => {
        // Simulate model run — increment predictions and update lastRunAt
        const stats = await getAiModelStats();
        const model = stats.find((m) => m.modelType === input.modelType);
        if (!model) throw new TRPCError({ code: "NOT_FOUND" });
        const newPredictions = model.totalPredictions + Math.floor(50 + Math.random() * 200);
        await updateAiModelStats(model.id, { totalPredictions: newPredictions });
        return { success: true, newPredictions };
      }),
  }),

  // ─── Customer Management ─────────────────────────────────────────────────────

  customers: router({
    list: publicProcedure
      .input(z.object({
        tier: z.string().optional(),
        region: z.string().optional(),
        industry: z.string().optional(),
        search: z.string().optional(),
        channel: z.string().optional(),
      }))
      .query(async ({ input }) => {
        return getCustomers(input);
      }),

    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const c = await getCustomerById(input.id);
        if (!c) throw new TRPCError({ code: "NOT_FOUND" });
        return c;
      }),

    upsert: adminProcedure
      .input(z.object({
        id: z.number().optional(),
        name: z.string().min(1),
        tier: z.enum(["Enterprise", "Large", "Mid", "SMB"]),
        industry: z.string(),
        location: z.string().optional(),
        region: z.string(),
        annualVolume: z.number(),
        priceIndex: z.number(),
        marginIndex: z.number(),
        trend: z.enum(["High", "Good", "Stable", "Low", "Declining"]),
        channels: z.array(z.string()).optional(),
        contracts: z.array(z.string()).optional(),
        primaryProducts: z.array(z.string()).optional(),
        contactName: z.string().optional(),
        contactEmail: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { annualVolume, ...rest } = input;
        return upsertCustomer({ ...rest, annualVolume: String(annualVolume) } as Parameters<typeof upsertCustomer>[0]);
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteCustomer(input.id);
        return { success: true };
      }),
  }),

  // ─── Product Management ───────────────────────────────────────────────────────

  productMgmt: router({
    list: publicProcedure
      .input(z.object({
        isCustom: z.boolean().optional(),
        family: z.string().optional(),
        status: z.string().optional(),
        search: z.string().optional(),
      }))
      .query(async ({ input }) => {
        return getManagedProducts(input);
      }),

    upsert: adminProcedure
      .input(z.object({
        id: z.number().optional(),
        sku: z.string().min(1),
        name: z.string().min(1),
        description: z.string().optional(),
        category: z.string(),
        family: z.string(),
        isCustom: z.boolean().default(false),
        listPrice: z.number(),
        unit: z.string().default("EA"),
        complexityMultiplier: z.number().default(1.0),
        moq: z.number().default(1),
        status: z.enum(["Active", "Inactive", "Discontinued"]).default("Active"),
        basedOnSku: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { listPrice, ...rest } = input;
        return upsertManagedProduct({
          ...rest,
          listPrice: String(listPrice),
        });
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteManagedProduct(input.id);
        return { success: true };
      }),
  }),

  // ─── Price List Management ────────────────────────────────────────────────────

  priceLists: router({
    getLists: publicProcedure.query(async () => {
      return getPriceLists();
    }),

    getItems: publicProcedure
      .input(z.object({
        priceListId: z.number(),
        recommendation: z.string().optional(),
        status: z.string().optional(),
        search: z.string().optional(),
      }))
      .query(async ({ input }) => {
        return getPriceListItems(input);
      }),

        approveItem: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await updatePriceListItemStatus(input.id, "Approved");
        await logPriceChange({ entityType: "price_list_item", entityId: input.id, entityLabel: `Item #${input.id}`, field: "status", oldValue: "Pending Review", newValue: "Approved", changedBy: ctx.user?.name ?? "Admin" });
        return { success: true };
      }),
    rejectItem: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await updatePriceListItemStatus(input.id, "Rejected");
        await logPriceChange({ entityType: "price_list_item", entityId: input.id, entityLabel: `Item #${input.id}`, field: "status", oldValue: "Pending Review", newValue: "Rejected", changedBy: ctx.user?.name ?? "Admin" });
        return { success: true };
      }),
    overridePrice: adminProcedure
      .input(z.object({ id: z.number(), newPrice: z.number(), reason: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        await updatePriceListItemPrice(input.id, input.newPrice);
        await logPriceChange({ entityType: "price_list_item", entityId: input.id, entityLabel: `Item #${input.id}`, field: "listPrice", newValue: `$${input.newPrice.toFixed(2)}`, changedBy: ctx.user?.name ?? "Admin", reason: input.reason });
        return { success: true };
      }),
  }),

  // ─── Quote Management ─────────────────────────────────────────────────────────

  quoteMgmt: router({
    list: publicProcedure
      .input(z.object({
        status: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      }))
      .query(async ({ input }) => {
        return getQuoteMgmt(input);
      }),

    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const q = await getQuoteMgmtById(input.id);
        if (!q) throw new TRPCError({ code: "NOT_FOUND" });
        return q;
      }),

    upsert: publicProcedure
      .input(z.object({
        id: z.number().optional(),
        quoteId: z.string().optional(),
        customerName: z.string().min(1),
        contactName: z.string().optional(),
        totalValue: z.number(),
        status: z.enum(["Draft", "Pending Approval", "Auto-Approved", "Approved", "Rejected", "Expired", "Converted"]).default("Draft"),
        items: z.array(z.object({
          sku: z.string(),
          description: z.string(),
          qty: z.number(),
          unitPrice: z.number(),
          discount: z.number(),
          total: z.number(),
        })).optional(),
        notes: z.string().optional(),
        expiryDate: z.date().optional(),
      }))
      .mutation(async ({ input }) => {
        const { totalValue, expiryDate, items, ...rest } = input;
        return upsertQuoteMgmt({
          ...rest,
          totalValue: String(totalValue),
          expiryDate: expiryDate ?? null,
          items: items ?? null,
        });
      }),

    updateStatus: adminProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["Draft", "Pending Approval", "Auto-Approved", "Approved", "Rejected", "Expired", "Converted"]),
      }))
      .mutation(async ({ input }) => {
        await updateQuoteMgmtStatus(input.id, input.status);
        return { success: true };
      }),
  }),
  quoteWorkflow: router({
    create: publicProcedure
      .input(z.object({
        customerName: z.string(),
        customerId: z.number().optional(),
        customerTier: z.enum(["Enterprise", "Large", "Mid", "SMB"]).optional(),
        customerRegion: z.string().optional(),
        customerChannel: z.enum(["OEM", "Distribution", "Intercompany"]).optional(),
        customerIndustry: z.string().optional(),
        customerPriceIndex: z.number().optional(),
        customerMarginIndex: z.number().optional(),
        contactName: z.string().optional(),
        contactEmail: z.string().optional(),
        contactPhone: z.string().optional(),
        dealType: z.enum(["New Business", "Repeat Business", "Renewal", "Expansion"]).optional(),
        urgency: z.enum(["Standard", "Expedite", "Emergency"]).optional(),
        targetMarginPct: z.number().optional(),
        notes: z.string().optional(),
        competitors: z.array(z.string()).optional(),
        effectiveDate: z.string().optional(),
        expirationDate: z.string().optional(),
      }))
      .mutation(async ({ input }) => createQuoteWorkflow(input as any)),

    get: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => getQuoteWorkflow(input.token)),

    update: publicProcedure
      .input(z.object({
        token: z.string(),
        customerName: z.string().optional(),
        contactName: z.string().optional(),
        contactEmail: z.string().optional(),
        contactPhone: z.string().optional(),
        dealType: z.enum(["New Business", "Repeat Business", "Renewal", "Expansion"]).optional(),
        urgency: z.enum(["Standard", "Expedite", "Emergency"]).optional(),
        targetMarginPct: z.number().optional(),
        notes: z.string().optional(),
        status: z.enum(["draft", "submitted", "quoted", "won", "lost"]).optional(),
        competitors: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input }) => {
        const { token, ...data } = input;
        await updateQuoteWorkflow(token, data);
        return getQuoteWorkflow(token);
      }),

    list: publicProcedure
      .input(z.object({ status: z.string().optional() }))
      .query(async ({ input }) => listQuoteWorkflows(input.status)),

    getItems: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => getQuoteWorkflowItems(input.token)),

    upsertItem: publicProcedure
      .input(z.object({
        id: z.number().optional(),
        workflowToken: z.string(),
        itemType: z.enum(["existing", "configured", "custom"]),
        partNumber: z.string().optional(),
        description: z.string().optional(),
        family: z.string().optional(),
        series: z.string().optional(),
        isStandardCatalog: z.boolean().optional(),
        configuredAttributes: z.record(z.string(), z.string()).optional(),
        customDescription: z.string().optional(),
        customBaseFamily: z.string().optional(),
        customComplexity: z.enum(["Low", "Medium", "High", "Very High"]).optional(),
        customMoq: z.number().optional(),
        customLeadTimeDays: z.number().optional(),
        customCost: z.number().optional(),
        listPrice: z.number().optional(),
        targetPrice: z.number().optional(),
        floorPrice: z.number().optional(),
        quotedPrice: z.number().optional(),
        quantity: z.number().optional(),
        pricingRationale: z.string().optional(),
        priceConfidence: z.enum(["High", "Medium", "Low"]).optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { listPrice, targetPrice, floorPrice, quotedPrice, customCost, ...rest } = input;
        const { configuredAttributes, ...restWithoutAttrs } = rest;
        return upsertQuoteWorkflowItem({
          ...restWithoutAttrs,
          configuredAttributes: configuredAttributes as Record<string, string> | undefined,
          listPrice: listPrice != null ? String(listPrice) : undefined,
          targetPrice: targetPrice != null ? String(targetPrice) : undefined,
          floorPrice: floorPrice != null ? String(floorPrice) : undefined,
          quotedPrice: quotedPrice != null ? String(quotedPrice) : undefined,
          customCost: customCost != null ? String(customCost) : undefined,
        });
      }),

    deleteItem: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteQuoteWorkflowItem(input.id);
        return { success: true };
      }),

    computeTargetPrice: publicProcedure
      .input(z.object({
        partNumber: z.string().optional(),
        family: z.string().optional(),
        isStandardCatalog: z.boolean().optional(),
        itemType: z.enum(["existing", "configured", "custom"]),
        customComplexity: z.string().optional(),
        customMoq: z.number().optional(),
        customCost: z.number().optional(),
        customerTier: z.string().optional(),
        customerChannel: z.string().optional(),
        customerPriceIndex: z.number().optional(),
        customerMarginIndex: z.number().optional(),
        dealType: z.string().optional(),
        urgency: z.string().optional(),
        targetMarginPct: z.number().optional(),
        quantity: z.number().optional(),
      }))
            .query(async ({ input }) => computeTargetPrice(input)),
    getCompetitorNames: publicProcedure
      .query(async () => getCompetitorNames()),
    getQuoteIntelligence: publicProcedure
      .input(z.object({
        customerTier: z.string().optional(),
        channel: z.string().optional(),
        family: z.string().optional(),
        avgDiscount: z.number(),
        totalValue: z.number(),
        dealType: z.string().optional(),
        urgency: z.string().optional(),
        lineCount: z.number().optional(),
      }))
      .query(async ({ input }) => getQuoteIntelligence(input)),
  }),
  // ─── Approval Workflow ────────────────────────────────────────────────────────
  approval: router({
    /** Submit a quote for the 5-level approval chain */
    submit: publicProcedure
      .input(z.object({ workflowToken: z.string(), submittedBy: z.string().default("Sales Rep") }))
      .mutation(async ({ input }) => submitQuoteForApproval(input.workflowToken, input.submittedBy)),

    /** Get the full approval chain (all 5 levels) for a quote */
    getChain: publicProcedure
      .input(z.object({ workflowToken: z.string() }))
      .query(async ({ input }) => getApprovalChain(input.workflowToken)),
    /** Get full quote detail: workflow header + line items + approval chain */
    getQuoteDetail: publicProcedure
      .input(z.object({ workflowToken: z.string() }))
      .query(async ({ input }) => {
        const [workflow, items, chain] = await Promise.all([
          getQuoteWorkflow(input.workflowToken),
          getQuoteWorkflowItems(input.workflowToken),
          getApprovalChain(input.workflowToken),
        ]);
        if (!workflow) return null;
        // Compute totals
        const totalList = items.reduce((s, it) => s + (parseFloat(String(it.listPrice ?? 0)) * (it.quantity ?? 1)), 0);
        const totalQuoted = items.reduce((s, it) => s + (parseFloat(String(it.quotedPrice ?? 0)) * (it.quantity ?? 1)), 0);
        const avgDiscount = totalList > 0 ? ((totalList - totalQuoted) / totalList) * 100 : 0;
        return { workflow, items, chain, totals: { totalList, totalQuoted, avgDiscount } };
      }),

    /** Get all quotes pending approval, optionally filtered by level */
    getQueue: publicProcedure
      .input(z.object({ level: z.number().optional() }))
      .query(async ({ input }) => getApprovalQueue(input.level)),

    /** Approve the current level */
    approve: publicProcedure
      .input(z.object({
        workflowToken: z.string(),
        level: z.number().int().min(1).max(5),
        actedBy: z.string(),
        comments: z.string().optional(),
      }))
      .mutation(async ({ input }) => approveLevel(input.workflowToken, input.level, input.actedBy, input.comments)),

    /** Reject at the current level — returns quote to draft */
    reject: publicProcedure
      .input(z.object({
        workflowToken: z.string(),
        level: z.number().int().min(1).max(5),
        actedBy: z.string(),
        comments: z.string(),
      }))
      .mutation(async ({ input }) => rejectLevel(input.workflowToken, input.level, input.actedBy, input.comments)),

    /** Escalate to a higher level */
    escalate: publicProcedure
      .input(z.object({
        workflowToken: z.string(),
        fromLevel: z.number().int().min(1).max(5),
        toLevel: z.number().int().min(2).max(5),
        actedBy: z.string(),
        reason: z.string(),
      }))
      .mutation(async ({ input }) => escalateLevel(input.workflowToken, input.fromLevel, input.toLevel, input.actedBy, input.reason)),

    /** Delegate to another approver */
    delegate: publicProcedure
      .input(z.object({
        workflowToken: z.string(),
        level: z.number().int().min(1).max(5),
        actedBy: z.string(),
        delegateTo: z.string(),
        reason: z.string().optional(),
      }))
      .mutation(async ({ input }) => delegateLevel(input.workflowToken, input.level, input.actedBy, input.delegateTo, input.reason)),
  }),
  dashboard: router({
    getCounts: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return { pendingApprovals: 0, openQuotes: 0, pendingApprovalQuotes: 0, approvedQuotes: 0, totalQuoteMgmt: 0, aiModelsActive: 0, aiModelsTotal: 0, lastAiRun: null };
      const { quoteWorkflows, quoteApprovals, quoteMgmt } = await import("../drizzle/schema.js");
      const { eq, count } = await import("drizzle-orm");

      const [pendingApprovals] = await db
        .select({ count: count() })
        .from(quoteApprovals)
        .where(eq(quoteApprovals.status, "pending"));

      const [openQuotes] = await db
        .select({ count: count() })
        .from(quoteWorkflows)
        .where(eq(quoteWorkflows.status, "draft"));

      const [pendingApprovalQuotes] = await db
        .select({ count: count() })
        .from(quoteWorkflows)
        .where(eq(quoteWorkflows.status, "submitted"));

      const [approvedQuotes] = await db
        .select({ count: count() })
        .from(quoteWorkflows)
        .where(eq(quoteWorkflows.status, "won"));

      const [totalQuoteMgmt] = await db
        .select({ count: count() })
        .from(quoteMgmt);

      const aiModels = await getAiModelStats();
      const lastAiRun = aiModels.reduce((latest, m) => {
        if (!m.lastRunAt) return latest;
        return !latest || m.lastRunAt > latest ? m.lastRunAt : latest;
      }, null as Date | null);

      return {
        pendingApprovals: pendingApprovals?.count ?? 0,
        openQuotes: openQuotes?.count ?? 0,
        pendingApprovalQuotes: pendingApprovalQuotes?.count ?? 0,
        approvedQuotes: approvedQuotes?.count ?? 0,
        totalQuoteMgmt: totalQuoteMgmt?.count ?? 0,
        aiModelsActive: aiModels.filter((m) => m.status === "Active").length,
        aiModelsTotal: aiModels.length,
        lastAiRun,
      };
    }),
  }),

  // ─── Quote Expiry ──────────────────────────────────────────────────────────────
  quoteExpiry: router({
    getExpiring: publicProcedure
      .input(z.object({ withinDays: z.number().default(10) }))
      .query(async ({ input }) => getExpiringQuotes(input.withinDays)),
    updateDates: publicProcedure
      .input(z.object({
        token: z.string(),
        effectiveDate: z.string().optional(),
        expirationDate: z.string().optional(),
        validityDays: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { token, ...rest } = input;
        await updateQuoteWorkflowDates(token, rest);
        return { success: true };
      }),
  }),

  // ─── Customer Pricing Agreements ───────────────────────────────────────────────
  agreements: router({
    list: publicProcedure
      .input(z.object({
        customerId: z.number().optional(),
        status: z.string().optional(),
        family: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().optional(),
      }))
      .query(async ({ input }) => listCustomerAgreements(input)),
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => getCustomerAgreementById(input.id)),
    upsert: publicProcedure
      .input(z.object({
        id: z.number().optional(),
        customerId: z.number().optional(),
        customerName: z.string(),
        customerTier: z.string().optional(),
        channel: z.string().optional(),
        productFamily: z.string().optional(),
        partNumber: z.string().optional(),
        description: z.string().optional(),
        floorPrice: z.number().optional(),
        targetPrice: z.number().optional(),
        ceilingPrice: z.number().optional(),
        maxDiscountPct: z.number().optional(),
        effectiveDate: z.string(),
        expirationDate: z.string(),
        autoRenew: z.boolean().optional(),
        renewalNoticeDays: z.number().optional(),
        status: z.enum(["active", "pending", "expired", "cancelled"]).optional(),
        approvedBy: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { floorPrice, targetPrice, ceilingPrice, ...rest } = input;
        return upsertCustomerAgreement({
          ...rest,
          floorPrice: floorPrice != null ? String(floorPrice) : undefined,
          targetPrice: targetPrice != null ? String(targetPrice) : undefined,
          ceilingPrice: ceilingPrice != null ? String(ceilingPrice) : undefined,
        } as any);
      }),
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => { await deleteCustomerAgreement(input.id); return { success: true }; }),
    checkPrice: publicProcedure
      .input(z.object({ customerId: z.number(), partNumber: z.string(), family: z.string().optional() }))
      .query(async ({ input }) => checkAgreementPrice(input.customerId, input.partNumber, input.family)),
  }),

  // ─── Price Change Audit Log ─────────────────────────────────────────────────────
  priceAudit: router({
    log: publicProcedure
      .input(z.object({
        entityType: z.enum(["price_list_item", "product", "agreement", "quote"]),
        entityId: z.number(),
        entityLabel: z.string().optional(),
        field: z.string(),
        oldValue: z.string().optional(),
        newValue: z.string().optional(),
        changePct: z.number().optional(),
        changedBy: z.string(),
        reason: z.string().optional(),
        approvalToken: z.string().optional(),
      }))
      .mutation(async ({ input }) => { await logPriceChange(input); return { success: true }; }),
    getLog: publicProcedure
      .input(z.object({
        entityType: z.string().optional(),
        entityId: z.number().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }))
      .query(async ({ input }) => getPriceAuditLog(input)),
  }),

  // ─── Channel Price Compliance ───────────────────────────────────────────────────
  compliance: router({
    record: publicProcedure
      .input(z.object({
        quoteToken: z.string().optional(),
        customerId: z.number().optional(),
        customerName: z.string(),
        channel: z.string(),
        partNumber: z.string(),
        productFamily: z.string().optional(),
        quotedPrice: z.number(),
        listPrice: z.number().optional(),
        authorisedFloor: z.number().optional(),
        authorisedCeiling: z.number().optional(),
        discountPct: z.number().optional(),
        compliant: z.boolean(),
        violationType: z.enum(["below_floor", "above_ceiling", "no_agreement", "compliant"]).optional(),
      }))
      .mutation(async ({ input }) => {
        const { quotedPrice, listPrice, authorisedFloor, authorisedCeiling, ...rest } = input;
        await recordComplianceEvent({
          ...rest,
          quotedPrice: String(quotedPrice),
          listPrice: listPrice != null ? String(listPrice) : undefined,
          authorisedFloor: authorisedFloor != null ? String(authorisedFloor) : undefined,
          authorisedCeiling: authorisedCeiling != null ? String(authorisedCeiling) : undefined,
        } as any);
        return { success: true };
      }),
    getReport: publicProcedure
      .input(z.object({
        channel: z.string().optional(),
        customerId: z.number().optional(),
        compliant: z.boolean().optional(),
        family: z.string().optional(),
        days: z.number().optional(),
        limit: z.number().optional(),
      }))
      .query(async ({ input }) => getComplianceReport(input)),
    getSummary: publicProcedure
      .query(async () => getComplianceSummary()),
  }),

  // ─── Margin Causality ───────────────────────────────────────────────────────────
  marginCausality: router({
    getFlags: publicProcedure
      .query(async () => getMarginCausalityFlags()),
  }),
  // ─── Bulk SPA Opportunity Workflow ──────────────────────────────────────────
  bulkOpportunities: router({
    list: protectedProcedure.query(async () => listBulkQuoteOpportunities()),
    getReview: protectedProcedure
      .input(z.object({ opportunityToken: z.string() }))
      .query(async ({ input }) => getBulkOpportunityReview(input.opportunityToken)),
    getItems: protectedProcedure
      .input(z.object({ opportunityToken: z.string(), reviewStatus: z.string().optional() }))
      .query(async ({ input }) => getBulkOpportunityItems(input.opportunityToken, input.reviewStatus)),
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(2),
        customerName: z.string().min(2),
        sourceFileName: z.string().optional(),
        sourceFormat: z.enum(["minimal", "spa_extract", "parts_view", "worksheet", "csv", "other"]).optional(),
        sourceSheet: z.string().optional(),
        customerId: z.number().nullable().optional(),
        customerTier: z.string().optional(),
        quoteChannel: z.enum(["OEM", "Distribution"]).optional(),
        quoteToCustomerSpec: z.boolean().optional(),
        customerSpecReference: z.string().optional(),
        sourcingPosition: z.enum(["competitive", "sole_source", "mixed", "unknown"]).optional(),
        competitors: z.array(z.string()).optional(),
        targetRevenue: z.number().nonnegative().optional(),
        targetMarginPct: z.number().min(0).max(100).optional(),
        targetWinProbability: z.number().min(0).max(100).optional(),
        recentQuoteSummary: z.string().optional(),
        recentQuoteDate: z.string().optional(),
        priorBookingValue: z.number().nonnegative().optional(),
        expectedBookingValue: z.number().nonnegative().optional(),
        bookingEvidence: z.string().optional(),
        posValidation: z.enum(["validated", "partial", "unavailable", "not_applicable"]).optional(),
        posSupporters: z.string().optional(),
        distributorMarginTargetPct: z.number().min(0).max(100).optional(),
        ittMarginTargetPct: z.number().min(0).max(100).optional(),
        costValidationNotes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => createBulkQuoteOpportunity({ ...input, createdBy: ctx.user.name ?? "Sales Rep" })),
    updateContext: protectedProcedure
      .input(z.object({
        opportunityToken: z.string(),
        name: z.string().min(2).optional(),
        customerName: z.string().min(2).optional(),
        customerId: z.number().nullable().optional(),
        customerTier: z.string().optional(),
        quoteChannel: z.enum(["OEM", "Distribution"]).optional(),
        quoteToCustomerSpec: z.boolean().optional(),
        customerSpecReference: z.string().optional(),
        sourcingPosition: z.enum(["competitive", "sole_source", "mixed", "unknown"]).optional(),
        competitors: z.array(z.string()).optional(),
        targetRevenue: z.number().nonnegative().optional(),
        targetMarginPct: z.number().min(0).max(100).optional(),
        targetWinProbability: z.number().min(0).max(100).optional(),
        recentQuoteSummary: z.string().optional(),
        recentQuoteDate: z.string().nullable().optional(),
        priorBookingValue: z.number().nonnegative().optional(),
        expectedBookingValue: z.number().nonnegative().optional(),
        bookingEvidence: z.string().optional(),
        posValidation: z.enum(["validated", "partial", "unavailable", "not_applicable"]).optional(),
        posSupporters: z.string().optional(),
        distributorMarginTargetPct: z.number().min(0).max(100).optional(),
        ittMarginTargetPct: z.number().min(0).max(100).optional(),
        costValidationNotes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { opportunityToken, ...context } = input;
        return updateBulkQuoteOpportunity(opportunityToken, context);
      }),
    importLines: protectedProcedure
      .input(z.object({
        opportunityToken: z.string(),
        lines: z.array(z.object({
          sourceRow: z.number().int().positive(),
          sourcePartNumber: z.string().nullable().optional(),
          requestedPartNumber: z.string().nullable().optional(),
          ittPartNumber: z.string().nullable().optional(),
          description: z.string().nullable().optional(),
          family: z.string().nullable().optional(),
          productLine: z.string().nullable().optional(),
          customerRevision: z.string().nullable().optional(),
          quantity: z.number().nullable().optional(),
          annualUsage: z.number().nullable().optional(),
          minimumOrderQty: z.number().nullable().optional(),
          leadTimeWeeks: z.number().nullable().optional(),
          standardCost: z.number().nullable().optional(),
          projectedCost: z.number().nullable().optional(),
          listPrice: z.number().nullable().optional(),
          currentAwardPrice: z.number().nullable().optional(),
          competitorPrice: z.number().nullable().optional(),
          currentAwardMoq: z.number().nullable().optional(),
          vendorCount: z.number().nullable().optional(),
          validationErrors: z.array(z.string()).optional(),
          sourceData: z.record(z.string(), z.union([z.string(), z.number(), z.null()])).optional(),
        })).min(1).max(500),
      }))
      .mutation(async ({ input, ctx }) => importBulkQuoteOpportunityLines(input.opportunityToken, input.lines, ctx.user.name ?? "Sales Rep")),
    priceAll: protectedProcedure
      .input(z.object({ opportunityToken: z.string() }))
      .mutation(async ({ input, ctx }) => priceBulkQuoteOpportunity(input.opportunityToken, ctx.user.name ?? "Sales Rep")),
    score: protectedProcedure
      .input(z.object({ opportunityToken: z.string() }))
      .query(async ({ input }) => calculateBulkOpportunityDealScore(input.opportunityToken)),
    applyBulkAction: protectedProcedure
      .input(z.object({
        opportunityToken: z.string(),
        itemIds: z.array(z.number().int().positive()).min(1).max(1000),
        action: z.enum(["approve_target", "set_tier", "reject"]),
        tier: z.enum(["aggressive", "target", "conservative"]).optional(),
      }))
      .mutation(async ({ input, ctx }) => applyBulkOpportunityAction({ ...input, actedBy: ctx.user.name ?? "Sales Rep" })),
    updateItemCost: protectedProcedure
      .input(z.object({
        opportunityToken: z.string(),
        itemId: z.number().int().positive(),
        projectedCost: z.number().positive(),
      }))
      .mutation(async ({ input, ctx }) => updateBulkOpportunityItemCost({ ...input, actedBy: ctx.user.name ?? "Sales Rep" })),
    getLineDetail: protectedProcedure
      .input(z.object({ opportunityToken: z.string(), itemId: z.number().int().positive() }))
      .query(async ({ input }) => getBulkOpportunityLineDetail(input.opportunityToken, input.itemId)),
    overrideTarget: protectedProcedure
      .input(z.object({
        opportunityToken: z.string(),
        itemId: z.number().int().positive(),
        proposedPrice: z.number().positive(),
        reason: z.string().min(3),
        owner: z.string().min(2),
      }))
      .mutation(async ({ input, ctx }) => overrideBulkOpportunityTarget({ ...input, actedBy: ctx.user.name ?? "Sales Rep" })),
    setException: protectedProcedure
      .input(z.object({
        opportunityToken: z.string(),
        itemId: z.number().int().positive(),
        exceptionPrice: z.number().positive(),
        exceptionReason: z.string().min(3),
        exceptionOwner: z.string().min(2),
      }))
      .mutation(async ({ input, ctx }) => setBulkOpportunityException({ ...input, actedBy: ctx.user.name ?? "Sales Rep" })),
    submitForApproval: protectedProcedure
      .input(z.object({ opportunityToken: z.string() }))
      .mutation(async ({ input, ctx }) => submitBulkOpportunityForApproval(input.opportunityToken, ctx.user.name ?? "Sales Rep")),
  }),
  // ─── Engine Pricing Rules ──────────────────────────────────────────────────────
  engineRules: router({
    getAll: publicProcedure
      .query(async () => getEngineRules()),
    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        ruleType: z.enum(["min_margin","min_markup","family_tether","competitor_tie","max_discount_segment"]),
        scope: z.enum(["global","family","channel","customerTier"]),
        scopeValue: z.string().optional(),
        paramValue: z.number(),
        competitorName: z.string().optional(),
        priority: z.number().default(100),
        active: z.boolean().default(true),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => createEngineRule({ ...input, paramValue: String(input.paramValue), updatedBy: ctx.user.name })),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        ruleType: z.enum(["min_margin","min_markup","family_tether","competitor_tie","max_discount_segment"]).optional(),
        scope: z.enum(["global","family","channel","customerTier"]).optional(),
        scopeValue: z.string().optional(),
        paramValue: z.number().optional(),
        competitorName: z.string().optional(),
        priority: z.number().optional(),
        active: z.boolean().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, paramValue, ...rest } = input;
        return updateEngineRule(id, { ...rest, ...(paramValue !== undefined ? { paramValue: String(paramValue) } : {}), updatedBy: ctx.user.name });
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => deleteEngineRule(input.id)),
    reorder: protectedProcedure
      .input(z.object({ orderedIds: z.array(z.number()) }))
      .mutation(async ({ input }) => reorderEngineRules(input.orderedIds)),
  }),
});
export type AppRouter = typeof appRouter;
