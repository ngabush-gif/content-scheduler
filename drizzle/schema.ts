import {
  boolean,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  avatarUrl: text("avatarUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Content Posts ─────────────────────────────────────────────────────────────
export const contentPosts = mysqlTable("content_posts", {
  id: int("id").autoincrement().primaryKey(),
  authorId: int("authorId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  niche: mysqlEnum("niche", [
    "time_freedom",
    "parents",
    "side_hustlers",
    "online_business",
    "cultural",
    "over_50",
    "scam_survivors",
  ]).notNull(),
  platform: mysqlEnum("platform", ["facebook", "instagram", "tiktok", "all"]).notNull(),
  contentType: mysqlEnum("contentType", ["caption", "script", "hashtags", "ideas", "full_post"]).notNull(),
  caption: text("caption"),
  hashtags: text("hashtags"),
  script: text("script"),
  ideas: text("ideas"),
  fullContent: text("fullContent"),
  imageUrl: text("imageUrl"), // URL to uploaded or AI-generated image
  tone: varchar("tone", { length: 100 }),
  status: mysqlEnum("status", ["draft", "pending_review", "approved", "rejected", "published"]).default("draft").notNull(),
  rejectionNote: text("rejectionNote"),
  approvedById: int("approvedById"),
  approvedAt: timestamp("approvedAt"),
  publishedAt: timestamp("publishedAt"),
  scheduledAt: timestamp("scheduledAt"),
  isLibraryItem: boolean("isLibraryItem").default(false).notNull(),
  aiGeneratedImage: boolean("aiGeneratedImage").default(false).notNull(), // Track if image was AI-generated
  tags: text("tags"), // JSON array of strings
  mediaType: mysqlEnum("mediaType", ["none", "image", "video"]).default("none").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ContentPost = typeof contentPosts.$inferSelect;
export type InsertContentPost = typeof contentPosts.$inferInsert;

// ─── Media Uploads ────────────────────────────────────────────────────────────
export const mediaUploads = mysqlTable("media_uploads", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  fileUrl: text("fileUrl").notNull(),
  fileType: mysqlEnum("fileType", ["image", "video"]).notNull(),
  fileName: varchar("fileName", { length: 255 }),
  fileSize: int("fileSize"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MediaUpload = typeof mediaUploads.$inferSelect;
export type InsertMediaUpload = typeof mediaUploads.$inferInsert;

// ─── Approval History ──────────────────────────────────────────────────────────
export const approvalHistory = mysqlTable("approval_history", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("postId").notNull(),
  reviewerId: int("reviewerId").notNull(),
  action: mysqlEnum("action", ["submitted", "approved", "rejected", "revision_requested", "resubmitted"]).notNull(),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ApprovalHistory = typeof approvalHistory.$inferSelect;
export type InsertApprovalHistory = typeof approvalHistory.$inferInsert;

// ─── Scheduled Posts ───────────────────────────────────────────────────────────
export const scheduledPosts = mysqlTable("scheduled_posts", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("postId").notNull(),
  scheduledById: int("scheduledById").notNull(),
  platform: mysqlEnum("platform", ["facebook", "instagram", "tiktok"]).notNull(),
  scheduledAt: timestamp("scheduledAt").notNull(),
  status: mysqlEnum("status", ["pending", "published", "failed", "cancelled"]).default("pending").notNull(),
  publishedAt: timestamp("publishedAt"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ScheduledPost = typeof scheduledPosts.$inferSelect;
export type InsertScheduledPost = typeof scheduledPosts.$inferInsert;

// ─── Platform Connections ──────────────────────────────────────────────────────
export const platformConnections = mysqlTable("platform_connections", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  platform: mysqlEnum("platform", ["facebook", "instagram", "tiktok"]).notNull(),
  accountName: varchar("accountName", { length: 255 }),
  accountId: varchar("accountId", { length: 255 }),
  accessToken: text("accessToken"),
  isActive: boolean("isActive").default(true).notNull(),
  connectedAt: timestamp("connectedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PlatformConnection = typeof platformConnections.$inferSelect;
export type InsertPlatformConnection = typeof platformConnections.$inferInsert;

// ─── Publish Log ───────────────────────────────────────────────────────────────
export const publishLog = mysqlTable("publish_log", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("postId").notNull(),
  publishedById: int("publishedById").notNull(),
  platform: mysqlEnum("platform", ["facebook", "instagram", "tiktok"]).notNull(),
  status: mysqlEnum("status", ["success", "failed"]).notNull(),
  platformPostId: varchar("platformPostId", { length: 255 }),
  errorMessage: text("errorMessage"),
  publishedAt: timestamp("publishedAt").defaultNow().notNull(),
});

export type PublishLog = typeof publishLog.$inferSelect;
export type InsertPublishLog = typeof publishLog.$inferInsert;
