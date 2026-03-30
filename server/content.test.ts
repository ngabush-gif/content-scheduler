import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): { ctx: TrpcContext; clearedCookies: any[] } {
  const clearedCookies: any[] = [];
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: any) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };
  return { ctx, clearedCookies };
}

function createMemberContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "member-user",
    email: "member@example.com",
    name: "Team Member",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
  return { ctx };
}

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
  });
});

describe("auth.me", () => {
  it("returns the authenticated user", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const user = await caller.auth.me();
    expect(user?.role).toBe("admin");
    expect(user?.email).toBe("admin@example.com");
  });

  it("returns null for unauthenticated context", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const user = await caller.auth.me();
    expect(user).toBeNull();
  });
});

describe("team.updateRole - admin guard", () => {
  it("throws FORBIDDEN for non-admin users", async () => {
    const { ctx } = createMemberContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.team.updateRole({ userId: 1, role: "admin" })
    ).rejects.toThrow();
  });
});

describe("approval - admin guard", () => {
  it("throws FORBIDDEN when non-admin tries to approve", async () => {
    const { ctx } = createMemberContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.approval.approve({ id: 999 })
    ).rejects.toThrow();
  });

  it("throws FORBIDDEN when non-admin tries to reject", async () => {
    const { ctx } = createMemberContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.approval.reject({ id: 999, note: "test" })
    ).rejects.toThrow();
  });
});

describe("shared/niches", () => {
  it("exports 7 niches", async () => {
    const { NICHES } = await import("../shared/niches");
    expect(NICHES).toHaveLength(7);
  });

  it("exports 3 platforms", async () => {
    const { PLATFORMS } = await import("../shared/niches");
    expect(PLATFORMS).toHaveLength(3);
  });

  it("exports 5 content types", async () => {
    const { CONTENT_TYPES } = await import("../shared/niches");
    expect(CONTENT_TYPES).toHaveLength(5);
  });

  it("all niches have required fields", async () => {
    const { NICHES } = await import("../shared/niches");
    for (const niche of NICHES) {
      expect(niche.id).toBeTruthy();
      expect(niche.label).toBeTruthy();
      expect(niche.emoji).toBeTruthy();
      expect(niche.tone).toBeTruthy();
      expect(niche.promptHint).toBeTruthy();
    }
  });

  it("STATUS_CONFIG has all required statuses", async () => {
    const { STATUS_CONFIG } = await import("../shared/niches");
    expect(STATUS_CONFIG).toHaveProperty("draft");
    expect(STATUS_CONFIG).toHaveProperty("pending_review");
    expect(STATUS_CONFIG).toHaveProperty("approved");
    expect(STATUS_CONFIG).toHaveProperty("rejected");
    expect(STATUS_CONFIG).toHaveProperty("published");
  });
});
