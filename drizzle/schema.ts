import { mysqlTable, mysqlSchema, AnyMySqlColumn, int, mysqlEnum, text, timestamp, varchar, index, tinyint } from "drizzle-orm/mysql-core"
import { sql } from "drizzle-orm"

export const approvalHistory = mysqlTable("approval_history", {
	id: int().autoincrement().notNull(),
	postId: int().notNull(),
	reviewerId: int().notNull(),
	action: mysqlEnum(['submitted','approved','rejected','revision_requested','resubmitted']).notNull(),
	note: text(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const contentPosts = mysqlTable("content_posts", {
	id: int().autoincrement().notNull(),
	authorId: int().notNull(),
	title: varchar({ length: 255 }).notNull(),
	niche: mysqlEnum(['time_freedom','parents','side_hustlers','online_business','cultural','over_50','scam_survivors']).notNull(),
	platform: mysqlEnum(['facebook','instagram','tiktok','all']).notNull(),
	contentType: mysqlEnum(['caption','script','hashtags','ideas','full_post']).notNull(),
	caption: text(),
	hashtags: text(), // Stored as space-separated or JSON array
	script: text(),
	ideas: text(),
	fullContent: text(),
	tone: varchar({ length: 100 }),
	status: mysqlEnum(['draft','pending_review','approved','rejected','published']).default('draft').notNull(),
	rejectionNote: text(),
	approvedById: int(),
	approvedAt: timestamp({ mode: 'string' }),
	publishedAt: timestamp({ mode: 'string' }),
	scheduledAt: timestamp({ mode: 'string' }),
	isLibraryItem: tinyint().default(0).notNull(),
	tags: text(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	imageUrl: text(),
	aiGeneratedImage: tinyint().default(0).notNull(),
	mediaType: mysqlEnum(['none','image','video']).default('none').notNull(),
	contentStyle: mysqlEnum(['motivational','engagement','personal_story','curiosity','opportunity','tips_values']),
	imagePrompt: text(),
});

export const contentTemplates = mysqlTable("content_templates", {
	id: int().autoincrement().notNull(),
	createdById: int().notNull(),
	name: varchar({ length: 255 }).notNull(),
	description: text(),
	niche: mysqlEnum(['time_freedom','parents','side_hustlers','online_business','cultural','over_50','scam_survivors']).notNull(),
	category: varchar({ length: 100 }).notNull(),
	prompt: text().notNull(),
	exampleContent: text(),
	isDefault: tinyint().default(0).notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const inviteCodes = mysqlTable("invite_codes", {
	id: int().autoincrement().notNull(),
	code: varchar({ length: 32 }).notNull(),
	createdBy: int().notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	expiresAt: timestamp({ mode: 'string' }),
	usedBy: int(),
	usedAt: timestamp({ mode: 'string' }),
	isActive: tinyint().default(1).notNull(),
},
(table) => [
	index("invite_codes_code_unique").on(table.code),
]);

export const platformConnections = mysqlTable("platform_connections", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	platform: mysqlEnum(['facebook','instagram','tiktok']).notNull(),
	accountName: varchar({ length: 255 }),
	accountId: varchar({ length: 255 }),
	accessToken: text(),
	isActive: tinyint().default(1).notNull(),
	connectedAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	refreshToken: text(),
	expiresAt: timestamp({ mode: 'string' }),
});

export const publishLog = mysqlTable("publish_log", {
	id: int().autoincrement().notNull(),
	postId: int().notNull(),
	publishedById: int().notNull(),
	platform: mysqlEnum(['facebook','instagram','tiktok']).notNull(),
	status: mysqlEnum(['success','failed']).notNull(),
	platformPostId: varchar({ length: 255 }),
	errorMessage: text(),
	publishedAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
});

export const publishingJobs = mysqlTable("publishing_jobs", {
	id: int().autoincrement().notNull(),
	scheduledPostId: int().notNull(),
	userId: int().notNull(),
	postId: int().notNull(),
	platform: mysqlEnum(['facebook','instagram','tiktok']).notNull(),
	pageId: varchar({ length: 255 }),
	status: mysqlEnum(['running','success','failed_auth','failed_retrying','failed_permanent']).default('running').notNull(),
	remotePostId: varchar({ length: 255 }),
	errorCode: varchar({ length: 100 }),
	errorMessage: text(),
	httpStatusCode: int(),
	responseBody: text(),
	attemptNumber: int().default(1).notNull(),
	startedAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	completedAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
},
(table) => [
	index("idx_publishing_jobs_scheduled_post").on(table.scheduledPostId),
	index("idx_publishing_jobs_user").on(table.userId),
]);

export const scheduledPosts = mysqlTable("scheduled_posts", {
	id: int().autoincrement().notNull(),
	postId: int().notNull(),
	scheduledById: int().notNull(),
	platform: mysqlEnum(['facebook','instagram','tiktok']).notNull(),
	scheduledAt: timestamp({ mode: 'string' }).notNull(),
	timezoneOffsetMinutes: int().default(0).notNull(),
	status: mysqlEnum(['scheduled','publishing','published','failed','cancelled','reconnect_required']).default('scheduled').notNull(),
	publishedAt: timestamp({ mode: 'string' }),
	errorMessage: text(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	connectionId: int().default(1),
	pageId: varchar({ length: 255 }),
	publishingStartedAt: timestamp({ mode: 'string' }),
	remotePostId: varchar({ length: 255 }),
	retryCount: int().default(0),
	nextRetryAt: timestamp({ mode: 'string' }),
	lastError: text(),
},
(table) => [
	index("idx_scheduled_posts_status_time").on(table.status, table.scheduledAt, table.nextRetryAt),
]);

export const socialConnections = mysqlTable("social_connections", {
	id: int().autoincrement().notNull(),
	userId: int().notNull(),
	platform: mysqlEnum(['facebook','instagram','tiktok']).notNull(),
	platformUserId: varchar({ length: 255 }).notNull(),
	platformUsername: varchar({ length: 255 }),
	accessToken: text().notNull(),
	refreshToken: text(),
	expiresAt: timestamp({ mode: 'string' }),
	scope: text(),
	isActive: tinyint().default(1).notNull(),
	lastVerifiedAt: timestamp({ mode: 'string' }),
	connectedAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
});

export const users = mysqlTable("users", {
	id: int().autoincrement().notNull(),
	openId: varchar({ length: 64 }).notNull(),
	name: text(),
	email: varchar({ length: 320 }),
	loginMethod: varchar({ length: 64 }),
	role: mysqlEnum(['user','admin']).default('user').notNull(),
	createdAt: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	lastSignedIn: timestamp({ mode: 'string' }).default('CURRENT_TIMESTAMP').notNull(),
	avatarUrl: text(),
},
(table) => [
	index("users_openId_unique").on(table.openId),
]);
