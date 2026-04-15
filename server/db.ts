import { and, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  approvalHistory,
  contentPosts,
  contentTemplates,
  platformConnections,
  publishLog,
  scheduledPosts,
  socialConnections,
  inviteCodes,
  users,
} from "../drizzle/schema";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

import { ENV } from "./_core/env";

// Type exports for insert/select operations
export type InsertApprovalHistory = InferInsertModel<typeof approvalHistory>;
export type InsertContentPost = InferInsertModel<typeof contentPosts>;
export type InsertContentTemplate = InferInsertModel<typeof contentTemplates>;
export type InsertScheduledPost = InferInsertModel<typeof scheduledPosts>;
export type InsertUser = InferInsertModel<typeof users>;
export type InsertSocialConnection = InferInsertModel<typeof socialConnections>;
export type InsertInviteCode = InferInsertModel<typeof inviteCodes>;
export type User = InferSelectModel<typeof users>;

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
      // Set session timezone to UTC after connecting
      // This ensures all TIMESTAMP columns are treated as UTC
      await _db.execute("SET SESSION time_zone = '+00:00'");
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
  } else {
    // All users are admins - everyone can publish their own content independently
    values.role = "admin";
    updateSet.role = "admin";
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date().toISOString();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date().toISOString();

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
  if (filters?.isLibraryItem !== undefined) conditions.push(eq(contentPosts.isLibraryItem, filters.isLibraryItem ? 1 : 0));

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

export async function createScheduledPost(data: InsertScheduledPost): Promise<{ id: number }> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  
  // NOTE: Frontend already converts local time to UTC before sending
  // Store the UTC timestamp as-is without any correction
  const result = await db.insert(scheduledPosts).values(data).$returningId();
  return { id: (result as any)[0]?.id || 0 };
}

export async function getScheduledPosts(userIdOrFilters?: number | { status?: string; from?: Date; to?: Date }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (typeof userIdOrFilters === 'number') {
    conditions.push(eq(scheduledPosts.scheduledById, userIdOrFilters));
  } else if (userIdOrFilters) {
    const filters = userIdOrFilters;
    if (filters.status) conditions.push(eq(scheduledPosts.status, filters.status as any));
    if (filters.from) conditions.push(gte(scheduledPosts.scheduledAt, filters.from.toISOString()));
    if (filters.to) conditions.push(lte(scheduledPosts.scheduledAt, filters.to.toISOString()));
  }

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
      isActive: (data.isActive ?? true) ? 1 : 0,
    });
  }
}

export async function disconnectPlatform(userId: number, platform: "facebook" | "instagram" | "tiktok") {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .update(platformConnections)
    .set({ isActive: 0, accessToken: null, accountId: null })
    .where(and(eq(platformConnections.userId, userId), eq(platformConnections.platform, platform)));
}

export async function getPlatformConnectionWithToken(userId: number, platform: "facebook" | "instagram" | "tiktok") {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(platformConnections)
    .where(and(eq(platformConnections.userId, userId), eq(platformConnections.platform, platform), eq(platformConnections.isActive, 1)))
    .limit(1);
  return result[0];
}

export async function getPlatformConnectionById(connectionId: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(platformConnections)
    .where(and(eq(platformConnections.id, connectionId), eq(platformConnections.userId, userId)))
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

// ─── Content Templates ────────────────────────────────────────────────────────

export async function createTemplate(data: InsertContentTemplate) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(contentTemplates).values(data);
  return result;
}

export async function getTemplatesByNiche(niche: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(contentTemplates).where(eq(contentTemplates.niche, niche as any)).orderBy(contentTemplates.category);
}

export async function getAllTemplates() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(contentTemplates).orderBy(contentTemplates.niche, contentTemplates.category);
}

export async function getDefaultTemplates() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(contentTemplates).where(eq(contentTemplates.isDefault, 1)).orderBy(contentTemplates.niche, contentTemplates.category);
}

export async function updateTemplate(id: number, data: Partial<InsertContentTemplate>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(contentTemplates).set(data).where(eq(contentTemplates.id, id));
}

export async function deleteTemplate(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(contentTemplates).where(eq(contentTemplates.id, id));
}

export async function getTemplate(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(contentTemplates).where(eq(contentTemplates.id, id)).limit(1);
  return result[0];
}


// ─── Social Connections (Per-User Credentials) ─────────────────────────────────

export async function getSocialConnections(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(socialConnections).where(eq(socialConnections.userId, userId));
}

export async function getSocialConnectionByPlatform(userId: number, platform: "facebook" | "instagram" | "tiktok") {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(socialConnections)
    .where(and(eq(socialConnections.userId, userId), eq(socialConnections.platform, platform), eq(socialConnections.isActive, 1)))
    .limit(1);
  return result[0];
}

export async function saveSocialConnection(data: InsertSocialConnection) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  
  // Check if connection already exists
  const existing = await db
    .select()
    .from(socialConnections)
    .where(and(eq(socialConnections.userId, data.userId), eq(socialConnections.platform, data.platform)))
    .limit(1);

  if (existing.length > 0) {
    // Update existing connection
    await db
      .update(socialConnections)
      .set({
        accessToken: data.accessToken,
        platformUserId: data.platformUserId,
        platformUsername: data.platformUsername,
        isActive: 1,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(socialConnections.id, existing[0].id));
  } else {
    // Insert new connection
    await db.insert(socialConnections).values(data);
  }
}

export async function deleteSocialConnection(userId: number, platform: "facebook" | "instagram" | "tiktok") {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .delete(socialConnections)
    .where(and(eq(socialConnections.userId, userId), eq(socialConnections.platform, platform)));
}


// ─── Invite Codes ─────────────────────────────────────────────────────────────

export async function generateInviteCode(createdBy: number): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  
  // Generate a random 8-character code
  const code = Math.random().toString(36).substring(2, 10).toUpperCase();
  
  await db.insert(inviteCodes).values({
    code,
    createdBy,
        isActive: 1,
      });
  
  return code;
}

export async function listInviteCodes(createdBy: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  
  return db
    .select()
    .from(inviteCodes)
    .where(eq(inviteCodes.createdBy, createdBy))
    .orderBy(desc(inviteCodes.createdAt));
}

export async function validateInviteCode(code: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  
  const result = await db
    .select()
    .from(inviteCodes)
    .where(
      and(
        eq(inviteCodes.code, code),
        eq(inviteCodes.isActive, 1)
      )
    )
    .limit(1);
  
  return result[0] || null;
}

export async function markInviteCodeAsUsed(code: string, usedBy: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  
  await db
    .update(inviteCodes)
    .set({
      usedBy,
      usedAt: new Date().toISOString(),
    })
    .where(eq(inviteCodes.code, code));
}

export async function revokeInviteCode(code: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  
  await db
    .update(inviteCodes)
    .set({ isActive: 0 })
    .where(eq(inviteCodes.code, code));
}

/**
 * Get scheduled posts ready to publish (status = 'scheduled' and scheduledAt <= now)
 */
export async function getScheduledPostsReadyToPublish() {
  const db = await getDb();
  if (!db) return [];
  const now = new Date().toISOString();
  return db
    .select()
    .from(scheduledPosts)
    .where(
      and(
        eq(scheduledPosts.status, 'scheduled' as any),
        lte(scheduledPosts.scheduledAt, now)
      )
    )
    .orderBy(scheduledPosts.scheduledAt);
}

/**
 * Claim a scheduled post for publishing (atomic operation)
 * Returns the post if successfully claimed, null if already claimed
 */
export async function claimScheduledPost(postId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  
  // Update status to 'publishing' atomically
  const result = await db
    .update(scheduledPosts)
    .set({ status: 'publishing' as any, updatedAt: new Date().toISOString() })
    .where(and(
      eq(scheduledPosts.id, postId),
      eq(scheduledPosts.status, 'scheduled' as any)
    ));
  
  // If no rows were updated, the post was already claimed
  if ((result as any).rowsAffected === 0) return null;
  
  // Fetch and return the claimed post
  const posts = await db
    .select()
    .from(scheduledPosts)
    .where(eq(scheduledPosts.id, postId))
    .limit(1);
  
  return posts[0] || null;
}

/**
 * Get connection with credentials for publishing
 */
export async function getConnectionWithCredentials(connectionId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(platformConnections)
    .where(eq(platformConnections.id, connectionId))
    .limit(1);
  return result[0];
}
