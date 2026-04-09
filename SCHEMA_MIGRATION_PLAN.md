# Schema Migration Plan: Direct Publishing with Job Execution

## Overview
This document outlines the database schema changes needed to support direct backend publishing with job execution, error handling, and multi-page support.

## Changes Required

### 1. Extend `scheduledPosts` Table

**Current:**
```sql
CREATE TABLE scheduled_posts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  postId INT,
  scheduledById INT,
  platform ENUM('facebook', 'instagram', 'tiktok'),
  scheduledAt TIMESTAMP,
  status ENUM('pending', 'published', 'failed', 'cancelled'),
  publishedAt TIMESTAMP,
  errorMessage TEXT,
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP
);
```

**New Fields to Add:**
- `selectedPageId` (VARCHAR 255) — Which Facebook Page to publish to (for users with multiple Pages)
- `platformPostId` (VARCHAR 255) — The ID returned by the platform after publishing
- `publishingStartedAt` (TIMESTAMP) — When the job started attempting to publish
- `publishingAttempts` (INT DEFAULT 0) — How many times we've tried to publish
- `nextRetryAt` (TIMESTAMP) — When to retry if failed
- `lastErrorMessage` (TEXT) — Most recent error message
- `requiresReconnect` (BOOLEAN DEFAULT FALSE) — True if token expired or permissions revoked

**Updated Status Enum:**
```
ENUM('pending', 'publishing', 'published', 'failed', 'cancelled', 'reconnect_required')
```

**New Indexes:**
- `idx_status_scheduledAt` — For finding posts ready to publish
- `idx_userId_status` — For user dashboard queries
- `idx_nextRetryAt` — For finding posts that need retry

---

### 2. Extend `platformConnections` Table

**Current:**
```sql
CREATE TABLE platform_connections (
  id INT PRIMARY KEY AUTO_INCREMENT,
  userId INT,
  platform ENUM('facebook', 'instagram', 'tiktok'),
  accountName VARCHAR(255),
  accountId VARCHAR(255),
  accessToken TEXT,
  refreshToken TEXT,
  expiresAt TIMESTAMP,
  isActive BOOLEAN,
  connectedAt TIMESTAMP,
  updatedAt TIMESTAMP
);
```

**Problem:** Only stores one account per platform. For Facebook, users might have multiple Pages.

**Solution: Create New `facebookPages` Table**

```sql
CREATE TABLE facebook_pages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  connectionId INT NOT NULL,  -- FK to platformConnections
  pageId VARCHAR(255) NOT NULL,
  pageName VARCHAR(255),
  pageAccessToken TEXT NOT NULL,  -- Page-specific token (different from user token)
  isDefault BOOLEAN DEFAULT FALSE,
  isActive BOOLEAN DEFAULT TRUE,
  lastVerifiedAt TIMESTAMP,
  connectedAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW()
);
```

**Why:**
- Facebook user tokens are different from Page access tokens
- Users can manage multiple Pages
- Each Page needs its own token for publishing
- Allows users to select which Page when scheduling

**Migration Path:**
- For existing users: Create one `facebook_pages` record per `platformConnections` entry
- When user connects a new Page: Create new record in `facebook_pages`

---

### 3. Create Publishing Job Log Table

**New Table: `publishingJobs`**

```sql
CREATE TABLE publishing_jobs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  scheduledPostId INT NOT NULL,  -- FK to scheduledPosts
  userId INT NOT NULL,
  postId INT NOT NULL,
  platform ENUM('facebook', 'instagram', 'tiktok'),
  pageId VARCHAR(255),  -- For Facebook: which page
  status ENUM('pending', 'running', 'success', 'failed', 'retry', 'reconnect_required'),
  startedAt TIMESTAMP,
  completedAt TIMESTAMP,
  errorCode VARCHAR(100),  -- e.g., 'INVALID_TOKEN', 'INSUFFICIENT_PERMISSIONS', 'RATE_LIMITED'
  errorMessage TEXT,
  platformPostId VARCHAR(255),  -- ID returned by platform
  httpStatusCode INT,  -- e.g., 401, 403, 429
  responseBody TEXT,  -- Full API response for debugging
  attemptNumber INT DEFAULT 1,
  nextRetryAt TIMESTAMP,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW()
);
```

**Why:**
- Tracks every publishing attempt
- Enables detailed error analysis
- Supports retry logic with exponential backoff
- Provides audit trail for debugging

**Indexes:**
- `idx_scheduledPostId` — Link to scheduled post
- `idx_status_nextRetryAt` — Find jobs ready to retry
- `idx_userId_createdAt` — User's job history

---

## Migration SQL

### Step 1: Add fields to `scheduledPosts`

```sql
ALTER TABLE scheduled_posts
ADD COLUMN selectedPageId VARCHAR(255) AFTER platform,
ADD COLUMN platformPostId VARCHAR(255) AFTER publishedAt,
ADD COLUMN publishingStartedAt TIMESTAMP AFTER platformPostId,
ADD COLUMN publishingAttempts INT DEFAULT 0 AFTER publishingStartedAt,
ADD COLUMN nextRetryAt TIMESTAMP AFTER publishingAttempts,
ADD COLUMN lastErrorMessage TEXT AFTER nextRetryAt,
ADD COLUMN requiresReconnect BOOLEAN DEFAULT FALSE AFTER lastErrorMessage,
MODIFY COLUMN status ENUM('pending', 'publishing', 'published', 'failed', 'cancelled', 'reconnect_required') DEFAULT 'pending',
ADD INDEX idx_status_scheduledAt (status, scheduledAt),
ADD INDEX idx_userId_status (scheduledById, status),
ADD INDEX idx_nextRetryAt (nextRetryAt);
```

### Step 2: Create `facebook_pages` table

```sql
CREATE TABLE facebook_pages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  connectionId INT NOT NULL,
  pageId VARCHAR(255) NOT NULL,
  pageName VARCHAR(255),
  pageAccessToken TEXT NOT NULL,
  isDefault BOOLEAN DEFAULT FALSE,
  isActive BOOLEAN DEFAULT TRUE,
  lastVerifiedAt TIMESTAMP,
  connectedAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW(),
  FOREIGN KEY (connectionId) REFERENCES platform_connections(id) ON DELETE CASCADE,
  UNIQUE KEY unique_connection_page (connectionId, pageId),
  INDEX idx_connectionId (connectionId),
  INDEX idx_pageId (pageId)
);
```

### Step 3: Create `publishingJobs` table

```sql
CREATE TABLE publishing_jobs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  scheduledPostId INT NOT NULL,
  userId INT NOT NULL,
  postId INT NOT NULL,
  platform ENUM('facebook', 'instagram', 'tiktok'),
  pageId VARCHAR(255),
  status ENUM('pending', 'running', 'success', 'failed', 'retry', 'reconnect_required') DEFAULT 'pending',
  startedAt TIMESTAMP,
  completedAt TIMESTAMP,
  errorCode VARCHAR(100),
  errorMessage TEXT,
  platformPostId VARCHAR(255),
  httpStatusCode INT,
  responseBody LONGTEXT,
  attemptNumber INT DEFAULT 1,
  nextRetryAt TIMESTAMP,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW(),
  FOREIGN KEY (scheduledPostId) REFERENCES scheduled_posts(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (postId) REFERENCES content_posts(id) ON DELETE CASCADE,
  INDEX idx_scheduledPostId (scheduledPostId),
  INDEX idx_status_nextRetryAt (status, nextRetryAt),
  INDEX idx_userId_createdAt (userId, createdAt)
);
```

### Step 4: Migrate existing Facebook connections

```sql
INSERT INTO facebook_pages (connectionId, pageId, pageName, pageAccessToken, isDefault, isActive, connectedAt)
SELECT 
  pc.id,
  pc.accountId,
  pc.accountName,
  pc.accessToken,
  TRUE,
  pc.isActive,
  pc.connectedAt
FROM platform_connections pc
WHERE pc.platform = 'facebook' AND pc.accountId IS NOT NULL;
```

---

## Drizzle Schema Updates

### Updated `scheduledPosts` Type

```typescript
export const scheduledPosts = mysqlTable("scheduled_posts", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("postId").notNull(),
  scheduledById: int("scheduledById").notNull(),
  platform: mysqlEnum("platform", ["facebook", "instagram", "tiktok"]).notNull(),
  selectedPageId: varchar("selectedPageId", { length: 255 }),  // NEW
  scheduledAt: timestamp("scheduledAt").notNull(),
  status: mysqlEnum("status", [
    "pending",
    "publishing",
    "published",
    "failed",
    "cancelled",
    "reconnect_required"
  ]).default("pending").notNull(),
  publishedAt: timestamp("publishedAt"),
  platformPostId: varchar("platformPostId", { length: 255 }),  // NEW
  publishingStartedAt: timestamp("publishingStartedAt"),  // NEW
  publishingAttempts: int("publishingAttempts").default(0),  // NEW
  nextRetryAt: timestamp("nextRetryAt"),  // NEW
  lastErrorMessage: text("lastErrorMessage"),  // NEW
  requiresReconnect: boolean("requiresReconnect").default(false),  // NEW
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// NEW TABLE
export const facebookPages = mysqlTable("facebook_pages", {
  id: int("id").autoincrement().primaryKey(),
  connectionId: int("connectionId").notNull(),
  pageId: varchar("pageId", { length: 255 }).notNull(),
  pageName: varchar("pageName", { length: 255 }),
  pageAccessToken: text("pageAccessToken").notNull(),
  isDefault: boolean("isDefault").default(false).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  lastVerifiedAt: timestamp("lastVerifiedAt"),
  connectedAt: timestamp("connectedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// NEW TABLE
export const publishingJobs = mysqlTable("publishing_jobs", {
  id: int("id").autoincrement().primaryKey(),
  scheduledPostId: int("scheduledPostId").notNull(),
  userId: int("userId").notNull(),
  postId: int("postId").notNull(),
  platform: mysqlEnum("platform", ["facebook", "instagram", "tiktok"]).notNull(),
  pageId: varchar("pageId", { length: 255 }),
  status: mysqlEnum("status", [
    "pending",
    "running",
    "success",
    "failed",
    "retry",
    "reconnect_required"
  ]).default("pending").notNull(),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  errorCode: varchar("errorCode", { length: 100 }),
  errorMessage: text("errorMessage"),
  platformPostId: varchar("platformPostId", { length: 255 }),
  httpStatusCode: int("httpStatusCode"),
  responseBody: text("responseBody"),
  attemptNumber: int("attemptNumber").default(1).notNull(),
  nextRetryAt: timestamp("nextRetryAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
```

---

## Implementation Order

1. **Generate migration SQL** via `pnpm drizzle-kit generate`
2. **Apply migration** via `webdev_execute_sql`
3. **Update Drizzle types** in schema.ts
4. **Create helper functions** in db.ts
5. **Implement job executor** in new file
6. **Update routers.ts** to use new schema
7. **Update calendar UI** to show job statuses
8. **Test end-to-end**

---

## Error Codes for Publishing Jobs

```typescript
enum ErrorCode {
  // Token/Auth errors
  INVALID_TOKEN = "INVALID_TOKEN",
  TOKEN_EXPIRED = "TOKEN_EXPIRED",
  INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS",
  
  // Rate limiting
  RATE_LIMITED = "RATE_LIMITED",
  
  // Platform errors
  INVALID_PAGE_ID = "INVALID_PAGE_ID",
  PAGE_NOT_FOUND = "PAGE_NOT_FOUND",
  INVALID_IMAGE_URL = "INVALID_IMAGE_URL",
  
  // Network/System errors
  NETWORK_ERROR = "NETWORK_ERROR",
  TIMEOUT = "TIMEOUT",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}
```

---

## Retry Strategy

**Exponential Backoff:**
- Attempt 1: Immediate
- Attempt 2: 5 minutes
- Attempt 3: 15 minutes
- Attempt 4: 1 hour
- Attempt 5: 4 hours
- Max 5 attempts, then mark as `failed`

**Reconnect Required:**
- 401 (Unauthorized) → `reconnect_required`
- 403 (Forbidden) → `reconnect_required`
- Invalid token error → `reconnect_required`

**Don't Retry:**
- 400 (Bad Request) — Invalid data
- 404 (Not Found) — Page doesn't exist
- 429 (Rate Limited) — Wait before retry, but do retry

---

## Next Steps

1. ✅ Schema designed
2. Generate migration SQL
3. Apply to database
4. Update TypeScript types
5. Implement job executor
6. Update routers
7. Update UI
8. Test
