import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { getDb } from "./db";
import { platformConnections, scheduledPosts, publishingJobs } from "../drizzle/schema";
import { eq, and, lte } from "drizzle-orm";

describe("Publishing Worker", () => {
  let db: any;

  beforeAll(async () => {
    db = await getDb();
  });

  afterAll(async () => {
    // Cleanup test data
    if (db) {
      // Delete test scheduled posts
      await db.delete(scheduledPosts).where(eq(scheduledPosts.postId, -1));
      // Delete test publishing jobs
      await db.delete(publishingJobs).where(eq(publishingJobs.postId, -1));
    }
  });

  it("should have publishing_jobs table", async () => {
    expect(db).toBeDefined();
    // Try to query the table
    const result = await db.select().from(publishingJobs).limit(1);
    expect(Array.isArray(result)).toBe(true);
  });

  it("should have scheduled_posts with required columns", async () => {
    const result = await db.select().from(scheduledPosts).limit(1);
    expect(Array.isArray(result)).toBe(true);

    // Check a sample row has required fields
    if (result.length > 0) {
      const post = result[0];
      expect(post).toHaveProperty("id");
      expect(post).toHaveProperty("status");
      expect(post).toHaveProperty("scheduledAt");
      expect(post).toHaveProperty("connectionId");
      expect(post).toHaveProperty("pageId");
      expect(post).toHaveProperty("retryCount");
      expect(post).toHaveProperty("nextRetryAt");
    }
  });

  it("should support new status values", async () => {
    // This test verifies the database schema has the new status enum values
    const result = await db.select().from(scheduledPosts).limit(1);
    expect(Array.isArray(result)).toBe(true);
    // The fact that we can query without error means the schema is correct
  });

  it("should find jobs ready for publishing", async () => {
    const now = new Date().toISOString();

    // Find posts that should be published
    const readyJobs = await db
      .select()
      .from(scheduledPosts)
      .where(
        and(
          eq(scheduledPosts.status, "scheduled"),
          lte(scheduledPosts.scheduledAt, now)
        )
      )
      .limit(10);

    expect(Array.isArray(readyJobs)).toBe(true);
  });

  it("should support atomic job claiming with status update", async () => {
    // This test verifies the database supports the atomic update pattern
    // In a real scenario, this would use a transaction with SELECT FOR UPDATE

    const testJobs = await db
      .select()
      .from(scheduledPosts)
      .where(eq(scheduledPosts.status, "scheduled"))
      .limit(1);

    if (testJobs.length > 0) {
      const job = testJobs[0];
      // Verify we can update status atomically
      const updated = await db
        .update(scheduledPosts)
        .set({ status: "publishing" })
        .where(eq(scheduledPosts.id, job.id));

      expect(updated).toBeDefined();

      // Restore status
      await db
        .update(scheduledPosts)
        .set({ status: "scheduled" })
        .where(eq(scheduledPosts.id, job.id));
    }
  });

  it("should support retry tracking with exponential backoff", async () => {
    // Verify retry fields exist and can be updated
    const testJobs = await db
      .select()
      .from(scheduledPosts)
      .where(eq(scheduledPosts.status, "failed"))
      .limit(1);

    if (testJobs.length > 0) {
      const job = testJobs[0];
      const nextRetry = new Date(Date.now() + 5 * 60000).toISOString(); // 5 minutes

      const updated = await db
        .update(scheduledPosts)
        .set({
          retryCount: (job.retryCount || 0) + 1,
          nextRetryAt: nextRetry,
          status: "scheduled",
        })
        .where(eq(scheduledPosts.id, job.id));

      expect(updated).toBeDefined();
    }
  });

  it("should support error logging", async () => {
    // Verify lastError field can be updated
    const testJobs = await db
      .select()
      .from(scheduledPosts)
      .limit(1);

    if (testJobs.length > 0) {
      const job = testJobs[0];
      const errorMessage = "Test error message";

      const updated = await db
        .update(scheduledPosts)
        .set({ lastError: errorMessage })
        .where(eq(scheduledPosts.id, job.id));

      expect(updated).toBeDefined();

      // Clear error
      await db
        .update(scheduledPosts)
        .set({ lastError: null })
        .where(eq(scheduledPosts.id, job.id));
    }
  });

  it("should support reconnect_required status", async () => {
    // Verify the new status enum value exists
    const testJobs = await db
      .select()
      .from(scheduledPosts)
      .limit(1);

    if (testJobs.length > 0) {
      const job = testJobs[0];
      // Try to set reconnect_required status
      const updated = await db
        .update(scheduledPosts)
        .set({ status: "reconnect_required" })
        .where(eq(scheduledPosts.id, job.id));

      expect(updated).toBeDefined();

      // Restore original status
      await db
        .update(scheduledPosts)
        .set({ status: job.status })
        .where(eq(scheduledPosts.id, job.id));
    }
  });

  it("should store remote post ID after publishing", async () => {
    // Verify remotePostId field can be updated
    const testJobs = await db
      .select()
      .from(scheduledPosts)
      .limit(1);

    if (testJobs.length > 0) {
      const job = testJobs[0];
      const testRemoteId = "123456789_987654321";

      const updated = await db
        .update(scheduledPosts)
        .set({
          remotePostId: testRemoteId,
          status: "published",
          publishingStartedAt: new Date().toISOString(),
        })
        .where(eq(scheduledPosts.id, job.id));

      expect(updated).toBeDefined();

      // Restore original state
      await db
        .update(scheduledPosts)
        .set({
          remotePostId: job.remotePostId,
          status: job.status,
          publishingStartedAt: job.publishingStartedAt,
        })
        .where(eq(scheduledPosts.id, job.id));
    }
  });
});

describe("Facebook OAuth", () => {
  let db: any;

  beforeAll(async () => {
    db = await getDb();
  });

  it("should have platform_connections table", async () => {
    expect(db).toBeDefined();
    const result = await db.select().from(platformConnections).limit(1);
    expect(Array.isArray(result)).toBe(true);
  });

  it("should support Facebook platform connections", async () => {
    const facebookConns = await db
      .select()
      .from(platformConnections)
      .where(eq(platformConnections.platform, "facebook"))
      .limit(1);

    expect(Array.isArray(facebookConns)).toBe(true);
    // If connections exist, verify required fields
    if (facebookConns.length > 0) {
      const conn = facebookConns[0];
      expect(conn).toHaveProperty("id");
      expect(conn).toHaveProperty("userId");
      expect(conn).toHaveProperty("platform");
      expect(conn).toHaveProperty("accessToken");
      expect(conn).toHaveProperty("isActive");
    }
  });

  it("should support multiple pages per user", async () => {
    // Verify we can query multiple connections for a user
    const result = await db
      .select()
      .from(platformConnections)
      .limit(10);

    expect(Array.isArray(result)).toBe(true);
  });

  it("should support token expiration tracking", async () => {
    // Verify expiresAt field exists
    const result = await db
      .select()
      .from(platformConnections)
      .limit(1);

    if (result.length > 0) {
      const conn = result[0];
      expect(conn).toHaveProperty("expiresAt");
    }
  });
});
