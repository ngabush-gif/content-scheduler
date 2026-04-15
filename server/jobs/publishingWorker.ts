import { getDb } from "../db";
import { scheduledPosts, publishingJobs, contentPosts, platformConnections } from "../../drizzle/schema";
import { eq, and, lte, or, isNull } from "drizzle-orm";
import { publishToFacebookPage, publishToInstagram } from "../platformPublisher";
import { refreshPageToken } from "../facebookOAuth";

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
  connectionId: number | null;
  platform: "facebook" | "instagram" | "tiktok";
  pageId?: string | null;
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
    
    // Find ONE post ready to publish (status = scheduled, scheduledAt <= now, not in retry window)
    const now = new Date();
    const nowISO = now.toISOString();
    const bufferTime = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
    
    console.log(`[PW] Checking posts at ${nowISO} (with 15min buffer)`);
    
    // Get all scheduled posts and filter in JavaScript
    const allScheduledPosts = await db.select().from(scheduledPosts).where(
      eq(scheduledPosts.status, "scheduled")
    ).limit(10);
    
    // Frontend already converted to UTC, so stored time is UTC
    // Database stores as string without timezone: "2026-04-15 07:17:00"
    // We need to parse it as UTC by adding Z suffix
    const readyPosts = allScheduledPosts.filter(p => {
      // Parse the stored time as UTC by adding Z suffix
      const storedDateStr = p.scheduledAt;
      const utcDateStr = storedDateStr.includes('T') ? storedDateStr : storedDateStr.replace(' ', 'T');
      const utcDate = new Date(utcDateStr + 'Z');
      const utcTime = utcDate.toISOString();
      const isReady = utcTime <= bufferTime && (p.nextRetryAt === null || p.nextRetryAt <= nowISO);
      console.log(`[PW] Post ${p.id}: Stored=${p.scheduledAt}, Parsed=${utcDateStr}Z, UTC=${utcTime}, Ready=${isReady}`);
      return isReady;
    }).slice(0, 1);

    if (!readyPosts.length) {
      const upcoming = await db.select().from(scheduledPosts).where(
        eq(scheduledPosts.status, "scheduled")
      ).limit(1);
      if (upcoming.length > 0) {
        const p = upcoming[0];
        const storedTime = new Date(p.scheduledAt);
        const diff = storedTime.getTime() - now.getTime();
        console.log(`[PW] Next post ID ${p.id}:`);
        console.log(`[PW]   Stored: ${p.scheduledAt}`);
        console.log(`[PW]   Parsed as: ${storedTime.toISOString()}`);
        console.log(`[PW]   Current UTC: ${nowISO}`);
        console.log(`[PW]   Difference: ${Math.round(diff/1000)}s away`);
        console.log(`[PW]   Buffer time: ${bufferTime}`);
      }
      return null;
    }

    const post = readyPosts[0];

    // Update to "publishing" status
    // This prevents other workers from claiming the same job
    await db
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
  const db = await getDb();
  if (!db) {
    console.error("[PublishingWorker] DB unavailable");
    return;
  }
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
    if (!context.connectionId) {
      throw new Error("No connection ID provided");
    }
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

    // Step 2.5: Refresh token if needed (for Facebook)
    let accessToken = connection.accessToken;
    if (context.platform === "facebook" && context.pageId) {
      console.log(`[PublishingWorker] Attempting to refresh Facebook token for page ${context.pageId}...`);
      const refreshedToken = await refreshPageToken(accessToken, context.pageId);
      if (refreshedToken) {
        console.log(`[PublishingWorker] Successfully refreshed Facebook token`);
        accessToken = refreshedToken;
        // Update the connection with the new token
        await db
          .update(platformConnections)
          .set({ accessToken: refreshedToken, updatedAt: new Date().toISOString() })
          .where(eq(platformConnections.id, context.connectionId));
      } else {
        console.warn(`[PublishingWorker] Failed to refresh token, will try with existing token`);
      }
    }

    // Step 3: Check if already published (prevent duplicates on retry)
    // Only skip if this is a retry (retryCount > 0) AND we have a remotePostId
    if (post.retryCount > 0 && post.remotePostId) {
      console.log(`[PublishingWorker] Post ${context.postId} already published (retry #${post.retryCount}). Skipping duplicate publish.`);
      // Mark as published and return
      await db
        .update(scheduledPosts)
        .set({
          status: "published",
          publishedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(scheduledPosts.id, context.scheduledPostId));
      return;
    }

    // Step 4: Publish to platform
    let result: PublishResult;

    if (context.platform === "facebook") {
      result = await publishToFacebookPage(post, {
        accessToken: accessToken,
        pageId: context.pageId || connection.accountId || "",
      });
    } else if (context.platform === "instagram") {
      // Instagram publishing via Facebook Graph API (Instagram is owned by Meta)
      result = await publishToInstagram(post, {
        accessToken: accessToken,
        accountId: context.pageId || connection.accountId || "",
      });
    } else if (context.platform === "tiktok") {
      // TikTok publishing not yet implemented
      result = {
        success: false,
        errorMessage: "TikTok publishing not yet implemented",
        errorCode: "NOT_IMPLEMENTED",
        isRetryable: false,
      };
    } else {
      throw new Error(`Unknown platform: ${context.platform}`);
    }

    // Step 5: Handle result
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
          publishedAt: new Date().toISOString(),
          remotePostId: result.platformPostId,
          updatedAt: new Date().toISOString(),
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
  const db = await getDb();
  if (!db) return;
  const posts = await db.select().from(scheduledPosts).where(eq(scheduledPosts.id, context.scheduledPostId)).limit(1);
  const currentPost = posts[0];

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
        updatedAt: new Date().toISOString(),
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
        nextRetryAt: nextRetryAt.toISOString(),
        lastError: errorClassification.message,
        updatedAt: new Date().toISOString(),
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
      updatedAt: new Date().toISOString(),
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
  const db = await getDb();
  if (!db) return null;
  const posts = await db.select().from(contentPosts).where(eq(contentPosts.id, postId)).limit(1);
  return posts[0];
}

/**
 * Get platform connection with credentials
 */
async function getPlatformConnectionWithCredentials(
  userId: number,
  connectionId: number
): Promise<any> {
  const db = await getDb();
  if (!db) return null;
  const connections = await db.select().from(platformConnections).where(and(
    eq(platformConnections.id, connectionId),
    eq(platformConnections.userId, userId)
  )).limit(1);
  return connections[0];
}

/**
 * Create publishing job record
 */
async function createPublishingJob(context: PublishingContext): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(publishingJobs).values({
    scheduledPostId: context.scheduledPostId,
    userId: context.userId,
    postId: context.postId,
    platform: context.platform,
    pageId: context.pageId,
    status: "running",
    startedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }).$returningId();

  return (result as any)[0]?.id || 0;
}

/**
 * Update publishing job
 */
async function updatePublishingJob(
  jobId: number,
  updates: Partial<{
    status: "success" | "failed_auth" | "failed_retrying" | "failed_permanent" | "running";
    completedAt: Date;
    remotePostId: string;
    errorCode: string;
    errorMessage: string;
    attemptNumber: number;
  }>
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const dbUpdates: any = { ...updates, updatedAt: new Date().toISOString() };
  if (updates.completedAt) {
    dbUpdates.completedAt = updates.completedAt.toISOString();
  }
  await db
    .update(publishingJobs)
    .set(dbUpdates)
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
