import { and, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  approvalHistory,
  contentPosts,
  InsertApprovalHistory,
  InsertContentPost,
  InsertScheduledPost,
  InsertUser,
  platformConnections,
  publishLog,
  scheduledPosts,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

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

// ─── Users ────────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    const value = user[field];
    if (value === undefined) continue;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  }

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt));
}

export async function updateUserRole(userId: number, role: "user" | "admin") {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

// ─── Content Posts ─────────────────────────────────────────────────────────────

export async function createContentPost(data: InsertContentPost) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(contentPosts).values(data).$returningId();
  return result;
}

export async function getContentPostById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(contentPosts).where(eq(contentPosts.id, id)).limit(1);
  return result[0];
}

export async function getContentPostsByAuthor(authorId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(contentPosts).where(eq(contentPosts.authorId, authorId)).orderBy(desc(contentPosts.createdAt));
}

export async function getAllContentPosts(filters?: {
  status?: string;
  niche?: string;
  platform?: string;
  isLibraryItem?: boolean;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (filters?.status) conditions.push(eq(contentPosts.status, filters.status as any));
  if (filters?.niche) conditions.push(eq(contentPosts.niche, filters.niche as any));
  if (filters?.platform) conditions.push(eq(contentPosts.platform, filters.platform as any));
  if (filters?.isLibraryItem !== undefined) conditions.push(eq(contentPosts.isLibraryItem, filters.isLibraryItem));

  const query = db.select().from(contentPosts);
  if (conditions.length > 0) {
    return query.where(and(...conditions)).orderBy(desc(contentPosts.createdAt));
  }
  return query.orderBy(desc(contentPosts.createdAt));
}

export async function updateContentPost(id: number, data: Partial<InsertContentPost>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(contentPosts).set(data).where(eq(contentPosts.id, id));
}

export async function deleteContentPost(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(contentPosts).where(eq(contentPosts.id, id));
}

// ─── Approval History ──────────────────────────────────────────────────────────

export async function addApprovalHistory(data: InsertApprovalHistory) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(approvalHistory).values(data);
}

export async function getApprovalHistoryByPost(postId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(approvalHistory).where(eq(approvalHistory.postId, postId)).orderBy(desc(approvalHistory.createdAt));
}

// ─── Scheduled Posts ───────────────────────────────────────────────────────────

export async function createScheduledPost(data: InsertScheduledPost) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(scheduledPosts).values(data).$returningId();
  return result;
}

export async function getScheduledPosts(filters?: { status?: string; from?: Date; to?: Date }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.status) conditions.push(eq(scheduledPosts.status, filters.status as any));
  if (filters?.from) conditions.push(gte(scheduledPosts.scheduledAt, filters.from));
  if (filters?.to) conditions.push(lte(scheduledPosts.scheduledAt, filters.to));

  const query = db.select().from(scheduledPosts);
  if (conditions.length > 0) {
    return query.where(and(...conditions)).orderBy(scheduledPosts.scheduledAt);
  }
  return query.orderBy(scheduledPosts.scheduledAt);
}

export async function updateScheduledPost(id: number, data: Partial<InsertScheduledPost>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(scheduledPosts).set(data).where(eq(scheduledPosts.id, id));
}

export async function deleteScheduledPost(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(scheduledPosts).where(eq(scheduledPosts.id, id));
}

// ─── Platform Connections ──────────────────────────────────────────────────────

export async function getPlatformConnections(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(platformConnections).where(eq(platformConnections.userId, userId));
}

export async function upsertPlatformConnection(data: {
  userId: number;
  platform: "facebook" | "instagram" | "tiktok";
  accountName?: string;
  accountId?: string;
  accessToken?: string;
  pageId?: string;
  isActive?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const existing = await db
    .select()
    .from(platformConnections)
    .where(and(eq(platformConnections.userId, data.userId), eq(platformConnections.platform, data.platform)))
    .limit(1);

  const updateData: Record<string, unknown> = {
    accountName: data.accountName,
    accountId: data.accountId,
    isActive: data.isActive ?? true,
  };
  if (data.accessToken !== undefined) updateData.accessToken = data.accessToken;
  if (data.pageId !== undefined) updateData.accountId = data.pageId; // reuse accountId for pageId

  if (existing.length > 0) {
    await db
      .update(platformConnections)
      .set(updateData)
      .where(eq(platformConnections.id, existing[0].id));
  } else {
    await db.insert(platformConnections).values({
      userId: data.userId,
      platform: data.platform,
      accountName: data.accountName,
      accountId: data.pageId ?? data.accountId,
      accessToken: data.accessToken,
      isActive: data.isActive ?? true,
    });
  }
}

export async function disconnectPlatform(userId: number, platform: "facebook" | "instagram" | "tiktok") {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .update(platformConnections)
    .set({ isActive: false, accessToken: null, accountId: null })
    .where(and(eq(platformConnections.userId, userId), eq(platformConnections.platform, platform)));
}

export async function getPlatformConnectionWithToken(userId: number, platform: "facebook" | "instagram" | "tiktok") {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(platformConnections)
    .where(and(eq(platformConnections.userId, userId), eq(platformConnections.platform, platform), eq(platformConnections.isActive, true)))
    .limit(1);
  return result[0];
}

// ─── Publish Log ───────────────────────────────────────────────────────────────

export async function addPublishLog(data: {
  postId: number;
  publishedById: number;
  platform: "facebook" | "instagram" | "tiktok";
  status: "success" | "failed";
  platformPostId?: string;
  errorMessage?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(publishLog).values(data);
}

export async function getPublishLog(postId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (postId) {
    return db.select().from(publishLog).where(eq(publishLog.postId, postId)).orderBy(desc(publishLog.publishedAt));
  }
  return db.select().from(publishLog).orderBy(desc(publishLog.publishedAt)).limit(100);
}

// ─── Analytics ─────────────────────────────────────────────────────────────────

export async function getAnalyticsSummary() {
  const db = await getDb();
  if (!db) return null;

  const [totalPosts] = await db.select({ count: sql<number>`count(*)` }).from(contentPosts);
  const [pendingPosts] = await db.select({ count: sql<number>`count(*)` }).from(contentPosts).where(eq(contentPosts.status, "pending_review"));
  const [approvedPosts] = await db.select({ count: sql<number>`count(*)` }).from(contentPosts).where(eq(contentPosts.status, "approved"));
  const [publishedPosts] = await db.select({ count: sql<number>`count(*)` }).from(contentPosts).where(eq(contentPosts.status, "published"));
  const [totalMembers] = await db.select({ count: sql<number>`count(*)` }).from(users);

  const platformBreakdown = await db
    .select({ platform: contentPosts.platform, count: sql<number>`count(*)` })
    .from(contentPosts)
    .groupBy(contentPosts.platform);

  const nicheBreakdown = await db
    .select({ niche: contentPosts.niche, count: sql<number>`count(*)` })
    .from(contentPosts)
    .groupBy(contentPosts.niche);

  const recentActivity = await db
    .select()
    .from(contentPosts)
    .orderBy(desc(contentPosts.updatedAt))
    .limit(10);

  return {
    totalPosts: Number(totalPosts?.count ?? 0),
    pendingPosts: Number(pendingPosts?.count ?? 0),
    approvedPosts: Number(approvedPosts?.count ?? 0),
    publishedPosts: Number(publishedPosts?.count ?? 0),
    totalMembers: Number(totalMembers?.count ?? 0),
    platformBreakdown,
    nicheBreakdown,
    recentActivity,
  };
}
