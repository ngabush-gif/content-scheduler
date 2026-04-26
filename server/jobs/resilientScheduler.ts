/**
 * Resilient Scheduler
 * 
 * Runs every minute to check for and publish due posts.
 * This is more reliable than setInterval because:
 * 1. It waits for each publish cycle to complete before scheduling the next
 * 2. It logs all execution and failures
 * 3. It handles errors gracefully without stopping
 * 4. It works on serverless platforms that may restart
 */

import { getDb, updateScheduledPost, getContentPostById, getConnectionWithCredentials } from "../db";
import { scheduledPosts } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { publishToFacebook, publishToInstagram, publishToTikTok } from "../platformPublisher";
import {
  logWorkerCheck,
  logPublishAttempt,
  logPublishSuccess,
  logPublishFailure,
  logMissedWindow,
} from "./schedulerLogger";

// Helper function to deserialize content post hashtags
function deserializeContentPost(post: any) {
  if (!post) return post;
  if (typeof post.hashtags === 'string') {
    try {
      post.hashtags = JSON.parse(post.hashtags);
    } catch (e) {
      const tags = post.hashtags.trim().split(/\s+/).filter((tag: string) => tag.length > 0);
      post.hashtags = tags;
    }
  }
  return post;
}

let isRunning = false;
let lastRunTime = 0;

/**
 * Run one publishing cycle
 * This function:
 * 1. Checks for posts due to be published
 * 2. Publishes the first ready post
 * 3. Logs all actions
 * 4. Returns gracefully on errors
 */
async function runPublishingCycle() {
  if (isRunning) {
    console.log('[ResilientScheduler] Already running, skipping cycle');
    return;
  }

  isRunning = true;
  const cycleStartTime = Date.now();

  try {
    const now = new Date();
    const nowISO = now.toISOString();

    console.log(`[ResilientScheduler] ⏱️ Cycle started at ${nowISO}`);

    // Get database connection
    const db = await getDb();
    if (!db) {
      console.error("[ResilientScheduler] Database unavailable, skipping cycle");
      return;
    }

    // Get all scheduled posts
    const allScheduledPosts = await db
      .select()
      .from(scheduledPosts)
      .where(eq(scheduledPosts.status, "scheduled" as any))
      .limit(10);

    console.log(`[ResilientScheduler] Found ${allScheduledPosts.length} scheduled posts`);

    // Find posts that are due
    const readyPosts = allScheduledPosts.filter((p: any) => {
      const scheduledAtMs = typeof p.scheduledAt === 'number' ? p.scheduledAt : parseInt(p.scheduledAt as string, 10);
      const scheduledAtUTC = new Date(scheduledAtMs);
      const nextRetryDate = p.nextRetryAt ? (typeof p.nextRetryAt === 'string' ? new Date(p.nextRetryAt.includes('T') ? p.nextRetryAt : p.nextRetryAt + 'Z') : p.nextRetryAt) : null;
      const userTz = p.timezoneId || 'Australia/Brisbane';
      const minutesUntilReady = (scheduledAtUTC.getTime() - now.getTime()) / (1000 * 60);

      // Log every check
      logWorkerCheck(p.postId, p.id, scheduledAtMs, userTz, now, scheduledAtUTC <= now && (nextRetryDate === null || nextRetryDate <= now), minutesUntilReady);

      // Check for missed windows
      if (scheduledAtUTC < now && minutesUntilReady < -5) {
        const minutesMissed = Math.abs(minutesUntilReady);
        logMissedWindow(p.postId, p.id, scheduledAtMs, userTz, now, minutesMissed);
      }

      // Post is ready if scheduled time has passed and no retry is pending
      return scheduledAtUTC <= now && (nextRetryDate === null || nextRetryDate <= now);
    }).slice(0, 1);

    if (!readyPosts.length) {
      console.log(`[ResilientScheduler] ✓ No posts ready to publish`);
      lastRunTime = Date.now();
      return;
    }

    // Process the first ready post
    const post = readyPosts[0];
    const userTz = post.timezoneId || 'Australia/Brisbane';
    const scheduledAtMs = typeof post.scheduledAt === 'number' ? post.scheduledAt : parseInt(post.scheduledAt as string, 10);
    const attemptNumber = (post.retryCount || 0) + 1;

    console.log(`[ResilientScheduler] 🔄 Publishing post ${post.id} (attempt ${attemptNumber})`);

    // Log publish attempt
    logPublishAttempt(post.postId, post.id, scheduledAtMs, userTz, post.platform, attemptNumber || 1);

    // Claim the post for publishing
    const db2 = await getDb();
    if (!db2) {
      console.error("[ResilientScheduler] Database unavailable for claiming post");
      return;
    }

    await updateScheduledPost(post.id, {
      status: "publishing",
      publishingStartedAt: new Date().toISOString(),
    });

    // Get content and connection
    const postContent = await getContentPostById(post.postId);
    if (!postContent) {
      console.error(`[ResilientScheduler] Content post ${post.postId} not found`);
      await updateScheduledPost(post.id, {
        status: "failed",
        errorMessage: "Content post not found",
      });
      lastRunTime = Date.now();
      return;
    }

    const connection = await getConnectionWithCredentials(post.connectionId || 0);
    if (!connection) {
      console.error(`[ResilientScheduler] Connection ${post.connectionId} not found`);
      await updateScheduledPost(post.id, {
        status: "failed",
        errorMessage: "Platform connection not found",
      });
      lastRunTime = Date.now();
      return;
    }

    // Prepare publish payload with all fields
    const deserializedContent = deserializeContentPost(postContent);
    const publishPayload = {
      title: deserializedContent.title,
      caption: deserializedContent.caption,
      hashtags: deserializedContent.hashtags,
      script: deserializedContent.script,
      ideas: deserializedContent.ideas,
      fullContent: deserializedContent.fullContent,
      imageUrl: deserializedContent.imageUrl,
      mediaType: deserializedContent.mediaType as 'none' | 'image' | 'video' | null,
    };

    // Publish to platform
    let publishResult: any;
    try {
      if (post.platform === 'facebook') {
        publishResult = await publishToFacebook(publishPayload, { accessToken: connection.accessToken!, pageId: connection.accountId! });
      } else if (post.platform === 'instagram') {
        publishResult = await publishToInstagram(publishPayload, { accessToken: connection.accessToken!, accountId: connection.accountId! });
      } else if (post.platform === 'tiktok') {
        publishResult = await publishToTikTok(publishPayload, { accessToken: connection.accessToken! });
      } else {
        throw new Error(`Unknown platform: ${post.platform}`);
      }

      if (publishResult.success) {
        // Success!
        const publishedAt = new Date().toISOString();
        const delaySeconds = (Date.now() - scheduledAtMs) / 1000;
        
        console.log(`[ResilientScheduler] ✅ Post ${post.id} published successfully to ${post.platform}`);
        
        await updateScheduledPost(post.id, {
          status: "published",
          publishedAt,
          remotePostId: publishResult.platformPostId,
          updatedAt: publishedAt,
        });

        logPublishSuccess(post.id, post.postId, scheduledAtMs, userTz, post.platform, publishResult.platformPostId || '');
      } else {
        // Failure
        console.error(`[ResilientScheduler] ❌ Post ${post.id} failed to publish: ${publishResult.errorMessage}`);
        
        await updateScheduledPost(post.id, {
          status: "failed",
          errorMessage: publishResult.errorMessage,
          updatedAt: new Date().toISOString(),
        });

        logPublishFailure(post.id, post.postId, scheduledAtMs, userTz, post.platform, 'PUBLISH_ERROR', publishResult.errorMessage, attemptNumber);
      }
    } catch (error: any) {
      console.error(`[ResilientScheduler] ❌ Unexpected error publishing post ${post.id}:`, error);
      
      await updateScheduledPost(post.id, {
        status: "failed",
        errorMessage: error?.message || "Unknown error",
        updatedAt: new Date().toISOString(),
      });

      logPublishFailure(post.id, post.postId, scheduledAtMs, userTz, post.platform, 'UNKNOWN_ERROR', error?.message || "Unknown error", attemptNumber);
    }

    lastRunTime = Date.now();
  } catch (error: any) {
    console.error("[ResilientScheduler] Cycle error:", error);
  } finally {
    isRunning = false;
    const cycleDuration = Date.now() - cycleStartTime;
    console.log(`[ResilientScheduler] Cycle completed in ${cycleDuration}ms`);
  }
}

/**
 * Start the resilient scheduler
 * Runs every 60 seconds (1 minute)
 */
export async function startResilientScheduler() {
  console.log("[ResilientScheduler] Starting resilient scheduler (every 60 seconds)");
  
  // Run immediately on start
  await runPublishingCycle();
  
  // Then run every 60 seconds
  setInterval(runPublishingCycle, 60 * 1000);
  
  console.log("[ResilientScheduler] ✓ Scheduler started");
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus() {
  return {
    isRunning,
    lastRunTime,
    lastRunAgo: lastRunTime ? Date.now() - lastRunTime : null,
  };
}
