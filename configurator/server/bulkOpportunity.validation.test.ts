import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createAuthContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "bulk-opportunity-test-user",
      email: "sales@example.com",
      name: "Sales Test",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("bulkOpportunities input validation", () => {
  it("requires at least one imported line", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    await expect(caller.bulkOpportunities.importLines({
      opportunityToken: "SPA-TEST",
      lines: [],
    })).rejects.toMatchObject<Partial<TRPCError>>({ code: "BAD_REQUEST" });
  });

  it("requires a positive exception price and a business justification", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    await expect(caller.bulkOpportunities.setException({
      opportunityToken: "SPA-TEST",
      itemId: 1,
      exceptionPrice: 0,
      exceptionReason: "x",
      exceptionOwner: "Sales Test",
    })).rejects.toMatchObject<Partial<TRPCError>>({ code: "BAD_REQUEST" });
  });

  it("limits a batch price decision to a non-empty set of valid item identifiers", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    await expect(caller.bulkOpportunities.applyBulkAction({
      opportunityToken: "SPA-TEST",
      itemIds: [],
      action: "approve_target",
    })).rejects.toMatchObject<Partial<TRPCError>>({ code: "BAD_REQUEST" });
  });

  it("requires a positive governed target override with a rationale and owner", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    await expect(caller.bulkOpportunities.overrideTarget({
      opportunityToken: "SPA-TEST",
      itemId: 1,
      proposedPrice: 0,
      reason: "x",
      owner: "S",
    })).rejects.toMatchObject<Partial<TRPCError>>({ code: "BAD_REQUEST" });
  });
});
