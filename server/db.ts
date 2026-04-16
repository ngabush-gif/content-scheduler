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

  console.log("[upsertUser] Starting upsert with openId:", user.openId);
  console.log("[upsertUser] User data:", JSON.stringify(user, null, 2));


  // No existing user found by email, proceed with normal upsert by openId
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

  console.log("[upsertUser] Final insert values:", JSON.stringify(values, null, 2));
  console.log("[upsertUser] Final update set:", JSON.stringify(updateSet, null, 2));

  // Explicitly exclude id field - it should be auto-generated
  const { id, ...valuesWithoutId } = values as any;
  console.log("[upsertUser] Values without id:", JSON.stringify(valuesWithoutId, null, 2));

  try {
    await db.insert(users).values(valuesWithoutId).onDuplicateKeyUpdate({ set: updateSet });
    console.log("[upsertUser] Upsert successful for openId:", user.openId);
  } catch (error) {
    console.error("[upsertUser] Upsert failed for openId:", user.openId);
    console.error("[upsertUser] Error:", error);
    console.error("[upsertUser] Error message:", error instanceof Error ? error.message : String(error));
    console.error("[upsertUser] Error stack:", error instanceof Error ? error.stack : "no stack");
    throw error;
  }
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
  
  // Build clean insert payload - only include fields that should be inserted
  const insertPayload: any = {
    authorId: data.authorId,
    title: data.title,
    niche: data.niche,
    platform: data.platform,
    contentType: data.contentType,
    status: data.status || 'draft',
  };
  
  // Add optional fields only if they're defined
  if (data.caption !== undefined) insertPayload.caption = data.caption;
  if (data.hashtags !== undefined) insertPayload.hashtags = data.hashtags;
  if (data.imagePrompt !== undefined) insertPayload.imagePrompt = data.imagePrompt;
  if (data.script !== undefined) insertPayload.script = data.script;
  if (data.ideas !== undefined) insertPayload.ideas = data.ideas;
  if (data.fullContent !== undefined) insertPayload.fullContent = data.fullContent;
  if (data.tone !== undefined) insertPayload.tone = data.tone;
  if (data.tags !== undefined) insertPayload.tags = data.tags;
  if (data.imageUrl !== undefined) insertPayload.imageUrl = data.imageUrl;
  if (data.aiGeneratedImage !== undefined) insertPayload.aiGeneratedImage = data.aiGeneratedImage;
  if (data.mediaType !== undefined) insertPayload.mediaType = data.mediaType;
  if (data.contentStyle !== undefined) insertPayload.contentStyle = data.contentStyle;
  
  console.log('[createContentPost] INSERT PAYLOAD:', JSON.stringify(insertPayload, null, 2));
  
  try {
    // Use Drizzle's sql tagged template for raw SQL execution
    const fieldList = Object.keys(insertPayload);
    let valueList = Object.values(insertPayload);
    
    // Serialize hashtags array to JSON string for database storage
    valueList = valueList.map((val, idx) => {
      const field = fieldList[idx];
      if (field === 'hashtags' && Array.isArray(val)) {
        return JSON.stringify(val);
      }
      return val;
    });
    
    // Create the insert query using raw SQL with placeholders
    const insertQuery = `INSERT INTO \`content_posts\` (${fieldList.map(f => `\`${f}\``).join(', ')}) VALUES (${fieldList.map(() => '?').join(', ')})`;
    console.log('[createContentPost] FINAL INSERT QUERY:', insertQuery);
    console.log('[createContentPost] FINAL VALUES (serialized):', valueList);
    
    // Execute using Drizzle's execute method with raw SQL
    // Note: We need to use the connection pool directly for parameterized queries
    // Get the underlying connection from the drizzle instance
    const connection = (db as any).session.client;
    const [result] = await connection.execute(insertQuery, valueList);
    console.log('[createContentPost] INSERT RESULT:', result);
    console.log('[createContentPost] INSERT QUERY EXECUTED');
    
    // Query the inserted row
    const rows = await db.select().from(contentPosts)
      .where(eq(contentPosts.authorId, insertPayload.authorId))
      .orderBy(desc(contentPosts.createdAt))
      .limit(1);
    
    console.log('[createContentPost] INSERT SUCCESS - Returned row id:', rows[0]?.id);
    console.log('[createContentPost] FULL ROW:', JSON.stringify(rows[0], null, 2));
    return rows[0];
  } catch (error) {
    console.error('[createContentPost] INSERT FAILED - Error:', error);
    throw error;
  }
}

// Helper function to deserialize content post hashtags from JSON string to array
// Handles both new JSON format and legacy space-separated format
function deserializeContentPost(post: any) {
  if (!post) return post;
  if (typeof post.hashtags === 'string') {
    try {
      // Try parsing as JSON first (new format)
      post.hashtags = JSON.parse(post.hashtags);
    } catch (e) {
      // If JSON parse fails, assume it's space-separated (legacy format)
      // Split by spaces and filter out empty strings
      const tags = post.hashtags.trim().split(/\s+/).filter((tag: string) => tag.length > 0);
      post.hashtags = tags;
    }
  }
  return post;
}

export async function getContentPostById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(contentPosts).where(eq(contentPosts.id, id)).limit(1);
  return deserializeContentPost(result[0]);
}

export async function getContentPostsByAuthor(authorId: number) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select().from(contentPosts).where(eq(contentPosts.authorId, authorId)).orderBy(desc(contentPosts.createdAt));
  return result.map(deserializeContentPost);
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
  let result;
  if (conditions.length > 0) {
    result = await query.where(and(...conditions)).orderBy(desc(contentPosts.createdAt));
  } else {
    result = await query.orderBy(desc(contentPosts.createdAt));
  }
  return result.map(deserializeContentPost);
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

export async function getScheduledPostsByAuthor(authorId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(scheduledPosts).where(eq(scheduledPosts.authorId, authorId)).orderBy(desc(scheduledPosts.scheduledAt));
}

export async function getScheduledPostById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(scheduledPosts).where(eq(scheduledPosts.id, id)).limit(1);
  return result[0];
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

// Get posts scheduled for publishing within a time range
export async function getScheduledPostsForPublishing(now: Date, futureMinutes: number = 5) {
  const db = await getDb();
  if (!db) return [];
  
  const futureTime = new Date(now.getTime() + futureMinutes * 60 * 1000);
  return db.select().from(scheduledPosts)
    .where(
      and(
        gte(scheduledPosts.scheduledAt, now.toISOString()),
        lte(scheduledPosts.scheduledAt, futureTime.toISOString()),
        eq(scheduledPosts.status, 'scheduled')
      )
    )
    .orderBy(scheduledPosts.scheduledAt);
}

// ─── Platform Connections ─────────────────────────────────────────────────────

export async function createPlatformConnection(data: any) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(platformConnections).values(data).$returningId();
  return { id: (result as any)[0]?.id || 0 };
}

export async function getPlatformConnectionsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(platformConnections).where(eq(platformConnections.userId, userId));
}

export async function getPlatformConnectionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(platformConnections).where(eq(platformConnections.id, id)).limit(1);
  return result[0];
}

export async function updatePlatformConnection(id: number, data: any) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(platformConnections).set(data).where(eq(platformConnections.id, id));
}

export async function deletePlatformConnection(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(platformConnections).where(eq(platformConnections.id, id));
}

// ─── Publish Log ──────────────────────────────────────────────────────────────

export async function addPublishLog(data: any) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(publishLog).values(data);
}

export async function getPublishLogByPostId(postId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(publishLog).where(eq(publishLog.postId, postId)).orderBy(desc(publishLog.publishedAt));
}

// ─── Content Templates ────────────────────────────────────────────────────────

export async function createContentTemplate(data: InsertContentTemplate) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(contentTemplates).values(data).$returningId();
  return { id: (result as any)[0]?.id || 0 };
}

export async function getContentTemplatesByCreator(createdById: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(contentTemplates).where(eq(contentTemplates.createdById, createdById)).orderBy(desc(contentTemplates.createdAt));
}

export async function getDefaultContentTemplates() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(contentTemplates).where(eq(contentTemplates.isDefault, 1)).orderBy(desc(contentTemplates.createdAt));
}

export async function deleteContentTemplate(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(contentTemplates).where(eq(contentTemplates.id, id));
}

// ─── Invite Codes ─────────────────────────────────────────────────────────────

export async function createInviteCode(data: InsertInviteCode) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(inviteCodes).values(data).$returningId();
  return { id: (result as any)[0]?.id || 0 };
}

export async function getInviteCodeByCode(code: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(inviteCodes).where(eq(inviteCodes.code, code)).limit(1);
  return result[0];
}

export async function markInviteCodeAsUsed(codeId: number, usedBy: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(inviteCodes).set({ usedBy, usedAt: new Date().toISOString() }).where(eq(inviteCodes.id, codeId));
}


// Alias for backward compatibility
export async function getScheduledPosts(authorId: number) {
  return getScheduledPostsByAuthor(authorId);
}

export async function getConnectionWithCredentials(connectionId: number) {
  return getPlatformConnectionById(connectionId);
}

export async function getPlatformConnectionWithToken(userId: number, platform: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(platformConnections)
    .where(and(eq(platformConnections.userId, userId), eq(platformConnections.platform, platform as any)))
    .limit(1);
  return result[0];
}
