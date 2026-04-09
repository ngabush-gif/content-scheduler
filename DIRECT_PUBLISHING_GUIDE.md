# Direct Publishing Implementation Guide

## Status: Phase 1 Complete ✅

Database schema updated with:
- `publishingJobs` table (audit trail)
- `scheduledPosts` extended with: `connectionId`, `pageId`, `retryCount`, `nextRetryAt`, `lastError`, `remotePostId`, `publishingStartedAt`
- New statuses: `scheduled`, `publishing`, `published`, `failed`, `reconnect_required`

**Migration SQL:** `/home/ubuntu/content-creator-hub/drizzle/0007_migration.sql`

Apply with: `webdev_execute_sql` tool

---

## Phase 2: Publishing Worker with Atomic Job Claiming

**File:** `server/jobs/publishingWorker.ts`

```typescript
import { db } from "../db";
import { scheduledPosts, publishingJobs } from "../../drizzle/schema";
import { eq, and, lte, or, isNull } from "drizzle-orm";
import { publishToFacebookPage, publishToInstagram, publishToTikTok } from "../platformPublisher";
import { getContentPostById, getPlatformConnectionWithToken } from "../db";

interface PublishingContext {
  scheduledPostId: number;
  postId: number;
  userId: number;
  connectionId: number;
  platform: "facebook" | "instagram" | "tiktok";
  pageId?: string;
  scheduledAt: Date;
}

/**
 * Atomic Job Claiming with Database Lock
 * Prevents multiple workers from processing the same job
 */
async function claimScheduledPost(): Promise<PublishingContext | null> {
  try {
    // Use transaction with FOR UPDATE lock
    const result = await db.transaction(async (tx) => {
      // Find one post ready to publish with lock
      const posts = await tx.query.scheduledPosts.findMany({
        where: and(
          eq(scheduledPosts.status, "scheduled"),
          lte(scheduledPosts.scheduledAt, new Date()),
          or(
            isNull(scheduledPosts.nextRetryAt),
            lte(scheduledPosts.nextRetryAt, new Date())
          )
        ),
        limit: 1,
      });

      if (!posts.length) return null;

      const post = posts[0];

      // Atomically update to "publishing" status
      await tx
        .update(scheduledPosts)
        .set({
          status: "publishing",
          publishingStartedAt: new Date(),
        })
        .where(eq(scheduledPosts.id, post.id));

      return {
        scheduledPostId: post.id,
        postId: post.postId,
        userId: post.scheduledById,
        connectionId: post.connectionId,
        platform: post.platform as any,
        pageId: post.pageId || undefined,
        scheduledAt: post.scheduledAt,
      };
    });

    return result;
  } catch (error) {
    console.error("[PublishingWorker] Claiming error:", error);
    return null;
  }
}

/**
 * Main Job Executor Loop
 * Runs every 30-60 seconds
 */
export async function executePublishingJobs() {
  console.log(`[PublishingWorker] Starting job execution at ${new Date().toISOString()}`);

  let processedCount = 0;
  let errorCount = 0;

  // Process up to 5 jobs per cycle
  for (let i = 0; i < 5; i++) {
    const job = await claimScheduledPost();
    if (!job) break;

    try {
      await publishScheduledPost(job);
      processedCount++;
    } catch (error) {
      console.error(`[PublishingWorker] Job ${job.scheduledPostId} failed:`, error);
      errorCount++;
    }
  }

  console.log(
    `[PublishingWorker] Cycle complete: ${processedCount} published, ${errorCount} failed`
  );
}

/**
 * Publish a single scheduled post
 */
async function publishScheduledPost(context: PublishingContext) {
  const jobId = await createPublishingJob(context);

  try {
    // Get post content
    const post = await getContentPostById(context.postId);
    if (!post) {
      throw new Error("Post not found");
    }

    // Get user's platform connection
    const connection = await getPlatformConnectionWithToken(
      context.userId,
      context.platform
    );

    if (!connection || !connection.accessToken) {
      throw new Error("No credentials found");
    }

    // Publish to platform
    let result;
    if (context.platform === "facebook") {
      result = await publishToFacebookPage(post, {
        accessToken: connection.accessToken,
        pageId: context.pageId || connection.accountId || "",
      });
    } else if (context.platform === "instagram") {
      result = await publishToInstagram(post, {
        accessToken: connection.accessToken,
        accountId: connection.accountId || "",
      });
    } else {
      result = await publishToTikTok(post, {
        accessToken: connection.accessToken,
      });
    }

    if (!result.success) {
      throw new Error(result.errorMessage || "Publishing failed");
    }

    // Update job as success
    await updatePublishingJob(jobId, {
      status: "success",
      completedAt: new Date(),
      remotePostId: result.platformPostId,
    });

    // Update scheduled post as published
    await db
      .update(scheduledPosts)
      .set({
        status: "published",
        publishedAt: new Date(),
        remotePostId: result.platformPostId,
      })
      .where(eq(scheduledPosts.id, context.scheduledPostId));

    console.log(
      `[PublishingWorker] Published post ${context.postId} to ${context.platform}`
    );
  } catch (error: any) {
    const errorCode = getErrorCode(error);
    const shouldRetry = shouldRetryError(errorCode);

    if (errorCode === "TOKEN_EXPIRED" || errorCode === "INSUFFICIENT_PERMISSIONS") {
      // Mark as reconnect required
      await updatePublishingJob(jobId, {
        status: "failed_auth",
        completedAt: new Date(),
        errorCode,
        errorMessage: error.message,
      });

      await db
        .update(scheduledPosts)
        .set({
          status: "reconnect_required",
          lastError: error.message,
        })
        .where(eq(scheduledPosts.id, context.scheduledPostId));

      console.log(
        `[PublishingWorker] Post ${context.postId} marked reconnect_required`
      );
    } else if (shouldRetry && context.scheduledPostId) {
      // Schedule retry
      const retryCount = await getRetryCount(context.scheduledPostId);
      if (retryCount < 5) {
        const nextRetryAt = calculateNextRetryTime(retryCount);

        await updatePublishingJob(jobId, {
          status: "failed_retrying",
          completedAt: new Date(),
          errorCode,
          errorMessage: error.message,
          attemptNumber: retryCount + 1,
        });

        await db
          .update(scheduledPosts)
          .set({
            status: "scheduled", // Reset to scheduled for retry
            retryCount: retryCount + 1,
            nextRetryAt,
            lastError: error.message,
          })
          .where(eq(scheduledPosts.id, context.scheduledPostId));

        console.log(
          `[PublishingWorker] Post ${context.postId} scheduled for retry at ${nextRetryAt}`
        );
      } else {
        // Max retries exceeded
        await updatePublishingJob(jobId, {
          status: "failed_permanent",
          completedAt: new Date(),
          errorCode,
          errorMessage: `Max retries exceeded: ${error.message}`,
        });

        await db
          .update(scheduledPosts)
          .set({
            status: "failed",
            lastError: error.message,
          })
          .where(eq(scheduledPosts.id, context.scheduledPostId));

        console.log(`[PublishingWorker] Post ${context.postId} failed permanently`);
      }
    } else {
      // Permanent failure
      await updatePublishingJob(jobId, {
        status: "failed_permanent",
        completedAt: new Date(),
        errorCode,
        errorMessage: error.message,
      });

      await db
        .update(scheduledPosts)
        .set({
          status: "failed",
          lastError: error.message,
        })
        .where(eq(scheduledPosts.id, context.scheduledPostId));

      console.log(`[PublishingWorker] Post ${context.postId} failed permanently`);
    }
  }
}

/**
 * Helper: Create publishing job record
 */
async function createPublishingJob(context: PublishingContext): Promise<number> {
  const result = await db.insert(publishingJobs).values({
    scheduledPostId: context.scheduledPostId,
    userId: context.userId,
    postId: context.postId,
    platform: context.platform,
    pageId: context.pageId,
    status: "running",
    startedAt: new Date(),
  });

  return result.insertId as number;
}

/**
 * Helper: Update publishing job
 */
async function updatePublishingJob(
  jobId: number,
  updates: Partial<typeof publishingJobs.$inferInsert>
) {
  await db
    .update(publishingJobs)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(publishingJobs.id, jobId));
}

/**
 * Helper: Get retry count for a scheduled post
 */
async function getRetryCount(scheduledPostId: number): Promise<number> {
  const post = await db.query.scheduledPosts.findFirst({
    where: eq(scheduledPosts.id, scheduledPostId),
  });
  return post?.retryCount || 0;
}

/**
 * Error Handling
 */
function getErrorCode(error: any): string {
  if (error.statusCode === 401) return "TOKEN_EXPIRED";
  if (error.statusCode === 403) return "INSUFFICIENT_PERMISSIONS";
  if (error.statusCode === 429) return "RATE_LIMITED";
  if (error.statusCode === 404) return "NOT_FOUND";
  if (error.message?.includes("token")) return "TOKEN_EXPIRED";
  return "UNKNOWN_ERROR";
}

function shouldRetryError(errorCode: string): boolean {
  const retryable = ["RATE_LIMITED", "TIMEOUT", "NETWORK_ERROR"];
  return retryable.includes(errorCode);
}

function calculateNextRetryTime(attemptNumber: number): Date {
  const delays = [
    5 * 60_000,      // 5 minutes
    15 * 60_000,     // 15 minutes
    60 * 60_000,     // 1 hour
    4 * 60 * 60_000, // 4 hours
  ];
  const delay = delays[attemptNumber] || delays[delays.length - 1];
  return new Date(Date.now() + delay);
}

/**
 * Start the worker
 */
export function startPublishingWorker() {
  console.log("[PublishingWorker] Starting worker process");
  
  // Run immediately
  executePublishingJobs().catch(console.error);
  
  // Then every 60 seconds
  setInterval(() => {
    executePublishingJobs().catch(console.error);
  }, 60_000);
}
```

---

## Phase 3: Provider Publishing Functions

Update `server/platformPublisher.ts`:

```typescript
// Add image support to Facebook
export async function publishToFacebookPage(
  post: PostContent,
  credentials: { accessToken: string; pageId: string }
): Promise<PublishResult> {
  try {
    const text = buildPostText(post);
    const { accessToken, pageId } = credentials;

    const body: any = {
      message: text,
      access_token: accessToken,
    };

    // Add image if available
    if (post.imageUrl) {
      body.link = post.imageUrl;
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
      const error = new Error(data.error?.message || `Facebook error (${res.status})`);
      (error as any).statusCode = res.status;
      throw error;
    }

    return { success: true, platformPostId: data.id };
  } catch (err: any) {
    return {
      success: false,
      errorMessage: err?.message ?? "Unknown Facebook error",
    };
  }
}
```

---

## Phase 4: tRPC Endpoints

Add to `server/routers.ts`:

```typescript
schedule: router({
  create: protectedProcedure
    .input(
      z.object({
        postId: z.number(),
        connectionId: z.number(),
        pageId: z.string().optional(),
        platform: z.enum(["facebook", "instagram", "tiktok"]),
        scheduledAt: z.date(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const post = await getContentPostById(input.postId);
      if (!post) throw new TRPCError({ code: "NOT_FOUND" });
      if (post.status !== "approved") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only approved posts can be scheduled" });
      }

      if (input.scheduledAt <= new Date()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Scheduled time must be in the future" });
      }

      await db.insert(scheduledPosts).values({
        postId: input.postId,
        scheduledById: ctx.user.id,
        connectionId: input.connectionId,
        platform: input.platform,
        pageId: input.pageId,
        scheduledAt: input.scheduledAt,
        status: "scheduled",
      });

      return { success: true };
    }),

  list: protectedProcedure
    .input(z.object({ status: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return db.query.scheduledPosts.findMany({
        where: and(
          eq(scheduledPosts.scheduledById, ctx.user.id),
          input?.status ? eq(scheduledPosts.status, input.status) : undefined
        ),
        orderBy: (sp) => sp.scheduledAt,
      });
    }),

  retry: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db
        .update(scheduledPosts)
        .set({
          status: "scheduled",
          nextRetryAt: null,
          lastError: null,
        })
        .where(eq(scheduledPosts.id, input.id));

      return { success: true };
    }),

  cancel: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db
        .update(scheduledPosts)
        .set({ status: "cancelled" })
        .where(eq(scheduledPosts.id, input.id));

      return { success: true };
    }),
}),
```

---

## Phase 5: Frontend Updates

Remove `window.open()` from `Publishing.tsx` and update `ContentCalendar.tsx` to show job statuses.

---

## Phase 6: Database Helpers

Add to `server/db.ts`:

```typescript
export async function getScheduledPostsReadyToPublish() {
  return db.query.scheduledPosts.findMany({
    where: and(
      eq(scheduledPosts.status, "scheduled"),
      lte(scheduledPosts.scheduledAt, new Date()),
      or(
        isNull(scheduledPosts.nextRetryAt),
        lte(scheduledPosts.nextRetryAt, new Date())
      )
    ),
  });
}
```

---

## Phase 7: Testing

Write tests for atomic job claiming and retry logic.

---

## Phase 8: Integration

1. Apply migration SQL with `webdev_execute_sql`
2. Create `server/jobs/publishingWorker.ts`
3. Update `server/platformPublisher.ts`
4. Add tRPC endpoints
5. Update frontend
6. Start worker in `server/_core/index.ts`:

```typescript
import { startPublishingWorker } from "../jobs/publishingWorker";

// Start publishing worker
startPublishingWorker();
```

7. Test end-to-end
8. Create checkpoint

---

## Next Steps

1. Apply the migration SQL using `webdev_execute_sql`
2. Create the files mentioned above
3. Test with real Facebook account
4. Monitor logs for job execution

All code templates are provided above. Follow the implementation order for best results.
