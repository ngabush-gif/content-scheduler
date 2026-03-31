/**
 * Scheduled Publishing Job
 * Runs periodically to check for posts that are due to be published
 * and automatically publishes them to connected platforms.
 */

import { eq, lte, and } from "drizzle-orm";
import { getDb } from "./db";
import { contentPosts, scheduledPosts, platformConnections, publishLog } from "../drizzle/schema";
import { publishToInstagram, publishToFacebook, publishToTikTok } from "./platformPublisher";

export interface ScheduledPublishingResult {
  postsProcessed: number;
  postsPublished: number;
  postsFailed: number;
  errors: string[];
}

/**
 * Main job: Check for posts due to publish and auto-publish them
 * This should be called periodically (e.g., every 1-5 minutes)
 */
export async function runScheduledPublishingJob(): Promise<ScheduledPublishingResult> {
  const db = await getDb();
  if (!db) {
    return { postsProcessed: 0, postsPublished: 0, postsFailed: 0, errors: ["Database not available"] };
  }

  const result: ScheduledPublishingResult = {
    postsProcessed: 0,
    postsPublished: 0,
    postsFailed: 0,
    errors: [],
  };

  try {
    // Find all scheduled posts that are due (scheduledAt <= now) and not yet published
    const now = new Date();
    const duePosts = await db
      .select()
      .from(scheduledPosts)
      .where(
        and(
          lte(scheduledPosts.scheduledAt, now),
          eq(scheduledPosts.status, "pending")
        )
      )
      .limit(50); // Process max 50 at a time to avoid overload

    result.postsProcessed = duePosts.length;

    for (const scheduled of duePosts) {
      try {
        // Get the post details
        const post = await db
          .select()
          .from(contentPosts)
          .where(eq(contentPosts.id, scheduled.postId))
          .limit(1);

        if (!post || post.length === 0) {
          result.errors.push(`Post ${scheduled.postId} not found`);
          // Mark as failed
          await db
            .update(scheduledPosts)
            .set({ status: "failed", errorMessage: "Post not found" })
            .where(eq(scheduledPosts.id, scheduled.id));
          result.postsFailed++;
          continue;
        }

        const postData = post[0];

        // Get user's platform connection
        const connection = await db
          .select()
          .from(platformConnections)
          .where(
            and(
              eq(platformConnections.userId, postData.authorId),
              eq(platformConnections.platform, scheduled.platform),
              eq(platformConnections.isActive, true)
            )
          )
          .limit(1);

        if (!connection || connection.length === 0) {
          result.errors.push(`No active ${scheduled.platform} connection for user ${postData.authorId}`);
          // Mark as failed
          await db
            .update(scheduledPosts)
            .set({ status: "failed", errorMessage: `No active ${scheduled.platform} connection` })
            .where(eq(scheduledPosts.id, scheduled.id));
          result.postsFailed++;
          continue;
        }

        const conn = connection[0];

        // Publish based on platform
        let publishResult;
        if (scheduled.platform === "instagram") {
          publishResult = await publishToInstagram(
            {
              title: postData.title,
              caption: postData.caption,
              hashtags: postData.hashtags,
              script: postData.script,
              ideas: postData.ideas,
              fullContent: postData.fullContent,
              
            },
            { accessToken: conn.accessToken || "", accountId: conn.accountId || "" }
          );
        } else if (scheduled.platform === "facebook") {
          publishResult = await publishToFacebook(
            {
              title: postData.title,
              caption: postData.caption,
              hashtags: postData.hashtags,
              script: postData.script,
              ideas: postData.ideas,
              fullContent: postData.fullContent,
              
            },
            { accessToken: conn.accessToken || "", pageId: conn.accountId || "" }
          );
        } else if (scheduled.platform === "tiktok") {
          publishResult = await publishToTikTok(
            {
              title: postData.title,
              caption: postData.caption,
              hashtags: postData.hashtags,
              script: postData.script,
              ideas: postData.ideas,
              fullContent: postData.fullContent,
              
            },
            { accessToken: conn.accessToken || "" }
          );
        } else {
          throw new Error(`Unknown platform: ${scheduled.platform}`);
        }

        // Update scheduled post status
        if (publishResult.success) {
          const publishTime = new Date();
          await db
            .update(scheduledPosts)
            .set({
              status: "published",
              publishedAt: publishTime,
            })
            .where(eq(scheduledPosts.id, scheduled.id));

          // Log the publish
          await db.insert(publishLog).values({
            postId: scheduled.postId,
            publishedById: postData.authorId,
            platform: scheduled.platform as any,
            status: "success",
            platformPostId: publishResult.platformPostId,
            publishedAt: publishTime,
          });

          // Update post status to published if all platforms are done
          // (For now, just mark as published when first platform succeeds)
          await db
            .update(contentPosts)
            .set({
              status: "published",
              publishedAt: publishTime,
            })
            .where(eq(contentPosts.id, scheduled.postId));

          result.postsPublished++;
        } else {
          await db
            .update(scheduledPosts)
            .set({
              status: "failed",
              errorMessage: publishResult.errorMessage,
            })
            .where(eq(scheduledPosts.id, scheduled.id));

          // Log the failure
          await db.insert(publishLog).values({
            postId: scheduled.postId,
            publishedById: postData.authorId,
            platform: scheduled.platform as any,
            status: "failed",
            errorMessage: publishResult.errorMessage,
            publishedAt: new Date(),
          });

          result.postsFailed++;
          result.errors.push(`Failed to publish post ${scheduled.postId} to ${scheduled.platform}: ${publishResult.errorMessage}`);
        }
      } catch (err: any) {
        result.postsFailed++;
        result.errors.push(`Error processing scheduled post ${scheduled.id}: ${err?.message}`);

        // Mark as failed
        await db
          .update(scheduledPosts)
          .set({ status: "failed", errorMessage: err?.message ?? "Unknown error" })
          .where(eq(scheduledPosts.id, scheduled.id));
      }
    }
  } catch (err: any) {
    result.errors.push(`Scheduled publishing job error: ${err?.message}`);
  }

  return result;
}

/**
 * Initialize the scheduled publishing job
 * Call this once on server startup to set up periodic execution
 */
export function initializeScheduledPublishingJob() {
  // Run every 2 minutes
  const intervalMs = 2 * 60 * 1000;

  setInterval(async () => {
    try {
      const result = await runScheduledPublishingJob();
      if (result.errors.length > 0) {
        console.warn("[ScheduledPublisher] Job completed with errors:", result);
      } else if (result.postsPublished > 0) {
        console.log("[ScheduledPublisher] Published", result.postsPublished, "posts");
      }
    } catch (err: any) {
      console.error("[ScheduledPublisher] Job failed:", err?.message);
    }
  }, intervalMs);

  console.log("[ScheduledPublisher] Initialized — will run every", intervalMs / 1000, "seconds");
}
