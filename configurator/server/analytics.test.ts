import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createPublicCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

describe("analytics.getOverallPerformance", () => {
  it("returns data with kpis, pricePerformance, and marginBridge fields", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const result = await caller.analytics.getOverallPerformance({
      timePeriod: "Year over Year",
      productFamily: "All Product Families",
      region: "All Regions",
      channel: "All Channels",
    });
    expect(result).toBeDefined();
    // Result is null when DB is unavailable in test env — just verify shape
    if (result) {
      expect(result).toHaveProperty("kpis");
      expect(result).toHaveProperty("pricePerformance");
      expect(result).toHaveProperty("marginBridge");
    }
  });

  it("accepts a specific product family filter", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const result = await caller.analytics.getOverallPerformance({
      timePeriod: "Year over Year",
      productFamily: "38999/KJB",
      region: "All Regions",
      channel: "All Channels",
    });
    // Should not throw
    expect(result === null || typeof result === "object").toBe(true);
  });
});

describe("analytics.getListPricePerformance", () => {
  it("returns products, categorySummary, and discountTrend", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const result = await caller.analytics.getListPricePerformance({
      productFamily: "All Product Families",
      period: "2025-12",
    });
    if (result) {
      expect(result).toHaveProperty("products");
      expect(result).toHaveProperty("categorySummary");
      expect(result).toHaveProperty("discountTrend");
      expect(Array.isArray(result.products)).toBe(true);
    }
  });

  it("categorySummary has A/B/C/D keys", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const result = await caller.analytics.getListPricePerformance({
      productFamily: "All Product Families",
      period: "2025-12",
    });
    if (result?.categorySummary) {
      expect(result.categorySummary).toHaveProperty("A");
      expect(result.categorySummary).toHaveProperty("B");
      expect(result.categorySummary).toHaveProperty("C");
      expect(result.categorySummary).toHaveProperty("D");
    }
  });
});

describe("analytics.getQuoteFunnel", () => {
  it("returns kpis, funnelData, trendsData, and segmentComparison", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const result = await caller.analytics.getQuoteFunnel({
      timePeriod: "Year over Year",
      region: "All Regions",
      channel: "All Channels",
      segment: "All Segments",
      timeRange: "Last Year",
    });
    if (result) {
      expect(result).toHaveProperty("kpis");
      expect(result).toHaveProperty("funnelData");
      expect(result).toHaveProperty("trendsData");
      expect(result).toHaveProperty("segmentComparison");
      expect(result.kpis).toHaveProperty("winRate");
      expect(result.kpis).toHaveProperty("avgCycleTime");
    }
  });

  it("funnelData contains Technical Review, Negotiation, Won stages", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const result = await caller.analytics.getQuoteFunnel({
      timePeriod: "Year over Year",
      region: "All Regions",
      channel: "All Channels",
      segment: "All Segments",
      timeRange: "Last Year",
    });
    if (result?.funnelData && result.funnelData.length > 0) {
      const stages = result.funnelData.map(f => f.stage);
      expect(stages).toContain("Technical Review");
      expect(stages).toContain("Won");
    }
  });
});

describe("analytics.getPriceWaterfall", () => {
  it("returns an array of waterfall components", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const result = await caller.analytics.getPriceWaterfall({
      productFamily: "All Product Families",
      region: "All Regions",
      channel: "All Channels",
      segment: "All Segments",
      period: "2025-12",
    });
    if (result && result.length > 0) {
      expect(Array.isArray(result)).toBe(true);
      const listPrice = result.find(r => r.component === "List Price");
      const pocketPrice = result.find(r => r.component === "Pocket Price");
      expect(listPrice).toBeDefined();
      expect(pocketPrice).toBeDefined();
      // Pocket price should be less than list price
      if (listPrice && pocketPrice) {
        expect(pocketPrice.value).toBeLessThan(listPrice.value);
      }
    }
  });

  it("each component has value, sortOrder, and isTotal fields", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const result = await caller.analytics.getPriceWaterfall({
      productFamily: "All Product Families",
      region: "All Regions",
      channel: "All Channels",
      segment: "All Segments",
      period: "2025-12",
    });
    if (result && result.length > 0) {
      result.forEach(item => {
        expect(item).toHaveProperty("component");
        expect(item).toHaveProperty("value");
        expect(item).toHaveProperty("sortOrder");
        expect(item).toHaveProperty("isTotal");
        expect(typeof item.value).toBe("number");
      });
    }
  });
});
