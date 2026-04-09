# Direct Publishing Implementation Plan

## Overview
This document outlines the complete implementation strategy to move from manual copy-to-clipboard publishing to automatic backend job execution with direct API publishing to Facebook, Instagram, and TikTok.

---

## Architecture Overview

### Current (Broken) Flow
```
User schedules post
  → Stored in DB with status: "pending"
  → Nothing happens
  → User goes to Publishing page
  → Clicks "Open Facebook"
  → window.open("https://business.facebook.com/creatorstudio")
  → User manually schedules in Facebook's UI
  → Bypasses our app entirely
```

### New (Direct Publishing) Flow
```
User schedules post
  → Stored in scheduledPosts with status: "pending"
  → Job executor runs every 60 seconds
  → Finds posts where scheduledAt <= now()
  → Creates publishingJob record with status: "running"
  → Calls platform API directly (Facebook Graph, Instagram Graph, TikTok API)
  → Updates publishingJob with result
  → Updates scheduledPost with status: "published" or "failed"
  → Calendar UI shows job status in real-time
  → If failed: Retry with exponential backoff
  → If token expired: Mark as "reconnect_required", notify user
```

---

## Phase 2: Database Schema Updates

### 2.1 Generate Drizzle Migration

```bash
cd /home/ubuntu/content-creator-hub
pnpm drizzle-kit generate
```

This will:
- Read updated schema.ts
- Compare with current database
- Generate SQL migration file in `drizzle/migrations/`

### 2.2 Apply Migration

Use `webdev_execute_sql` to apply the migration SQL.

### 2.3 Update TypeScript Types

Add new types to `drizzle/schema.ts`:
- `facebookPages` table
- `publishingJobs` table
- Updated `scheduledPosts` with new fields

---

## Phase 3: Backend Job Execution System

### 3.1 Create Job Executor Service

**File:** `server/jobs/publishingJobExecutor.ts`

```typescript
/**
 * Publishing Job Executor
 * Runs every 60 seconds to:
 * 1. Find scheduled posts where scheduledAt <= now()
 * 2. Create publishingJob records
 * 3. Call platform APIs
 * 4. Update job status and retry if needed
 */

interface PublishingJobContext {
  scheduledPostId: number;
  userId: number;
  postId: number;
  platform: "facebook" | "instagram" | "tiktok";
  pageId?: string;
  scheduledAt: Date;
}

export async function executePublishingJobs() {
  // 1. Find posts ready to publish
  const readyPosts = await getScheduledPostsReadyToPublish();
  
  for (const post of readyPosts) {
    // 2. Create job record
    const job = await createPublishingJob({
      scheduledPostId: post.id,
      userId: post.scheduledById,
      postId: post.postId,
      platform: post.platform,
      pageId: post.selectedPageId,
      status: "running",
      startedAt: new Date(),
    });
    
    try {
      // 3. Get user's credentials
      const credentials = await getPublishingCredentials(
        post.scheduledById,
        post.platform,
        post.selectedPageId
      );
      
      if (!credentials) {
        throw new Error("No credentials found");
      }
      
      // 4. Get post content
      const postContent = await getContentPostById(post.postId);
      
      // 5. Call platform API
      let result;
      if (post.platform === "facebook") {
        result = await publishToFacebookDirect(postContent, credentials);
      } else if (post.platform === "instagram") {
        result = await publishToInstagramDirect(postContent, credentials);
      } else {
        result = await publishToTikTokDirect(postContent, credentials);
      }
      
      // 6. Update job with success
      await updatePublishingJob(job.id, {
        status: "success",
        completedAt: new Date(),
        platformPostId: result.platformPostId,
      });
      
      // 7. Update scheduled post
      await updateScheduledPost(post.id, {
        status: "published",
        publishedAt: new Date(),
        platformPostId: result.platformPostId,
      });
      
    } catch (error: any) {
      // 8. Handle errors
      const errorCode = getErrorCode(error);
      const shouldRetry = shouldRetryError(errorCode);
      
      if (errorCode === "TOKEN_EXPIRED" || errorCode === "INSUFFICIENT_PERMISSIONS") {
        // Mark as reconnect required
        await updatePublishingJob(job.id, {
          status: "reconnect_required",
          completedAt: new Date(),
          errorCode,
          errorMessage: error.message,
        });
        
        await updateScheduledPost(post.id, {
          status: "reconnect_required",
          requiresReconnect: true,
          lastErrorMessage: error.message,
        });
        
      } else if (shouldRetry && post.publishingAttempts < 5) {
        // Schedule retry
        const nextRetryAt = calculateNextRetryTime(post.publishingAttempts);
        
        await updatePublishingJob(job.id, {
          status: "retry",
          completedAt: new Date(),
          nextRetryAt,
          errorCode,
          errorMessage: error.message,
          attemptNumber: post.publishingAttempts + 1,
        });
        
        await updateScheduledPost(post.id, {
          status: "failed",
          publishingAttempts: post.publishingAttempts + 1,
          nextRetryAt,
          lastErrorMessage: error.message,
        });
        
      } else {
        // Final failure
        await updatePublishingJob(job.id, {
          status: "failed",
          completedAt: new Date(),
          errorCode,
          errorMessage: error.message,
        });
        
        await updateScheduledPost(post.id, {
          status: "failed",
          lastErrorMessage: error.message,
        });
      }
    }
  }
}

// Run every 60 seconds
setInterval(executePublishingJobs, 60_000);
```

### 3.2 Error Handling Utilities

**File:** `server/jobs/errorHandling.ts`

```typescript
export function getErrorCode(error: any): string {
  // Parse error from platform API response
  if (error.statusCode === 401) return "INVALID_TOKEN";
  if (error.statusCode === 403) return "INSUFFICIENT_PERMISSIONS";
  if (error.statusCode === 429) return "RATE_LIMITED";
  if (error.statusCode === 404) return "PAGE_NOT_FOUND";
  if (error.statusCode === 400) return "INVALID_REQUEST";
  if (error.message?.includes("token")) return "TOKEN_EXPIRED";
  return "UNKNOWN_ERROR";
}

export function shouldRetryError(errorCode: string): boolean {
  const retryable = [
    "RATE_LIMITED",
    "TIMEOUT",
    "NETWORK_ERROR",
  ];
  return retryable.includes(errorCode);
}

export function calculateNextRetryTime(attemptNumber: number): Date {
  const delays = [
    5 * 60_000,      // 5 minutes
    15 * 60_000,     // 15 minutes
    60 * 60_000,     // 1 hour
    4 * 60 * 60_000, // 4 hours
  ];
  const delay = delays[attemptNumber] || delays[delays.length - 1];
  return new Date(Date.now() + delay);
}
```

### 3.3 Startup Integration

**File:** `server/_core/index.ts`

Add to server startup:
```typescript
import { executePublishingJobs } from "../jobs/publishingJobExecutor";

// Start publishing job executor
setInterval(executePublishingJobs, 60_000);
console.log("[PublishingJobs] Executor started (60s interval)");
```

---

## Phase 4: Facebook Direct Publishing with Images

### 4.1 Update `platformPublisher.ts`

**Current Issue:** `publishToFacebook()` only publishes text, no images.

**New Implementation:**

```typescript
export async function publishToFacebookDirect(
  post: PostContent,
  credentials: { accessToken: string; pageId: string; pageAccessToken?: string }
): Promise<PublishResult> {
  try {
    const text = buildPostText(post);
    const { pageAccessToken, pageId } = credentials;
    
    // Use page-specific token if available (more secure)
    const token = pageAccessToken || credentials.accessToken;
    
    // Build request body
    const body: any = {
      message: text,
      access_token: token,
    };
    
    // Add image if available
    if (post.imageUrl) {
      body.link = post.imageUrl;  // Facebook will fetch and display the image
    }
    
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${pageId}/feed`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    
    const data = await res.json() as any;
    
    if (!res.ok || data.error) {
      const error = data.error || {};
      const err = new Error(error.message || `Facebook error (${res.status})`);
      (err as any).statusCode = res.status;
      (err as any).errorCode = error.code;
      throw err;
    }
    
    return { success: true, platformPostId: data.id };
    
  } catch (err: any) {
    return {
      success: false,
      errorMessage: err?.message ?? "Unknown Facebook error",
      statusCode: err?.statusCode,
    };
  }
}
```

### 4.2 Get Facebook Page Credentials

**File:** `server/db.ts`

Add helper function:
```typescript
export async function getFacebookPageCredentials(
  userId: number,
  pageId?: string
): Promise<{ pageId: string; pageAccessToken: string } | null> {
  // If pageId specified, get that page's token
  if (pageId) {
    const page = await db.query.facebookPages.findFirst({
      where: and(
        eq(facebookPages.pageId, pageId),
        eq(facebookPages.isActive, true)
      ),
    });
    
    if (page) {
      return {
        pageId: page.pageId,
        pageAccessToken: page.pageAccessToken,
      };
    }
  }
  
  // Otherwise get default page
  const connection = await db.query.platformConnections.findFirst({
    where: and(
      eq(platformConnections.userId, userId),
      eq(platformConnections.platform, "facebook"),
      eq(platformConnections.isActive, true)
    ),
  });
  
  if (!connection) return null;
  
  // Get default Facebook page
  const defaultPage = await db.query.facebookPages.findFirst({
    where: and(
      eq(facebookPages.connectionId, connection.id),
      eq(facebookPages.isDefault, true),
      eq(facebookPages.isActive, true)
    ),
  });
  
  if (defaultPage) {
    return {
      pageId: defaultPage.pageId,
      pageAccessToken: defaultPage.pageAccessToken,
    };
  }
  
  // Fallback to first active page
  const firstPage = await db.query.facebookPages.findFirst({
    where: and(
      eq(facebookPages.connectionId, connection.id),
      eq(facebookPages.isActive, true)
    ),
  });
  
  if (firstPage) {
    return {
      pageId: firstPage.pageId,
      pageAccessToken: firstPage.pageAccessToken,
    };
  }
  
  return null;
}
```

---

## Phase 5: Frontend Calendar UI Updates

### 5.1 Update ContentCalendar.tsx

**Changes:**
1. Remove "Open Platform" button
2. Show job status badges (pending, publishing, published, failed, reconnect_required)
3. Show retry countdown for failed jobs
4. Show "Reconnect Required" message for token errors
5. Add manual retry button for failed jobs

```typescript
// Show job status
const jobStatus = job?.status || post.status;

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  publishing: "bg-blue-100 text-blue-800",
  published: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  reconnect_required: "bg-orange-100 text-orange-800",
  cancelled: "bg-gray-100 text-gray-800",
};

// Show retry countdown
if (job?.status === "retry" && job?.nextRetryAt) {
  const timeUntilRetry = new Date(job.nextRetryAt).getTime() - Date.now();
  const minutesUntilRetry = Math.ceil(timeUntilRetry / 60_000);
  <p className="text-xs text-muted-foreground">
    Retrying in {minutesUntilRetry} minutes
  </p>
}
```

### 5.2 Remove Platform Handoff

**Remove from Publishing.tsx:**
- Delete `openPlatformAndClose()` function
- Remove "Open Facebook/Instagram/TikTok" button
- Remove copy-to-clipboard modal
- Simplify UI to just show "Scheduled" status

**New UI:**
```
Post Title
  Status: Scheduled for [date/time]
  Platform: Facebook
  Job Status: Publishing...
  
  [Cancel Schedule] [View Details]
```

---

## Phase 6: Testing Strategy

### 6.1 Unit Tests

**File:** `server/jobs/publishingJobExecutor.test.ts`

```typescript
describe("Publishing Job Executor", () => {
  it("should find posts ready to publish", async () => {
    // Create scheduled post with scheduledAt in past
    // Run executor
    // Verify job was created
  });
  
  it("should publish to Facebook with image", async () => {
    // Mock Facebook API
    // Create scheduled post with image
    // Run executor
    // Verify POST to /feed with image link
  });
  
  it("should retry on rate limit", async () => {
    // Mock 429 response
    // Run executor
    // Verify status = "retry"
    // Verify nextRetryAt is set
  });
  
  it("should mark as reconnect_required on 401", async () => {
    // Mock 401 response
    // Run executor
    // Verify status = "reconnect_required"
    // Verify requiresReconnect = true
  });
  
  it("should not retry invalid requests", async () => {
    // Mock 400 response
    // Run executor
    // Verify status = "failed"
    // Verify no retry scheduled
  });
});
```

### 6.2 Integration Tests

**Manual Testing Checklist:**
- [ ] Schedule post for 1 minute from now
- [ ] Wait for job executor to run
- [ ] Verify post published to Facebook
- [ ] Verify calendar shows "published" status
- [ ] Test with expired token (should show "reconnect_required")
- [ ] Test with missing image URL (should publish text-only)
- [ ] Test with multiple pages (should publish to selected page)

---

## Phase 7: Instagram Architecture (Future)

### Instagram Direct Publishing

```typescript
export async function publishToInstagramDirect(
  post: PostContent,
  credentials: { accessToken: string; accountId: string }
): Promise<PublishResult> {
  // Same pattern as Facebook:
  // 1. Create media container with image
  // 2. Publish container
  // 3. Return media ID
  
  // Supports same error handling and retry logic
}
```

### Multi-Account Support

For Instagram Business Accounts:
- Store multiple `accountId` values per user
- Allow user to select account when scheduling
- Similar to Facebook Pages pattern

---

## Phase 8: MVP Scope (What to Ignore for Now)

### ❌ Not Implementing Yet

1. **Video Publishing** — Start with images only
2. **Carousel Posts** — Single image only
3. **Stories** — Feed posts only
4. **Reels** — Feed posts only
5. **Instagram Scheduling** — Direct publish only (no native scheduling)
6. **TikTok Video Upload** — Direct publish only
7. **Analytics/Metrics** — Just track success/failure
8. **Content Approval Workflow** — Assume all posts approved
9. **Bulk Scheduling** — One post at a time
10. **Scheduled Post Editing** — Can't edit after scheduled
11. **Scheduled Post Deletion** — Can cancel only
12. **Publishing History UI** — Just status in calendar
13. **Rate Limit Handling** — Basic retry only
14. **OAuth Token Refresh** — Manual reconnect only

### ✅ MVP Scope (Phase 1-8)

1. **Facebook Pages** — Text + image, direct publishing
2. **Job Execution** — Automatic at scheduled time
3. **Error Handling** — Retry with backoff, reconnect required
4. **Status Tracking** — pending, publishing, published, failed, reconnect_required
5. **Calendar UI** — Show job status, no platform handoff
6. **Multi-Page Support** — Select which page when scheduling
7. **Detailed Logging** — Track every attempt

---

## Implementation Checklist

- [ ] Phase 2: Update database schema
  - [ ] Generate Drizzle migration
  - [ ] Apply migration SQL
  - [ ] Update TypeScript types
  - [ ] Create helper functions in db.ts

- [ ] Phase 3: Job execution system
  - [ ] Create publishingJobExecutor.ts
  - [ ] Create errorHandling.ts
  - [ ] Integrate into server startup
  - [ ] Write unit tests

- [ ] Phase 4: Facebook direct publishing
  - [ ] Update publishToFacebookDirect()
  - [ ] Add image support
  - [ ] Add page credential helper
  - [ ] Test with real Facebook API

- [ ] Phase 5: Frontend updates
  - [ ] Update ContentCalendar.tsx
  - [ ] Remove Publishing.tsx handoff
  - [ ] Add job status display
  - [ ] Add retry countdown

- [ ] Phase 6: Testing
  - [ ] Unit tests for job executor
  - [ ] Integration tests
  - [ ] Manual end-to-end testing
  - [ ] Test error scenarios

- [ ] Phase 7: Documentation
  - [ ] Document Instagram architecture
  - [ ] Document error codes
  - [ ] Document retry strategy

- [ ] Phase 8: Delivery
  - [ ] Create checkpoint
  - [ ] Deliver to user
  - [ ] Get feedback

---

## Success Criteria

✅ **Scheduler MVP is complete when:**

1. User schedules post for 1 minute from now
2. Job executor automatically publishes at scheduled time
3. Post appears on Facebook with caption and image
4. Calendar shows "published" status
5. No manual intervention needed
6. If token expires, shows "reconnect required"
7. If rate limited, retries automatically
8. All 21 existing tests still pass
9. New tests for job executor pass
10. Zero TypeScript errors

---

## Timeline Estimate

- Phase 2 (Schema): 30 minutes
- Phase 3 (Job Executor): 2 hours
- Phase 4 (Facebook Publishing): 1 hour
- Phase 5 (Frontend): 1 hour
- Phase 6 (Testing): 1.5 hours
- Phase 7 (Documentation): 30 minutes
- Phase 8 (Delivery): 30 minutes

**Total: ~7 hours**
