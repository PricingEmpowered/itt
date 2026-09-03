import { describe, expect, it } from "vitest";
import { assemblePartNumber, decodePartNumber, FAMILY_ATTRIBUTES, FAMILIES } from "../shared/connectorData";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Part Number Assembly Tests ───────────────────────────────────────────────

describe("assemblePartNumber", () => {
  it("assembles 38999/KJB part number correctly", () => {
    const pn = assemblePartNumber({
      family: "38999",
      material: "7",
      style: "T",
      size: "17",
      insert: "35",
      contact: "P",
    });
    // KJB[Material][Style][Size][ServiceClass][Insert][Contact]
    expect(pn).toBe("KJB7T17F35P");
  });

  it("assembles KPT part number with dash separator", () => {
    const pn = assemblePartNumber({
      family: "KPT",
      style: "06",
      material: "F",
      size: "14",
      insert: "19",
      contact: "P",
    });
    expect(pn).toBe("KPT06F14-19P");
  });

  it("assembles CIR part number with dash separator", () => {
    const pn = assemblePartNumber({
      family: "CIR",
      style: "06",
      material: "GA",
      size: "24",
      insert: "11",
      contact: "P",
    });
    expect(pn).toBe("CIR06GA24-11P");
  });

  it("assembles MS part number correctly", () => {
    const pn = assemblePartNumber({
      family: "MS",
      style: "3106",
      material: "F",
      size: "18",
      insert: "1",
      contact: "S",
    });
    expect(pn).toBe("MS3106F18-1S");
  });

  it("assembles CA part number correctly", () => {
    const pn = assemblePartNumber({
      family: "CA",
      style: "3106",
      material: "F",
      size: "14",
      insert: "19",
      contact: "P",
    });
    expect(pn).toBe("CA3106F14-19P");
  });

  it("assembles DPX part number with dash separator", () => {
    const pn = assemblePartNumber({
      family: "DPX",
      style: "2MA",
      size: "67",
      contact: "P",
    });
    expect(pn).toBe("DPX2MA-67P");
  });

  it("assembles DBM part number correctly", () => {
    const pn = assemblePartNumber({
      family: "DBM",
      style: "DBM",
      size: "25",
      contact: "P",
    });
    expect(pn).toBe("DBM25P");
  });

  it("handles empty selections gracefully", () => {
    const pn = assemblePartNumber({ family: "38999" });
    // Should return at least the prefix
    expect(pn).toContain("KJB");
  });

  it("includes suffix when provided", () => {
    const pn = assemblePartNumber({
      family: "38999",
      material: "7",
      style: "T",
      size: "17",
      insert: "35",
      contact: "P",
      suffix: "F80",
    });
    expect(pn).toContain("F80");
  });

  it("assembles MKJ fiber optic part number", () => {
    const pn = assemblePartNumber({ family: "MKJ", style: "3A" });
    expect(pn).toBe("MKJ3A");
  });
});

// ─── Attribute Data Tests ─────────────────────────────────────────────────────

describe("FAMILY_ATTRIBUTES", () => {
  it("has attributes for all 14 families", () => {
    const familyIds = FAMILIES.map((f) => f.id);
    for (const id of familyIds) {
      expect(FAMILY_ATTRIBUTES[id], `Missing attributes for family ${id}`).toBeDefined();
    }
  });

  it("38999 has at least 5 shell styles", () => {
    expect(FAMILY_ATTRIBUTES["38999"].styles.length).toBeGreaterThanOrEqual(5);
  });

  it("38999 has at least 4 shell sizes", () => {
    expect(FAMILY_ATTRIBUTES["38999"].sizes.length).toBeGreaterThanOrEqual(4);
  });

  it("CIR has pin and socket contact options", () => {
    const contacts = FAMILY_ATTRIBUTES["CIR"].contacts.map((c) => c.value);
    expect(contacts).toContain("P");
    expect(contacts).toContain("S");
  });

  it("DPX has no material options (rack & panel)", () => {
    expect(FAMILY_ATTRIBUTES["DPX"].materials.length).toBe(0);
  });

  it("all attribute options have non-empty labels", () => {
    for (const [family, attrs] of Object.entries(FAMILY_ATTRIBUTES)) {
      for (const opt of [...attrs.styles, ...attrs.materials, ...attrs.contacts, ...attrs.sizes]) {
        expect(opt.label, `Empty label in ${family}`).toBeTruthy();
      }
    }
  });
});

// ─── Decode Tests ─────────────────────────────────────────────────────────────

describe("decodePartNumber", () => {
  it("decodes 38999 part number into components", () => {
    const decoded = decodePartNumber("38999", "KJB7T17F35P");
    expect(decoded["Series Prefix"]).toContain("KJB");
    expect(decoded["Shell Material"]).toBe("7");
    expect(decoded["Shell Style"]).toBe("T");
    expect(decoded["Shell Size"]).toBe("17");
  });

  it("decodes KPT part number", () => {
    const decoded = decodePartNumber("KPT", "KPT06F14-19P");
    expect(decoded["Series Prefix"]).toContain("KPT");
  });

  it("returns empty object for unknown families", () => {
    const decoded = decodePartNumber("UNKNOWN", "TEST123");
    // Unknown families return an empty object (no decode rules available)
    expect(typeof decoded).toBe("object");
  });
});

// ─── tRPC Router Tests ────────────────────────────────────────────────────────

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "admin-user",
      email: "admin@example.com",
      name: "Admin User",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

describe("configurator.getFamilies", () => {
  it("returns all 14 connector families", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const families = await caller.configurator.getFamilies();
    expect(families.length).toBe(14);
  });

  it("includes 38999 family", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const families = await caller.configurator.getFamilies();
    expect(families.some((f) => f.id === "38999")).toBe(true);
  });
});

describe("configurator.getAttributes", () => {
  it("returns attributes for 38999 family", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const attrs = await caller.configurator.getAttributes({ family: "38999" });
    expect(attrs.styles.length).toBeGreaterThan(0);
    expect(attrs.sizes.length).toBeGreaterThan(0);
  });

  it("throws NOT_FOUND for unknown family", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.configurator.getAttributes({ family: "UNKNOWN_FAMILY_XYZ" })
    ).rejects.toThrow();
  });
});

describe("admin procedures", () => {
  it("rejects non-admin users from getPricingRules", async () => {
    const ctx: TrpcContext = {
      user: {
        id: 2,
        openId: "regular-user",
        email: "user@example.com",
        name: "Regular User",
        loginMethod: "manus",
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    await expect(caller.admin.getPricingRules({})).rejects.toThrow("Admin access required");
  });

  it("rejects unauthenticated users from admin procedures", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.admin.getPricingRules({})).rejects.toThrow();
  });
});

describe("auth.logout", () => {
  it("clears session cookie and returns success", async () => {
    const clearedCookies: Array<{ name: string; options: Record<string, unknown> }> = [];
    const ctx: TrpcContext = {
      user: {
        id: 1,
        openId: "test-user",
        email: "test@example.com",
        name: "Test User",
        loginMethod: "manus",
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {
        clearCookie: (name: string, options: Record<string, unknown>) => {
          clearedCookies.push({ name, options });
        },
      } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
  });
});
