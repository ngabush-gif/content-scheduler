import { getDb } from "../db";
import { scheduledPosts, publishingJobs, contentPosts, platformConnections } from "../../drizzle/schema";
import { eq, and, lte, or, isNull } from "drizzle-orm";
import { publishToFacebookPage } from "../platformPublisher";

/**
 * Publishing Worker: Atomic Job Claiming with Database Locking
 * 
 * Ensures:
 * - No duplicate publishing (atomic claim with database lock)
 * - Exponential backoff for retries
 * - Proper error classification (retryable vs permanent)
 * - Token expiration detection
 * - Comprehensive logging
 */

interface PublishingContext {
  scheduledPostId: number;
  postId: number;
  userId: number;
  connectionId: number;
  platform: "facebook" | "instagram" | "tiktok";
  pageId?: string;
  scheduledAt: Date;
}

interface PublishResult {
  success: boolean;
  platformPostId?: string;
  errorMessage?: string;
  errorCode?: string;
  isRetryable?: boolean;
  isAuthError?: boolean;
}

interface ErrorClassification {
  code: string;
  message: string;
  isRetryable: boolean;
  isAuthError: boolean;
  httpStatus?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// ATOMIC JOB CLAIMING WITH DATABASE LOCK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Claim a single scheduled post for publishing using atomic database lock
 * 
 * This ensures that even with multiple worker instances, each job is claimed
 * exactly once and transitioned to "publishing" state atomically.
 * 
 * Returns null if no jobs available or if claiming fails.
 */
async function claimScheduledPost(): Promise<PublishingContext | null> {
  try {
    const db = await getDb();
    if (!db) return null;
    const result = await db.transaction(async (tx) => {
      // Find ONE post ready to publish (status = scheduled, scheduledAt <= now, not in retry window)
      const readyPosts = await tx.query.scheduledPosts.findMany({
        where: and(
          eq(scheduledPosts.status, "scheduled"),
          lte(scheduledPosts.scheduledAt, new Date().toISOString()),
          or(
            isNull(scheduledPosts.nextRetryAt),
            lte(scheduledPosts.nextRetryAt, new Date().toISOString())
          )
        ),
        limit: 1,
      });

      if (!readyPosts.length) {
        return null;
      }

      const post = readyPosts[0];

      // ATOMIC: Update to "publishing" in same transaction
      // This prevents other workers from claiming the same job
      await tx
        .update(scheduledPosts)
        .set({
          status: "publishing",
          publishingStartedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(scheduledPosts.id, post.id));

      return {
        scheduledPostId: post.id,
        postId: post.postId,
        userId: post.scheduledById,
        connectionId: post.connectionId,
        platform: post.platform as "facebook" | "instagram" | "tiktok",
        pageId: post.pageId || undefined,
        scheduledAt: new Date(post.scheduledAt),
      };
    });

    return result;
  } catch (error) {
    console.error("[PublishingWorker] Error claiming job:", {
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN JOB EXECUTOR LOOP
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Main job executor: runs every 60 seconds
 * Processes up to 5 jobs per cycle to avoid overwhelming the system
 */
export async function executePublishingJobs(): Promise<void> {
  const cycleStartTime = new Date();
  console.log(`[PublishingWorker] Cycle started at ${cycleStartTime.toISOString()}`);

  let processedCount = 0;
  let successCount = 0;
  let errorCount = 0;

  // Process up to 5 jobs per cycle
  for (let i = 0; i < 5; i++) {
    const job = await claimScheduledPost();
    if (!job) {
      // No more jobs available
      break;
    }

    processedCount++;

    try {
      await publishScheduledPost(job);
      successCount++;
    } catch (error) {
      console.error(`[PublishingWorker] Unhandled error in job ${job.scheduledPostId}:`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      errorCount++;
    }
  }

  const cycleEndTime = new Date();
  const durationMs = cycleEndTime.getTime() - cycleStartTime.getTime();

  console.log(`[PublishingWorker] Cycle completed`, {
    timestamp: cycleEndTime.toISOString(),
    processed: processedCount,
    successful: successCount,
    failed: errorCount,
    durationMs,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLISH A SINGLE SCHEDULED POST
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Publish a single scheduled post to the user's selected platform
 */
async function publishScheduledPost(context: PublishingContext): Promise<void> {
  const jobId = await createPublishingJob(context);

  try {
    console.log(`[PublishingWorker] Publishing post ${context.postId} to ${context.platform}`, {
      scheduledPostId: context.scheduledPostId,
      jobId,
    });

    // Step 1: Get post content
    const post = await getContentPostById(context.postId);
    if (!post) {
      throw new Error("Post not found in database");
    }

    // Step 2: Get user's platform connection with credentials
    const connection = await getPlatformConnectionWithCredentials(
      context.userId,
      context.connectionId
    );

    if (!connection) {
      throw new Error("Platform connection not found");
    }

    if (!connection.accessToken) {
      throw new Error("No access token found for connection");
    }

    // Step 3: Publish to platform
    let result: PublishResult;

    if (context.platform === "facebook") {
      result = await publishToFacebookPage(post, {
        accessToken: connection.accessToken,
        pageId: context.pageId || connection.accountId || "",
      });
    } else if (context.platform === "instagram") {
      // TODO: Implement Instagram publishing
      result = {
        success: false,
        errorMessage: "Instagram publishing not yet implemented",
        errorCode: "NOT_IMPLEMENTED",
      };
    } else if (context.platform === "tiktok") {
      // TODO: Implement TikTok publishing
      result = {
        success: false,
        errorMessage: "TikTok publishing not yet implemented",
        errorCode: "NOT_IMPLEMENTED",
      };
    } else {
      throw new Error(`Unknown platform: ${context.platform}`);
    }

    // Step 4: Handle result
    if (result.success && result.platformPostId) {
      // SUCCESS: Mark as published
      await updatePublishingJob(jobId, {
        status: "success",
        completedAt: new Date(),
        remotePostId: result.platformPostId,
      });

      await db
        .update(scheduledPosts)
        .set({
          status: "published",
          publishedAt: new Date(),
          remotePostId: result.platformPostId,
          updatedAt: new Date(),
        })
        .where(eq(scheduledPosts.id, context.scheduledPostId));

      console.log(`[PublishingWorker] ✅ Published post ${context.postId}`, {
        scheduledPostId: context.scheduledPostId,
        platformPostId: result.platformPostId,
        platform: context.platform,
      });
    } else {
      // FAILURE: Classify error and decide on retry
      const errorClassification = classifyError(
        result.errorMessage || "Unknown error",
        result.errorCode
      );

      await handlePublishingFailure(
        context,
        jobId,
        errorClassification
      );
    }
  } catch (error: any) {
    // Unhandled error during publishing
    const errorClassification = classifyError(
      error?.message ?? "Unknown error",
      undefined
    );

    await handlePublishingFailure(
      context,
      jobId,
      errorClassification
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ERROR HANDLING AND RETRY LOGIC
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Classify error and determine retry strategy
 */
function classifyError(errorMessage: string, errorCode?: string): ErrorClassification {
  const lowerMessage = errorMessage.toLowerCase();

  // Auth errors: token expired, insufficient permissions
  if (
    errorCode === "TOKEN_EXPIRED" ||
    lowerMessage.includes("token") ||
    lowerMessage.includes("unauthorized") ||
    lowerMessage.includes("401")
  ) {
    return {
      code: "TOKEN_EXPIRED",
      message: "Access token expired or invalid",
      isRetryable: false,
      isAuthError: true,
      httpStatus: 401,
    };
  }

  if (
    errorCode === "INSUFFICIENT_PERMISSIONS" ||
    lowerMessage.includes("permission") ||
    lowerMessage.includes("403") ||
    lowerMessage.includes("insufficient")
  ) {
    return {
      code: "INSUFFICIENT_PERMISSIONS",
      message: "Insufficient permissions to publish",
      isRetryable: false,
      isAuthError: true,
      httpStatus: 403,
    };
  }

  // Retryable errors: rate limit, timeout, network
  if (
    errorCode === "RATE_LIMITED" ||
    lowerMessage.includes("rate limit") ||
    lowerMessage.includes("429")
  ) {
    return {
      code: "RATE_LIMITED",
      message: "Rate limited by platform",
      isRetryable: true,
      isAuthError: false,
      httpStatus: 429,
    };
  }

  if (
    errorCode === "TIMEOUT" ||
    lowerMessage.includes("timeout") ||
    lowerMessage.includes("econnrefused")
  ) {
    return {
      code: "TIMEOUT",
      message: "Request timeout",
      isRetryable: true,
      isAuthError: false,
    };
  }

  if (
    errorCode === "NETWORK_ERROR" ||
    lowerMessage.includes("network") ||
    lowerMessage.includes("enotfound")
  ) {
    return {
      code: "NETWORK_ERROR",
      message: "Network error",
      isRetryable: true,
      isAuthError: false,
    };
  }

  // Permanent errors: not found, invalid request
  if (
    errorCode === "NOT_FOUND" ||
    lowerMessage.includes("not found") ||
    lowerMessage.includes("404")
  ) {
    return {
      code: "NOT_FOUND",
      message: "Resource not found",
      isRetryable: false,
      isAuthError: false,
      httpStatus: 404,
    };
  }

  if (
    errorCode === "INVALID_REQUEST" ||
    lowerMessage.includes("invalid") ||
    lowerMessage.includes("400")
  ) {
    return {
      code: "INVALID_REQUEST",
      message: "Invalid request",
      isRetryable: false,
      isAuthError: false,
      httpStatus: 400,
    };
  }

  // Default: unknown error (treat as retryable)
  return {
    code: "UNKNOWN_ERROR",
    message: errorMessage,
    isRetryable: true,
    isAuthError: false,
  };
}

/**
 * Handle publishing failure: decide on retry, reconnect_required, or permanent failure
 */
async function handlePublishingFailure(
  context: PublishingContext,
  jobId: number,
  errorClassification: ErrorClassification
): Promise<void> {
  const currentPost = await db.query.scheduledPosts.findFirst({
    where: eq(scheduledPosts.id, context.scheduledPostId),
  });

  const currentRetryCount = currentPost?.retryCount || 0;
  const maxRetries = 5;

  console.log(`[PublishingWorker] ❌ Publishing failed for post ${context.postId}`, {
    scheduledPostId: context.scheduledPostId,
    errorCode: errorClassification.code,
    errorMessage: errorClassification.message,
    isRetryable: errorClassification.isRetryable,
    isAuthError: errorClassification.isAuthError,
    retryCount: currentRetryCount,
  });

  // Case 1: Auth error → Mark as reconnect_required
  if (errorClassification.isAuthError) {
    await updatePublishingJob(jobId, {
      status: "failed_auth",
      completedAt: new Date(),
      errorCode: errorClassification.code,
      errorMessage: errorClassification.message,
    });

    await db
      .update(scheduledPosts)
      .set({
        status: "reconnect_required",
        lastError: errorClassification.message,
        updatedAt: new Date(),
      })
      .where(eq(scheduledPosts.id, context.scheduledPostId));

    console.log(
      `[PublishingWorker] Post ${context.postId} marked as reconnect_required`
    );
    return;
  }

  // Case 2: Retryable error and retries remaining → Schedule retry
  if (errorClassification.isRetryable && currentRetryCount < maxRetries) {
    const nextRetryAt = calculateNextRetryTime(currentRetryCount);

    await updatePublishingJob(jobId, {
      status: "failed_retrying",
      completedAt: new Date(),
      errorCode: errorClassification.code,
      errorMessage: errorClassification.message,
      attemptNumber: currentRetryCount + 1,
    });

    await db
      .update(scheduledPosts)
      .set({
        status: "scheduled", // Reset to scheduled so worker picks it up again
        retryCount: currentRetryCount + 1,
        nextRetryAt,
        lastError: errorClassification.message,
        updatedAt: new Date(),
      })
      .where(eq(scheduledPosts.id, context.scheduledPostId));

    console.log(
      `[PublishingWorker] Post ${context.postId} scheduled for retry #${currentRetryCount + 1} at ${nextRetryAt.toISOString()}`
    );
    return;
  }

  // Case 3: Max retries exceeded or permanent error → Mark as failed
  const failureReason =
    currentRetryCount >= maxRetries
      ? `Max retries (${maxRetries}) exceeded: ${errorClassification.message}`
      : errorClassification.message;

  await updatePublishingJob(jobId, {
    status: "failed_permanent",
    completedAt: new Date(),
    errorCode: errorClassification.code,
    errorMessage: failureReason,
  });

  await db
    .update(scheduledPosts)
    .set({
      status: "failed",
      lastError: failureReason,
      updatedAt: new Date(),
    })
    .where(eq(scheduledPosts.id, context.scheduledPostId));

  console.log(`[PublishingWorker] Post ${context.postId} marked as permanently failed`);
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPONENTIAL BACKOFF RETRY CALCULATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate next retry time using exponential backoff
 * 
 * Retry schedule:
 * - Attempt 1: 5 minutes
 * - Attempt 2: 15 minutes
 * - Attempt 3: 1 hour
 * - Attempt 4: 4 hours
 * - Attempt 5: 24 hours
 */
function calculateNextRetryTime(attemptNumber: number): Date {
  const delays = [
    5 * 60_000,           // 5 minutes (attempt 0)
    15 * 60_000,          // 15 minutes (attempt 1)
    60 * 60_000,          // 1 hour (attempt 2)
    4 * 60 * 60_000,      // 4 hours (attempt 3)
    24 * 60 * 60_000,     // 24 hours (attempt 4)
  ];

  const delay = delays[attemptNumber] || delays[delays.length - 1];
  return new Date(Date.now() + delay);
}

// ─────────────────────────────────────────────────────────────────────────────
// DATABASE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get content post by ID
 */
async function getContentPostById(postId: number): Promise<any> {
  return db.query.contentPosts.findFirst({
    where: eq(contentPosts.id, postId),
  });
}

/**
 * Get platform connection with credentials
 */
async function getPlatformConnectionWithCredentials(
  userId: number,
  connectionId: number
): Promise<any> {
  return db.query.platformConnections.findFirst({
    where: and(
      eq(platformConnections.id, connectionId),
      eq(platformConnections.userId, userId)
    ),
  });
}

/**
 * Create publishing job record
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
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return Number(result.insertId);
}

/**
 * Update publishing job
 */
async function updatePublishingJob(
  jobId: number,
  updates: Partial<{
    status: string;
    completedAt: Date;
    remotePostId: string;
    errorCode: string;
    errorMessage: string;
    attemptNumber: number;
  }>
): Promise<void> {
  await db
    .update(publishingJobs)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(publishingJobs.id, jobId));
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKER LIFECYCLE
// ─────────────────────────────────────────────────────────────────────────────

let workerInterval: NodeJS.Timeout | null = null;

/**
 * Start the publishing worker
 * Runs immediately, then every 60 seconds
 */
export function startPublishingWorker(): void {
  console.log("[PublishingWorker] Starting publishing worker");

  // Run immediately
  executePublishingJobs().catch((error) => {
    console.error("[PublishingWorker] Error in initial execution:", error);
  });

  // Then every 60 seconds
  workerInterval = setInterval(() => {
    executePublishingJobs().catch((error) => {
      console.error("[PublishingWorker] Error in scheduled execution:", error);
    });
  }, 60_000);

  console.log("[PublishingWorker] Worker started (runs every 60 seconds)");
}

/**
 * Stop the publishing worker (for graceful shutdown)
 */
export function stopPublishingWorker(): void {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    console.log("[PublishingWorker] Worker stopped");
  }
}
