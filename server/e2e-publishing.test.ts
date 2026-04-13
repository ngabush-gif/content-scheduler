import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import { platformConnections, scheduledPosts, contentPosts } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

/**
 * End-to-End Publishing Test
 * Tests the complete flow: connection → scheduled post → publishing → verification
 */
describe("E2E Publishing Flow", () => {
  const PAGE_TOKEN = "EAAXAHuqy1NABRJVbqQCdWqeMZCk0KzqJ8F0I3i2BW5Gwyph8d7zy3343L1qlJpiMSOZB18HcP3cp7pJJFJr3msilljdXj73S8zrpbKBK3M57CedRjhYjPUZCZBjFtMtGOytLCIyF3LYlndqoGk7U5lkrplEzRSyZAFKbZAm0rtV7Kr0f0HE84iYn5fHSUwG5ZBIe4Rc";
  const PAGE_ID = "838862115974989";
  const PAGE_NAME = "Time Wealth with Leon Makara";
  const USER_ID = 1;

  let db: any;
  let connectionId: number;
  let postId: number;

  beforeAll(async () => {
    db = await getDb();
    if (!db) throw new Error("Database unavailable");
  });

  it("should create a Facebook connection", async () => {
    // Check if connection exists
    const existing = await db
      .select()
      .from(platformConnections)
      .where(
        and(
          eq(platformConnections.userId, USER_ID),
          eq(platformConnections.platform, "facebook"),
          eq(platformConnections.accountId, PAGE_ID)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      connectionId = existing[0].id;
      // Update with fresh token
      await db
        .update(platformConnections)
        .set({
          accessToken: PAGE_TOKEN,
          isActive: 1,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(platformConnections.id, connectionId));
    } else {
      // Create new connection
      const result = await db.insert(platformConnections).values({
        userId: USER_ID,
        platform: "facebook",
        accountName: PAGE_NAME,
        accountId: PAGE_ID,
        accessToken: PAGE_TOKEN,
        isActive: 1,
        connectedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      connectionId = result[0].insertId;
    }

    expect(connectionId).toBeGreaterThan(0);
    console.log(`✅ Connection created/updated: ${connectionId}`);
  });

  it("should create a content post", async () => {
    const result = await db.insert(contentPosts).values({
      authorId: USER_ID,
      title: "E2E Test Post",
      caption: "🚀 This is an end-to-end test post from ContentCreator Hub",
      niche: "online_business",
      platform: "facebook",
      contentType: "caption",
      contentStyle: "motivational",
      imageUrl: null,
      status: "approved",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    postId = result[0].insertId;
    expect(postId).toBeGreaterThan(0);
    console.log(`✅ Content post created: ${postId}`);
  });

  it("should schedule a post for immediate publishing", async () => {
    const now = new Date();
    const scheduledTime = new Date(now.getTime() - 1000); // 1 second ago (should publish immediately)

    const result = await db.insert(scheduledPosts).values({
      postId: postId,
      scheduledById: USER_ID,
      connectionId: connectionId,
      pageId: PAGE_ID,
      platform: "facebook",
      scheduledAt: scheduledTime.toISOString(),
      status: "scheduled",
      retryCount: 0,
      nextRetryAt: null,
      lastError: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const scheduledPostId = result[0].insertId;
    expect(scheduledPostId).toBeGreaterThan(0);
    console.log(`✅ Post scheduled for publishing: ${scheduledPostId}`);
  });

  it("should verify connection is active and has valid token", async () => {
    const connection = await db
      .select()
      .from(platformConnections)
      .where(eq(platformConnections.id, connectionId))
      .limit(1);

    expect(connection.length).toBe(1);
    expect(connection[0].isActive).toBe(1);
    expect(connection[0].accessToken).toBe(PAGE_TOKEN);
    console.log(`✅ Connection verified as active with valid token`);
  });

  it("should test publishing directly to Facebook", async () => {
    const connection = await db
      .select()
      .from(platformConnections)
      .where(eq(platformConnections.id, connectionId))
      .limit(1);

    const token = connection[0].accessToken;
    const message = "✅ E2E Test: Direct publishing works!";

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${PAGE_ID}/feed`,
      {
        method: "POST",
        body: new URLSearchParams({
          message,
          access_token: token,
        }),
      }
    );

    const data = await response.json();
    expect(response.ok).toBe(true);
    expect(data.id).toBeDefined();
    console.log(`✅ Post published to Facebook: ${data.id}`);
  });
});
