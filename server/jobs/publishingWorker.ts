import { getDb, updateScheduledPost, getContentPostById, getConnectionWithCredentials } from "../db";
import { scheduledPosts, contentPosts } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { publishToFacebook, publishToInstagram, publishToTikTok } from "../platformPublisher";

const WORKER_INTERVAL_MS = 30000; // Check every 30 seconds

export async function startPublishingWorker() {
  console.log("[PublishingWorker] Starting publishing worker...");

  // Run immediately on start
  await runPublishingCycle();

  // Then run on interval
  setInterval(runPublishingCycle, WORKER_INTERVAL_MS);
}

async function runPublishingCycle() {
  try {
    const db = await getDb();
    if (!db) {
      console.warn("[PublishingWorker] Database unavailable, skipping cycle");
      return;
    }

    const now = new Date();
    const nowISO = now.toISOString();
    const nowMs = now.getTime();

    // Get all scheduled posts
    const allScheduledPosts = await db
      .select()
      .from(scheduledPosts)
      .where(
        eq(scheduledPosts.status, "scheduled" as any)
      ).limit(10);

    // Filter for posts ready to publish (scheduledAt <= now)
    // scheduledAt is now stored as Unix milliseconds (UTC), no timezone conversion needed
    const readyPosts = allScheduledPosts.filter((p: any) => {
      const scheduledAtMs = typeof p.scheduledAt === 'number' ? p.scheduledAt : parseInt(p.scheduledAt as string, 10);
      const scheduledAtUTC = new Date(scheduledAtMs);
      const nextRetryDate = p.nextRetryAt ? (typeof p.nextRetryAt === 'string' ? new Date(p.nextRetryAt.includes('T') ? p.nextRetryAt : p.nextRetryAt + 'Z') : p.nextRetryAt) : null;
      const isReady = scheduledAtUTC <= now && (nextRetryDate === null || nextRetryDate <= now);
      // Post ready status determined
      return isReady;
    }).slice(0, 1);

    if (!readyPosts.length) {
      const upcoming = await db.select().from(scheduledPosts).where(
        eq(scheduledPosts.status, "scheduled" as any)
      ).limit(1);
      if (upcoming.length > 0) {
        const p = upcoming[0];
        const scheduledAtMs = typeof p.scheduledAt === 'number' ? p.scheduledAt : parseInt(p.scheduledAt as string, 10);
        const scheduledAtUTC = new Date(scheduledAtMs);
        const diff = scheduledAtUTC.getTime() - now.getTime();
        console.log(`[PW] Next post ID ${p.id}:`);
        console.log(`[PW]   ScheduledAt: ${scheduledAtMs}ms`);
        console.log(`[PW]   ScheduledAt (UTC): ${scheduledAtUTC.toISOString()}`);
        console.log(`[PW]   Current UTC: ${nowISO}`);
        console.log(`[PW]   Difference: ${Math.round(diff/1000)}s away`);
      }
      return;
    }

    // Process the first ready post
    const post = readyPosts[0];
    console.log(`[PublishingWorker] 🔄 Processing post ${post.id}...`);

    // Claim the post for publishing (atomic operation)
    const db2 = await getDb();
    if (!db2) {
      console.error("[PublishingWorker] Database unavailable when claiming post");
      return;
    }

    const claimed = await db2.update(scheduledPosts)
      .set({ status: 'publishing' as any, updatedAt: new Date().toISOString() })
      .where(eq(scheduledPosts.id, post.id));

    if (!claimed) {
      console.log(`[PublishingWorker] Post ${post.id} already claimed by another worker`);
      return;
    }

    // Get connection details
    const connection = await getConnectionWithCredentials(post.connectionId || 1);
    if (!connection) {
      console.error(`[PublishingWorker] Connection ${post.connectionId} not found`);
      await updateScheduledPost(post.id, {
        status: 'failed',
        errorMessage: 'Platform connection not found',
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    // Get full post content
    const db3 = await getDb();
    if (!db3) {
      console.error("[PublishingWorker] Database unavailable when fetching post content");
      return;
    }
    const fullPostResult = await db3.select().from(contentPosts).where(eq(contentPosts.id, post.postId)).limit(1);
    if (!fullPostResult || fullPostResult.length === 0) {
      console.error(`[PublishingWorker] Post ${post.postId} not found`);
      await updateScheduledPost(post.id, {
        status: 'failed',
        errorMessage: 'Post content not found',
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    const postContent = fullPostResult[0];
    const publishPayload = {
      title: postContent.title,
      caption: postContent.caption,
      hashtags: postContent.hashtags,
      script: postContent.script,
      ideas: postContent.ideas,
      fullContent: postContent.fullContent,
      imageUrl: postContent.imageUrl,
      mediaType: postContent.mediaType as 'none' | 'image' | 'video' | null,
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
    } catch (error: any) {
      console.error(`[PublishingWorker] Publish error:`, error);
      publishResult = {
        success: false,
        errorCode: error.code || 'UNKNOWN_ERROR',
        errorMessage: error.message || 'Unknown error',
      };
    }

    // Update scheduled post status
    if (publishResult?.success) {
      console.log(`[PublishingWorker] ✅ Published post ${post.id} {`);
      console.log(`  scheduledPostId: ${post.id},`);
      console.log(`  platformPostId: ${publishResult.platformPostId},`);
      console.log(`  platform: ${post.platform}`);
      console.log(`}`);

      await updateScheduledPost(post.id, {
        status: 'published',
        publishedAt: new Date().toISOString(),
        remotePostId: publishResult.platformPostId,
        updatedAt: new Date().toISOString(),
      });
    } else {
      console.error(`[PublishingWorker] ❌ Publish failed for post ${post.id}:`, publishResult?.errorMessage);
      await updateScheduledPost(post.id, {
        status: 'failed',
        errorMessage: publishResult?.errorMessage || 'Unknown error',
        updatedAt: new Date().toISOString(),
      });
    }

    console.log(`[PublishingWorker] Publishing completed in ${Date.now() - now.getTime()}ms`);
    console.log(`[PublishingWorker] Cycle completed {`);
    console.log(`  timestamp: '${new Date().toISOString()}',`);
    console.log(`  processed: 1,`);
    console.log(`  successful: ${publishResult?.success ? 1 : 0},`);
    console.log(`  failed: ${publishResult?.success ? 0 : 1},`);
    console.log(`  durationMs: ${Date.now() - now.getTime()}`);
    console.log(`}`);
  } catch (error) {
    console.error("[PublishingWorker] Cycle error:", error);
  }
}
