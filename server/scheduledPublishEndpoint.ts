/**
 * Scheduled Publish Endpoint
 * 
 * This endpoint is called by Manus scheduled tasks every minute.
 * It checks for posts that are due to be published and publishes them.
 * 
 * This replaces the unreliable in-process setInterval worker.
 * 
 * Endpoint: POST /api/scheduled/publish-due-posts
 * Authentication: Uses platform-provided scheduled task cookie
 * Frequency: Every minute (configured via Manus schedule tool)
 */

import { Express } from "express";
import { getDb, updateScheduledPost, getContentPostById, getConnectionWithCredentials } from "./db";
import { scheduledPosts } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { publishToFacebook, publishToInstagram, publishToTikTok } from "./platformPublisher";
import {
  logWorkerCheck,
  logPublishAttempt,
  logPublishSuccess,
  logPublishFailure,
  logMissedWindow,
} from "./jobs/schedulerLogger";

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

export function registerScheduledPublishEndpoint(app: Express) {
  /**
   * POST /api/scheduled/publish-due-posts
   * 
   * Called by Manus scheduled tasks every minute.
   * Publishes any posts that are due.
   */
  app.post("/api/scheduled/publish-due-posts", async (req, res) => {
    try {
      const startTime = Date.now();
      const now = new Date();
      const nowISO = now.toISOString();
      
      console.log(`[ScheduledPublish] Cycle started at ${nowISO}`);

      // Get database connection
      const db = await getDb();
      if (!db) {
        console.error("[ScheduledPublish] Database unavailable");
        return res.status(503).json({ error: "Database unavailable" });
      }

      // Get all scheduled posts
      const allScheduledPosts = await db
        .select()
        .from(scheduledPosts)
        .where(eq(scheduledPosts.status, "scheduled" as any))
        .limit(10);

      console.log(`[ScheduledPublish] Found ${allScheduledPosts.length} scheduled posts`);

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
        if (scheduledAtUTC > now && minutesUntilReady < -5) {
          const minutesMissed = Math.abs(minutesUntilReady);
          logMissedWindow(p.postId, p.id, scheduledAtMs, userTz, now, minutesMissed);
        }

        // Post is ready if scheduled time has passed and no retry is pending
        return scheduledAtUTC <= now && (nextRetryDate === null || nextRetryDate <= now);
      }).slice(0, 1);

      if (!readyPosts.length) {
        console.log(`[ScheduledPublish] No posts ready to publish`);
        const duration = Date.now() - startTime;
        return res.json({ success: true, postsPublished: 0, durationMs: duration });
      }

      // Process the first ready post
      const post = readyPosts[0];
      const userTz = post.timezoneId || 'Australia/Brisbane';
      const scheduledAtMs = typeof post.scheduledAt === 'number' ? post.scheduledAt : parseInt(post.scheduledAt as string, 10);
      const attemptNumber = (post.retryCount || 0) + 1;

      console.log(`[ScheduledPublish] Publishing post ${post.id} (attempt ${attemptNumber})`);

      // Log publish attempt
      logPublishAttempt(post.postId, post.id, scheduledAtMs, userTz, post.platform, attemptNumber || 1);

      // Claim the post for publishing
      const db2 = await getDb();
      if (!db2) {
        console.error("[ScheduledPublish] Database unavailable for claiming post");
        return res.status(503).json({ error: "Database unavailable" });
      }

      await updateScheduledPost(post.id, {
        status: "publishing",
        publishingStartedAt: new Date().toISOString(),
      });

      // Get content and connection
      const postContent = await getContentPostById(post.postId);
      if (!postContent) {
        console.error(`[ScheduledPublish] Content post ${post.postId} not found`);
        await updateScheduledPost(post.id, {
          status: "failed",
          errorMessage: "Content post not found",
        });
        return res.status(404).json({ error: "Content post not found" });
      }

      const connection = await getConnectionWithCredentials(post.connectionId || 0);
      if (!connection) {
        console.error(`[ScheduledPublish] Connection ${post.connectionId} not found`);
        await updateScheduledPost(post.id, {
          status: "failed",
          errorMessage: "Platform connection not found",
        });
        return res.status(404).json({ error: "Connection not found" });
      }

      // Prepare publish payload
      // Deserialize hashtags if needed
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
          publishResult = await publishToFacebook(publishPayload, { accessToken: connection.accessToken!, pageId: connection.accountId || '' });
        } else if (post.platform === 'instagram') {
          publishResult = await publishToInstagram(publishPayload, { accessToken: connection.accessToken!, accountId: connection.accountId! });
        } else if (post.platform === 'tiktok') {
          publishResult = await publishToTikTok(publishPayload, { accessToken: connection.accessToken! });
        } else {
          throw new Error(`Unknown platform: ${post.platform}`);
        }
      } catch (error: any) {
        console.error(`[ScheduledPublish] Publish error:`, error);
        publishResult = {
          success: false,
          errorCode: error.code || 'UNKNOWN_ERROR',
          errorMessage: error.message || 'Unknown error',
        };

        logPublishFailure(
          post.postId,
          post.id,
          scheduledAtMs,
          userTz,
          post.platform,
          publishResult.errorCode,
          publishResult.errorMessage,
          attemptNumber
        );
      }

      // Update scheduled post status
      if (publishResult?.success) {
        console.log(`[ScheduledPublish] ✅ Published post ${post.id}`);

        logPublishSuccess(
          post.postId,
          post.id,
          scheduledAtMs,
          userTz,
          post.platform,
          publishResult.platformPostId,
          publishResult.facebookTimestamp
        );

        const db3 = await getDb();
        if (db3) {
          await updateScheduledPost(post.id, {
            status: 'published',
            publishedAt: new Date().toISOString(),
            remotePostId: publishResult.platformPostId,
          });
        }

        const duration = Date.now() - startTime;
        return res.json({
          success: true,
          postsPublished: 1,
          postId: post.id,
          platformPostId: publishResult.platformPostId,
          durationMs: duration,
        });
      } else {
        console.error(`[ScheduledPublish] ❌ Failed to publish post ${post.id}:`, publishResult?.errorMessage);

        const db3 = await getDb();
        if (db3) {
          await updateScheduledPost(post.id, {
            status: 'failed',
            errorMessage: publishResult?.errorMessage || 'Unknown error',
            retryCount: attemptNumber || 1,
          });
        }

        const duration = Date.now() - startTime;
        return res.status(500).json({
          success: false,
          error: publishResult?.errorMessage,
          durationMs: duration,
        });
      }
    } catch (error: any) {
      console.error("[ScheduledPublish] Unexpected error:", error);
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  });
}
