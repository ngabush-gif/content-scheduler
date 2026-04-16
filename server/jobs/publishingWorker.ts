import { getDb, getConnectionWithCredentials, getContentPostById } from "../db";
import { scheduledPosts, platformConnections, publishLog } from "../../drizzle/schema";
import { eq, and, lte } from "drizzle-orm";

import { publishToFacebookPage, publishToInstagram } from "../platformPublisher";
import { getTokenInfo, refreshPageToken } from "../facebookOAuth";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

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
}

interface ErrorClassification {
  code: string;
  message: string;
  isRetryable: boolean;
  isAuthError?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PUBLISHING LOOP
// ─────────────────────────────────────────────────────────────────────────────

export async function startPublishingWorker(): Promise<void> {
  console.log("[PublishingWorker] Starting publishing worker...");

  // Run immediately, then every 60 seconds
  await executePublishingJobs();

  setInterval(async () => {
    try {
      await executePublishingJobs();
    } catch (error) {
      console.error("[PublishingWorker] Cycle error:", error);
    }
  }, 60000);
}

async function executePublishingJobs(): Promise<void> {
  const db = await getDb() as any;
  if (!db) {
    console.error("[PublishingWorker] DB unavailable");
    return;
  }

  const cycleStartTime = new Date();
  const processedCount = { count: 0 };
  const successCount = { count: 0 };
  const errorCount = { count: 0 };

  console.log(`[PublishingWorker] Cycle started at ${cycleStartTime.toISOString()}`);

  // RECOVERY: Reset jobs stuck in "publishing" for >2 minutes
  const stuckThreshold = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes ago
  try {
    const stuckJobs = await db.select().from(scheduledPosts).where(
      and(
        eq(scheduledPosts.status, "publishing" as any),
        lte(scheduledPosts.publishingStartedAt, stuckThreshold.toISOString())
      )
    ).limit(10);

    for (const job of stuckJobs) {
      console.warn(`[PublishingWorker] 🔄 Recovering stuck job ${job.id} (stuck for >2 minutes)`);
      await db
        .update(scheduledPosts)
        .set({
          status: "failed",
          lastError: "Publishing timeout: job stuck in publishing state for >2 minutes",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(scheduledPosts.id, job.id));
      errorCount.count++;
    }
  } catch (recoveryErr) {
    console.error("[PublishingWorker] Recovery logic error:", recoveryErr);
  }

  // Get scheduled posts ready to publish
  const now = new Date();
  const nowISO = now.toISOString();

  console.log(`[PW] Checking posts at ${nowISO} (with 15min buffer)`);

  const allScheduledPosts = await db
    .select()
    .from(scheduledPosts)
    .where(
      eq(scheduledPosts.status, "scheduled" as any)
    ).limit(10);

  // Filter for posts ready to publish (scheduledAt <= now)
  // Frontend now uses Luxon to correctly convert AEST -> UTC, so no offset correction needed
  // IMPORTANT: scheduledAt is stored as MySQL TIMESTAMP string (e.g., "2026-04-16 04:36:00")
  // We must parse it as UTC, not local time
  const readyPosts = allScheduledPosts.filter((p: any) => {
    // Parse the string timestamp as UTC by appending Z
    const scheduledAtStr = typeof p.scheduledAt === 'string' ? p.scheduledAt : p.scheduledAt?.toString?.() || '';
    const scheduledAtUTC = scheduledAtStr.includes('T')
      ? new Date(scheduledAtStr)  // Already ISO format
      : new Date(scheduledAtStr + 'Z');  // MySQL format, append Z to parse as UTC

    const nextRetryDate = p.nextRetryAt ? (typeof p.nextRetryAt === 'string' ? new Date(p.nextRetryAt.includes('T') ? p.nextRetryAt : p.nextRetryAt + 'Z') : p.nextRetryAt) : null;
    const isReady = scheduledAtUTC <= now && (nextRetryDate === null || nextRetryDate <= now);
    console.log(`[PW] Post ${p.id}: ScheduledAt=${p.scheduledAt}, ScheduledAtUTC=${scheduledAtUTC.toISOString()}, Now=${nowISO}, Ready=${isReady}`);
    return isReady;
  }).slice(0, 1);

  if (!readyPosts.length) {
    const upcoming = await db.select().from(scheduledPosts).where(
      eq(scheduledPosts.status, "scheduled" as any)
    ).limit(1);
    if (upcoming.length > 0) {
      const p = upcoming[0];
      // Parse the string timestamp as UTC
      const scheduledAtStr = typeof p.scheduledAt === 'string' ? p.scheduledAt : p.scheduledAt?.toString?.() || '';
      const storedDateUTC = scheduledAtStr.includes('T')
        ? new Date(scheduledAtStr)
        : new Date(scheduledAtStr + 'Z');
      const diff = storedDateUTC.getTime() - now.getTime();
      console.log(`[PW] Next post ID ${p.id}:`);
      console.log(`[PW]   ScheduledAt: ${p.scheduledAt}`);
      console.log(`[PW]   ScheduledAt (UTC): ${storedDateUTC.toISOString()}`);
      console.log(`[PW]   Current UTC: ${nowISO}`);
      console.log(`[PW]   Difference: ${Math.round(diff/1000)}s away`);
    }
    return;
  }

  // Try to claim the first ready post
  const post = readyPosts[0];
  const claimedPost = await claimScheduledPost(post.id);

  if (!claimedPost) {
    console.log(`[PW] Post ${post.id} already claimed by another worker. Skipping.`);
    return;
  }

  processedCount.count++;

  // Publish the claimed post
  try {
    await publishScheduledPost(claimedPost);
    successCount.count++;
  } catch (error) {
    console.error(`[PublishingWorker] Publishing error for post ${claimedPost.scheduledPostId}:`, error);
    errorCount.count++;
  }

  const cycleEndTime = new Date();
  const durationMs = cycleEndTime.getTime() - cycleStartTime.getTime();

  console.log(`[PublishingWorker] Cycle completed`, {
    timestamp: cycleEndTime.toISOString(),
    processed: processedCount.count,
    successful: successCount.count,
    failed: errorCount.count,
    durationMs,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CLAIM A SCHEDULED POST (ATOMIC)
// ─────────────────────────────────────────────────────────────────────────────

async function claimScheduledPost(postId: number): Promise<PublishingContext | null> {
  const db = await getDb() as any;
  if (!db) {
    console.error("[PublishingWorker] DB unavailable");
    return null;
  }

  // Atomic compare-and-swap: only update if status is still "scheduled"
  const updateResult = await db
    .update(scheduledPosts)
    .set({
      status: "publishing",
      publishingStartedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(and(
      eq(scheduledPosts.id, postId),
      eq(scheduledPosts.status, "scheduled" as any)
    ));

  if ((updateResult as any).rowsAffected === 0) {
    console.log(`[PW] Post ${postId} already claimed by another worker. Skipping.`);
    return null;  // Another worker already claimed this job
  }

  // Fetch the post to return context
  const posts = await db.select().from(scheduledPosts).where(eq(scheduledPosts.id, postId)).limit(1);
  const post = posts[0];

  if (!post) {
    console.error(`[PW] Post ${postId} not found after claiming`);
    return null;
  }

  console.log(`[PW] ✅ Claimed post ${postId} for publishing`);

  // Parse scheduledAt as UTC
  const scheduledAtStr = typeof post.scheduledAt === 'string' ? post.scheduledAt : post.scheduledAt?.toString?.() || '';
  const scheduledAtUTC = scheduledAtStr.includes('T')
    ? new Date(scheduledAtStr)
    : new Date(scheduledAtStr + 'Z');

  return {
    scheduledPostId: post.id,
    postId: post.postId,
    userId: post.scheduledById,
    connectionId: post.connectionId,
    platform: post.platform as any,
    pageId: post.pageId,
    scheduledAt: scheduledAtUTC,
  };
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

  const publishStartTime = Date.now();
  const PUBLISH_TIMEOUT_MS = 30000; // 30 second timeout

  try {
    console.log(`[PublishingWorker] 🚀 Starting publish for post ${context.postId} to ${context.platform}`, {
      scheduledPostId: context.scheduledPostId,
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
    const connection = await getConnectionWithCredentials(
      context.connectionId
    );

    if (!connection) {
      throw new Error("Platform connection not found");
    }

    if (!connection.accessToken) {
      throw new Error("No access token found for connection");
    }

    // Step 2.5: Log token context and refresh if needed (for Facebook)
    let accessToken = connection.accessToken;

    // Log token details for debugging
    const tokenInfo = await getTokenInfo(accessToken);
    console.log(`[PublishingWorker] Token Context:`, {
      connectionId: context.connectionId,
      platform: context.platform,
      pageId: context.pageId,
      accountId: connection.accountId,
      tokenType: tokenInfo?.type,
      tokenValid: tokenInfo?.isValid,
      tokenExpires: tokenInfo?.expiresAt,
      tokenScopes: tokenInfo?.scopes,
      tokenError: tokenInfo?.error,
    });

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
    const scheduledPost = await db.select().from(scheduledPosts).where(eq(scheduledPosts.id, context.scheduledPostId)).limit(1);
    const currentScheduledPost = scheduledPost[0];

    if (currentScheduledPost?.remotePostId || currentScheduledPost?.status === 'published') {
      console.log(`[PublishingWorker] ⏭️  Post ${context.postId} already published. Skipping duplicate publish.`, {
        scheduledPostId: context.scheduledPostId,
        remotePostId: currentScheduledPost?.remotePostId,
        status: currentScheduledPost?.status,
      });
      // Mark as published if not already
      if (currentScheduledPost?.status !== 'published') {
        await db
          .update(scheduledPosts)
          .set({
            status: "published",
            publishedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(scheduledPosts.id, context.scheduledPostId));
      }
      return;  // Already published, skip
    }

    // Step 4: Publish to platform with timeout protection
    let result: PublishResult;

    if (context.platform === "facebook") {
      const fbPageId = context.pageId || connection.accountId || "";
      console.log(`[PublishingWorker] 🚀 Starting Facebook publish with:`, {
        pageId: fbPageId,
        connectionAccountId: connection.accountId,
        postId: context.postId,
        scheduledPostId: context.scheduledPostId,
      });

      // Wrap in timeout promise
      const publishPromise = publishToFacebookPage(post, {
        accessToken: accessToken,
        pageId: fbPageId,
      });

      const timeoutPromise = new Promise<PublishResult>((_, reject) =>
        setTimeout(() => reject(new Error('Facebook publish timeout (>30s)')), PUBLISH_TIMEOUT_MS)
      );

      try {
        result = await Promise.race([publishPromise, timeoutPromise]);
        console.log(`[PublishingWorker] ✅ Facebook publish succeeded`);
      } catch (timeoutErr: any) {
        console.error(`[PublishingWorker] ❌ Facebook publish failed:`, timeoutErr.message);
        throw timeoutErr;
      }
    } else if (context.platform === "instagram") {
      // Instagram publishing via Facebook Graph API
      const igAccountId = context.pageId || connection.accountId || "";
      console.log(`[PublishingWorker] 🚀 Starting Instagram publish with:`, {
        accountId: igAccountId,
        connectionAccountId: connection.accountId,
        postId: context.postId,
        scheduledPostId: context.scheduledPostId,
      });

      const publishPromise = publishToInstagram(post, {
        accessToken: accessToken,
        accountId: igAccountId,
      });

      const timeoutPromise = new Promise<PublishResult>((_, reject) =>
        setTimeout(() => reject(new Error('Instagram publish timeout (>30s)')), PUBLISH_TIMEOUT_MS)
      );

      try {
        result = await Promise.race([publishPromise, timeoutPromise]);
        console.log(`[PublishingWorker] ✅ Instagram publish succeeded`);
      } catch (timeoutErr: any) {
        console.error(`[PublishingWorker] ❌ Instagram publish failed:`, timeoutErr.message);
        throw timeoutErr;
      }
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
    console.log(`[PublishingWorker] Publish result:`, {
      success: result.success,
      platformPostId: result.platformPostId,
      errorMessage: result.errorMessage,
      errorCode: result.errorCode,
    });

    if (result.success && result.platformPostId) {
      // SUCCESS: Mark as published
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
      // FAILURE: Classify error and mark as failed
      const errorClassification = classifyError(
        result.errorMessage || "Unknown error",
        result.errorCode
      );

      await handlePublishingFailure(
        context,
        errorClassification
      );
    }
  } catch (error: any) {
    // Unhandled error during publishing
    console.error(`[PublishingWorker] ❌ Unhandled error:`, error);

    const errorClassification = classifyError(
      error?.message ?? "Unknown error",
      undefined
    );

    await handlePublishingFailure(
      context,
      errorClassification
    );
  }

  const publishDurationMs = Date.now() - publishStartTime;
  console.log(`[PublishingWorker] Publishing completed in ${publishDurationMs}ms`);
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
    };
  }

  // Rate limit errors: retryable
  if (
    errorCode === "RATE_LIMITED" ||
    lowerMessage.includes("rate limit") ||
    lowerMessage.includes("429")
  ) {
    return {
      code: "RATE_LIMITED",
      message: "Rate limited by platform",
      isRetryable: true,
    };
  }

  // Network errors: retryable
  if (
    lowerMessage.includes("timeout") ||
    lowerMessage.includes("econnrefused") ||
    lowerMessage.includes("network")
  ) {
    return {
      code: "NETWORK_ERROR",
      message: "Network error",
      isRetryable: true,
    };
  }

  // Permission errors: not retryable
  if (
    lowerMessage.includes("permission") ||
    lowerMessage.includes("forbidden") ||
    lowerMessage.includes("403")
  ) {
    return {
      code: "PERMISSION_DENIED",
      message: "Insufficient permissions",
      isRetryable: false,
    };
  }

  // Default: not retryable
  return {
    code: "UNKNOWN_ERROR",
    message: errorMessage,
    isRetryable: false,
  };
}

/**
 * Handle publishing failure: log error and decide on retry
 */
async function handlePublishingFailure(
  context: PublishingContext,
  errorClassification: ErrorClassification
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  console.error(`[PublishingWorker] ❌ Publishing failed for post ${context.postId}:`, {
    errorCode: errorClassification.code,
    errorMessage: errorClassification.message,
    isRetryable: errorClassification.isRetryable,
    isAuthError: errorClassification.isAuthError,
  });

  if (errorClassification.isRetryable) {
    // Retryable error: schedule for retry
    const retryCount = (await db.select().from(scheduledPosts).where(eq(scheduledPosts.id, context.scheduledPostId)).limit(1))[0]?.retryCount || 0;
    const nextRetryDelaySeconds = Math.min(300, 60 * Math.pow(2, retryCount)); // Exponential backoff: 60s, 120s, 240s, max 300s
    const nextRetryAt = new Date(Date.now() + nextRetryDelaySeconds * 1000);

    await db
      .update(scheduledPosts)
      .set({
        status: "scheduled",
        retryCount: retryCount + 1,
        nextRetryAt: nextRetryAt.toISOString(),
        lastError: errorClassification.message,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(scheduledPosts.id, context.scheduledPostId));

    console.log(`[PublishingWorker] 🔄 Scheduled retry for post ${context.postId}`, {
      retryCount: retryCount + 1,
      nextRetryAt: nextRetryAt.toISOString(),
      delaySeconds: nextRetryDelaySeconds,
    });
  } else {
    // Non-retryable error: mark as failed
    const status = errorClassification.isAuthError ? "reconnect_required" : "failed";

    await db
      .update(scheduledPosts)
      .set({
        status: status as any,
        lastError: errorClassification.message,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(scheduledPosts.id, context.scheduledPostId));

    console.log(`[PublishingWorker] ❌ Marked post ${context.postId} as ${status}:`, {
      errorCode: errorClassification.code,
      errorMessage: errorClassification.message,
    });
  }
}
