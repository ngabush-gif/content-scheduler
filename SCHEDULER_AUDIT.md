# ContentCreator Hub Scheduler Audit Report

## Executive Summary

**Current State:** The app has a **dual publishing system** that creates confusion and handoff:
1. **Publishing page** (Option B): Copy-to-clipboard modal that opens Facebook Creator Studio manually
2. **Calendar page**: Scheduled posts stored in DB but **never actually published** — they sit in `pending` status indefinitely

**Root Problem:** The scheduler stores posts but has **no job execution layer**. Scheduled posts are stored but never automatically published at the scheduled time. Users must manually publish via the Publishing page.

**Why Facebook Creator Studio Opens:** The Publishing page's `openPlatformAndClose()` function (line 137-159 in Publishing.tsx) explicitly opens Facebook Creator Studio at `https://business.facebook.com/creatorstudio`, forcing users to manually schedule there instead of using our calendar.

---

## Current Architecture Analysis

### 1. Publishing Page Flow (Publishing.tsx)

**User Journey:**
```
User clicks "Publish to Facebook" 
  → Modal opens with caption/hashtags/image URL
  → User clicks "Copy Content" 
    → Copies text to clipboard
  → User clicks "Open Facebook" 
    → window.open("https://business.facebook.com/creatorstudio")
    → User manually schedules in Facebook's UI
```

**Code Location:** `Publishing.tsx` lines 137-159
```typescript
const openPlatformAndClose = () => {
  if (platform === "facebook") {
    window.open("https://business.facebook.com/creatorstudio", "_blank");
  }
  // ...
}
```

**Problem:** This is a **handoff to Facebook's UI**. We never actually publish—we just copy content and let users do it manually.

---

### 2. Calendar Page Flow (ContentCalendar.tsx)

**User Journey:**
```
User clicks "Schedule Post"
  → Selects post, platform, date/time
  → Calls trpc.schedule.create
    → Creates scheduledPost with status: "pending"
    → Stores in database
  → Calendar displays the scheduled item
  → ⚠️ NOTHING HAPPENS AT SCHEDULED TIME
```

**Code Location:** `ContentCalendar.tsx` lines 81-91
```typescript
const handleSchedule = () => {
  scheduleMutation.mutate({
    postId: scheduleModal.post.id,
    platform: selectedPlatform,
    scheduledAt: new Date(selectedDateTime).getTime(),
  });
};
```

**Problem:** 
- Posts are stored in `scheduledPosts` table with `status: "pending"`
- No background job checks if scheduled time has arrived
- No automatic publishing mechanism
- Posts sit forever in pending state

---

### 3. Backend Publishing System (routers.ts)

**Current Procedures:**

#### `publish.post` (lines 645-709)
- **Type:** Manual mutation (user-triggered)
- **What it does:** Publishes immediately to all selected platforms
- **Flow:** 
  1. Gets user's platform credentials
  2. Calls `publishToFacebook()`, `publishToInstagram()`, or `publishToTikTok()`
  3. Logs results to `publishLog` table
  4. Updates post status to "published"

#### `publish.schedule` (lines 716-751)
- **Type:** Manual mutation (user-triggered)
- **What it does:** Stores scheduled post in DB, nothing else
- **Flow:**
  1. Validates post is approved
  2. Validates scheduled time is in future
  3. Creates `scheduledPost` record with `status: "pending"`
  4. Returns success message
  5. ⚠️ **No job execution**

#### `schedule.create` (lines 515-537)
- **Type:** Manual mutation (user-triggered)
- **What it does:** Same as `publish.schedule` — just stores in DB
- **Flow:** Creates `scheduledPost` record, nothing else

---

### 4. Platform Publishing Implementation (platformPublisher.ts)

**Current Capabilities:**

#### Facebook (lines 115-147)
```typescript
export async function publishToFacebook(
  post: PostContent,
  credentials: { accessToken: string; pageId: string }
): Promise<PublishResult>
```
- ✅ Publishes text-only posts to Facebook Page feed
- ✅ Supports caption + hashtags
- ⚠️ **Does NOT support images** — only text
- Uses Graph API endpoint: `POST /v21.0/{pageId}/feed`
- Requires: Page Access Token, Page ID

#### Instagram (lines 45-107)
- ✅ Creates media container with image
- ✅ Publishes to feed
- Requires: User Access Token, Instagram Business Account ID

#### TikTok (lines 157-204)
- ⚠️ Placeholder implementation
- Uses placeholder video URL
- Not production-ready

---

### 5. Database Schema (drizzle/schema.ts)

#### `scheduledPosts` table (lines 98-109)
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

**Missing Fields:**
- ❌ No `selectedPageId` — which Facebook Page to publish to?
- ❌ No `publishingAttempts` — how many times tried?
- ❌ No `nextRetryAt` — when to retry on failure?
- ❌ No `reconnectRequired` status — for token expiration
- ❌ No `jobStartedAt` — when did publishing attempt start?

#### `platformConnections` table (lines 115-127)
- ✅ Stores user's platform credentials
- ✅ Has `accountId` (Page ID for Facebook)
- ✅ Has `accessToken`
- ⚠️ No way to select **which** Facebook Page if user has multiple

---

## Why Current Flow Hands Off to Facebook

### Root Cause Chain:
1. **No job scheduler** → Scheduled posts never auto-publish
2. **Users frustrated** → They go to Publishing page instead
3. **Publishing page opens Creator Studio** → `window.open("https://business.facebook.com/creatorstudio")`
4. **Users manually schedule there** → Bypasses our app entirely

### Exact Handoff Point:
**File:** `client/src/pages/Publishing.tsx`  
**Function:** `openPlatformAndClose()` (line 137)  
**Line:** `window.open("https://business.facebook.com/creatorstudio", "_blank");`

This is the **only place** we hand off to Facebook's UI. Remove this and implement job execution, and we own the entire flow.

---

## What's Missing for Direct Publishing

### 1. Job Execution Layer
- ❌ No background job processor
- ❌ No cron/scheduler to check `scheduledPosts` table
- ❌ No retry logic for failed publishes
- ❌ No exponential backoff for rate limits

### 2. Facebook Image Support
- ❌ `publishToFacebook()` only publishes text
- ❌ No image attachment capability
- ✅ Facebook Graph API supports images, but we don't use it

### 3. Multi-Page Support
- ❌ No way to select which Facebook Page if user has multiple
- ❌ `platformConnections` stores one `accountId` per platform
- ❌ Need to support user managing multiple Pages

### 4. Error Handling & Recovery
- ❌ No distinction between "retry" vs "reconnect required" errors
- ❌ No token expiration detection
- ❌ No permission error handling
- ❌ No rate limit backoff

### 5. Status Tracking
- ❌ No `publishing` status (in-progress)
- ❌ No `reconnect_required` status (token expired)
- ❌ No attempt counter
- ❌ No detailed error logging per attempt

---

## Facebook Graph API Capabilities

### Text-Only Post (Current Implementation)
```
POST /v21.0/{page-id}/feed
{
  "message": "Your caption here",
  "access_token": "..."
}
```
✅ Works, but no images

### Text + Image Post (What We Need)
```
POST /v21.0/{page-id}/feed
{
  "message": "Your caption here",
  "link": "https://example.com/image.jpg",
  "access_token": "..."
}
```
✅ Supported by Graph API

### Scheduled Post (Native Facebook Scheduling)
```
POST /v21.0/{page-id}/feed
{
  "message": "Your caption here",
  "link": "https://example.com/image.jpg",
  "scheduled_publish_time": 1234567890,
  "access_token": "..."
}
```
✅ Supported by Graph API
- Requires `MANAGE_PAGES` permission
- Returns `id` of scheduled post
- Can be cancelled with `DELETE /{post-id}`

---

## Current Test Coverage

**Server Tests:** 21 passing
- ✅ Content generation
- ✅ Image upload
- ✅ Platform connections
- ❌ **No tests for scheduled publishing**
- ❌ **No tests for job execution**
- ❌ **No tests for Facebook API calls**

---

## Summary: Why We Hand Off to Facebook

| Component | Current | Problem |
|-----------|---------|---------|
| **Calendar** | Stores scheduled posts in DB | Never publishes them |
| **Publishing Page** | Opens Facebook Creator Studio | Manual handoff, bypasses our app |
| **Job Execution** | None | Scheduled posts never auto-publish |
| **Facebook Publishing** | Text-only | No image support |
| **Error Handling** | Minimal | No retry/reconnect logic |
| **Status Tracking** | Basic | No publishing/reconnect states |

**The Fix:** Build a job execution layer that automatically publishes scheduled posts at the right time, with proper error handling and retry logic. This eliminates the need to hand off to Facebook.

---

## Next Steps

1. ✅ **Phase 1 (Complete):** Audit complete
2. **Phase 2:** Update schema with job statuses and multi-page support
3. **Phase 3:** Implement job execution system (Node.js worker)
4. **Phase 4:** Add Facebook image publishing support
5. **Phase 5:** Update calendar UI to show job statuses
6. **Phase 6:** Test end-to-end
7. **Phase 7:** Document Instagram architecture
8. **Phase 8:** Deliver to user
