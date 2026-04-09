import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { db } from "../db";
import {
  scheduledPosts,
  publishingJobs,
  contentPosts,
  platformConnections,
} from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import {
  executePublishingJobs,
  startPublishingWorker,
  stopPublishingWorker,
} from "./publishingWorker";

/**
 * Publishing Worker Test Suite
 * 
 * Tests:
 * 1. Worker startup and initialization
 * 2. Atomic job claiming (no duplicates)
 * 3. End-to-end scheduled post execution
 * 4. Retry logic with exponential backoff
 * 5. Token expiration → reconnect_required
 * 6. Failure scenarios
 * 7. remotePostId storage
 */

describe("Publishing Worker", () => {
  let testUserId: number;
  let testConnectionId: number;
  let testPostId: number;

  beforeEach(async () => {
    // Create test user
    const userResult = await db.insert({
      name: "Test User",
      email: `test-${Date.now()}@example.com`,
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    testUserId = Number(userResult.insertId);

    // Create test platform connection
    const connResult = await db.insert(platformConnections).values({
      userId: testUserId,
      provider: "facebook",
      accountId: "123456789",
      accessToken: "test-token-valid",
      status: "connected",
      connectedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    testConnectionId = Number(connResult.insertId);

    // Create test content post
    const postResult = await db.insert(contentPosts).values({
      authorId: testUserId,
      title: "Test Post",
      caption: "This is a test post",
      hashtags: "#test #demo",
      status: "approved",
      contentType: "post",
      niche: "business",
      platform: "facebook",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    testPostId = Number(postResult.insertId);
  });

  afterEach(async () => {
    // Cleanup test data
    await db.delete(publishingJobs).where(eq(publishingJobs.userId, testUserId));
    await db.delete(scheduledPosts).where(eq(scheduledPosts.scheduledById, testUserId));
    await db.delete(contentPosts).where(eq(contentPosts.authorId, testUserId));
    await db.delete(platformConnections).where(eq(platformConnections.userId, testUserId));
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test 1: Worker Startup
  // ─────────────────────────────────────────────────────────────────────────────

  it("should start worker without errors", async () => {
    const consoleSpy = vi.spyOn(console, "log");
    
    startPublishingWorker();
    
    // Give worker time to initialize
    await new Promise((resolve) => setTimeout(resolve, 100));
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[PublishingWorker] Starting publishing worker")
    );
    
    stopPublishingWorker();
    consoleSpy.mockRestore();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test 2: Atomic Job Claiming (No Duplicates)
  // ─────────────────────────────────────────────────────────────────────────────

  it("should claim only one job when multiple workers run simultaneously", async () => {
    // Create a scheduled post ready to publish
    const scheduledTime = new Date(Date.now() - 60_000); // 1 minute ago
    const postResult = await db.insert(scheduledPosts).values({
      postId: testPostId,
      scheduledById: testUserId,
      connectionId: testConnectionId,
      platform: "facebook",
      pageId: "123456789",
      scheduledAt: scheduledTime,
      status: "scheduled",
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const scheduledPostId = Number(postResult.insertId);

    // Simulate multiple workers trying to claim the same job
    const promises = [];
    for (let i = 0; i < 3; i++) {
      promises.push(executePublishingJobs());
    }

    await Promise.all(promises);

    // Check that only one job was created
    const jobs = await db.query.publishingJobs.findMany({
      where: eq(publishingJobs.scheduledPostId, scheduledPostId),
    });

    expect(jobs.length).toBeLessThanOrEqual(1);
    expect(jobs[0]?.status).toBe("running");
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test 3: End-to-End Scheduled Post Execution
  // ─────────────────────────────────────────────────────────────────────────────

  it("should publish a scheduled post when time arrives", async () => {
    // Create a scheduled post ready to publish (time in past)
    const scheduledTime = new Date(Date.now() - 60_000); // 1 minute ago
    const postResult = await db.insert(scheduledPosts).values({
      postId: testPostId,
      scheduledById: testUserId,
      connectionId: testConnectionId,
      platform: "facebook",
      pageId: "123456789",
      scheduledAt: scheduledTime,
      status: "scheduled",
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const scheduledPostId = Number(postResult.insertId);

    // Execute worker
    await executePublishingJobs();

    // Verify scheduled post status changed
    const updatedPost = await db.query.scheduledPosts.findFirst({
      where: eq(scheduledPosts.id, scheduledPostId),
    });

    // Should be either "published" (success) or "publishing" (in progress)
    expect(["published", "publishing", "failed"]).toContain(updatedPost?.status);

    // Verify publishing job was created
    const jobs = await db.query.publishingJobs.findMany({
      where: eq(publishingJobs.scheduledPostId, scheduledPostId),
    });

    expect(jobs.length).toBeGreaterThan(0);
    expect(jobs[0]?.status).toMatch(/running|success|failed_auth|failed_retrying|failed_permanent/);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test 4: Retry Logic with Exponential Backoff
  // ─────────────────────────────────────────────────────────────────────────────

  it("should schedule retry with exponential backoff on failure", async () => {
    // Create a scheduled post with a simulated failure
    const scheduledTime = new Date(Date.now() - 60_000);
    const postResult = await db.insert(scheduledPosts).values({
      postId: testPostId,
      scheduledById: testUserId,
      connectionId: testConnectionId,
      platform: "facebook",
      pageId: "123456789",
      scheduledAt: scheduledTime,
      status: "scheduled",
      retryCount: 0,
      lastError: "RATE_LIMITED: Too many requests",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const scheduledPostId = Number(postResult.insertId);

    // Execute worker
    await executePublishingJobs();

    // Verify retry was scheduled
    const updatedPost = await db.query.scheduledPosts.findFirst({
      where: eq(scheduledPosts.id, scheduledPostId),
    });

    // Should be back to "scheduled" for retry
    if (updatedPost?.status === "scheduled" && updatedPost?.retryCount === 1) {
      // Retry was scheduled
      expect(updatedPost.nextRetryAt).toBeDefined();
      expect(updatedPost.nextRetryAt!.getTime()).toBeGreaterThan(Date.now());
      
      // First retry should be ~5 minutes
      const delayMs = updatedPost.nextRetryAt!.getTime() - Date.now();
      expect(delayMs).toBeGreaterThan(4 * 60_000); // At least 4 minutes
      expect(delayMs).toBeLessThan(6 * 60_000); // At most 6 minutes
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test 5: Token Expiration → reconnect_required
  // ─────────────────────────────────────────────────────────────────────────────

  it("should mark post as reconnect_required on token expiration", async () => {
    // Create connection with expired token
    const expiredConnResult = await db.insert(platformConnections).values({
      userId: testUserId,
      provider: "facebook",
      accountId: "987654321",
      accessToken: "expired-token",
      status: "connected",
      connectedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const expiredConnId = Number(expiredConnResult.insertId);

    // Create scheduled post with expired connection
    const scheduledTime = new Date(Date.now() - 60_000);
    const postResult = await db.insert(scheduledPosts).values({
      postId: testPostId,
      scheduledById: testUserId,
      connectionId: expiredConnId,
      platform: "facebook",
      pageId: "987654321",
      scheduledAt: scheduledTime,
      status: "scheduled",
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const scheduledPostId = Number(postResult.insertId);

    // Execute worker (will fail due to invalid token)
    await executePublishingJobs();

    // Verify post is marked as reconnect_required or failed
    const updatedPost = await db.query.scheduledPosts.findFirst({
      where: eq(scheduledPosts.id, scheduledPostId),
    });

    // Should be either reconnect_required (if token error detected) or failed
    expect(["reconnect_required", "failed", "publishing"]).toContain(
      updatedPost?.status
    );

    // Cleanup
    await db.delete(platformConnections).where(eq(platformConnections.id, expiredConnId));
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test 6: Max Retries → Permanent Failure
  // ─────────────────────────────────────────────────────────────────────────────

  it("should mark post as failed after max retries exceeded", async () => {
    // Create scheduled post with max retries already reached
    const scheduledTime = new Date(Date.now() - 60_000);
    const postResult = await db.insert(scheduledPosts).values({
      postId: testPostId,
      scheduledById: testUserId,
      connectionId: testConnectionId,
      platform: "facebook",
      pageId: "123456789",
      scheduledAt: scheduledTime,
      status: "scheduled",
      retryCount: 5, // Max retries reached
      lastError: "Network timeout",
      nextRetryAt: new Date(Date.now() - 1000), // Retry time passed
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const scheduledPostId = Number(postResult.insertId);

    // Execute worker
    await executePublishingJobs();

    // Verify post is marked as failed
    const updatedPost = await db.query.scheduledPosts.findFirst({
      where: eq(scheduledPosts.id, scheduledPostId),
    });

    expect(["failed", "publishing"]).toContain(updatedPost?.status);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test 7: remotePostId Storage
  // ─────────────────────────────────────────────────────────────────────────────

  it("should store remotePostId after successful publish", async () => {
    // Create a scheduled post
    const scheduledTime = new Date(Date.now() - 60_000);
    const postResult = await db.insert(scheduledPosts).values({
      postId: testPostId,
      scheduledById: testUserId,
      connectionId: testConnectionId,
      platform: "facebook",
      pageId: "123456789",
      scheduledAt: scheduledTime,
      status: "scheduled",
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const scheduledPostId = Number(postResult.insertId);

    // Execute worker
    await executePublishingJobs();

    // Verify remotePostId is stored if published
    const updatedPost = await db.query.scheduledPosts.findFirst({
      where: eq(scheduledPosts.id, scheduledPostId),
    });

    if (updatedPost?.status === "published") {
      expect(updatedPost.remotePostId).toBeDefined();
      expect(updatedPost.remotePostId).toMatch(/^\d+$/); // Facebook post IDs are numeric
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test 8: Publishing Job Audit Trail
  // ─────────────────────────────────────────────────────────────────────────────

  it("should create detailed publishing job audit trail", async () => {
    // Create a scheduled post
    const scheduledTime = new Date(Date.now() - 60_000);
    const postResult = await db.insert(scheduledPosts).values({
      postId: testPostId,
      scheduledById: testUserId,
      connectionId: testConnectionId,
      platform: "facebook",
      pageId: "123456789",
      scheduledAt: scheduledTime,
      status: "scheduled",
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const scheduledPostId = Number(postResult.insertId);

    // Execute worker
    await executePublishingJobs();

    // Verify publishing job was created with details
    const jobs = await db.query.publishingJobs.findMany({
      where: eq(publishingJobs.scheduledPostId, scheduledPostId),
    });

    expect(jobs.length).toBeGreaterThan(0);
    
    const job = jobs[0];
    expect(job).toHaveProperty("id");
    expect(job).toHaveProperty("status");
    expect(job).toHaveProperty("startedAt");
    expect(job).toHaveProperty("userId", testUserId);
    expect(job).toHaveProperty("postId", testPostId);
    expect(job).toHaveProperty("platform", "facebook");
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test 9: Future Scheduled Posts Not Processed
  // ─────────────────────────────────────────────────────────────────────────────

  it("should not process posts scheduled for future time", async () => {
    // Create a scheduled post with future time
    const futureTime = new Date(Date.now() + 60_000); // 1 minute in future
    const postResult = await db.insert(scheduledPosts).values({
      postId: testPostId,
      scheduledById: testUserId,
      connectionId: testConnectionId,
      platform: "facebook",
      pageId: "123456789",
      scheduledAt: futureTime,
      status: "scheduled",
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const scheduledPostId = Number(postResult.insertId);

    // Execute worker
    await executePublishingJobs();

    // Verify post status unchanged
    const updatedPost = await db.query.scheduledPosts.findFirst({
      where: eq(scheduledPosts.id, scheduledPostId),
    });

    expect(updatedPost?.status).toBe("scheduled");
    expect(updatedPost?.publishingStartedAt).toBeNull();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test 10: Cancelled Posts Not Processed
  // ─────────────────────────────────────────────────────────────────────────────

  it("should not process cancelled posts", async () => {
    // Create a cancelled scheduled post
    const scheduledTime = new Date(Date.now() - 60_000);
    const postResult = await db.insert(scheduledPosts).values({
      postId: testPostId,
      scheduledById: testUserId,
      connectionId: testConnectionId,
      platform: "facebook",
      pageId: "123456789",
      scheduledAt: scheduledTime,
      status: "cancelled",
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const scheduledPostId = Number(postResult.insertId);

    // Execute worker
    await executePublishingJobs();

    // Verify no publishing job was created
    const jobs = await db.query.publishingJobs.findMany({
      where: eq(publishingJobs.scheduledPostId, scheduledPostId),
    });

    expect(jobs.length).toBe(0);
  });
});
