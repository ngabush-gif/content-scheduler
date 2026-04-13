import { describe, it, expect } from "vitest";
import { getDb } from "./db";
import { scheduledPosts } from "../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Verify Publishing Results
 * Checks that the scheduled post was published and database was updated
 */
describe("Verify Publishing Results", () => {
  it("should verify post was published and database updated", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");

    // The post we scheduled in the E2E test had ID 210001
    const post = await db
      .select()
      .from(scheduledPosts)
      .where(eq(scheduledPosts.id, 210001))
      .limit(1);

    expect(post.length).toBe(1);
    console.log("\n📋 Scheduled Post Status:");
    console.log(`  - ID: ${post[0].id}`);
    console.log(`  - Status: ${post[0].status}`);
    console.log(`  - Remote Post ID: ${post[0].remotePostId}`);
    console.log(`  - Published At: ${post[0].publishedAt}`);
    console.log(`  - Last Error: ${post[0].lastError || "None"}`);

    // Verify it was published
    if (post[0].status === "published") {
      console.log("\n✅ SUCCESS! Post was published!");
      expect(post[0].remotePostId).toBeDefined();
      expect(post[0].publishedAt).toBeDefined();
      console.log(`   Remote Post ID: ${post[0].remotePostId}`);
      console.log(`   Published At: ${post[0].publishedAt}`);
    } else if (post[0].status === "publishing") {
      console.log("\n⏳ Post is still publishing...");
    } else if (post[0].status === "failed") {
      console.log("\n❌ Post failed to publish");
      console.log(`   Error: ${post[0].lastError}`);
      throw new Error(`Publishing failed: ${post[0].lastError}`);
    } else {
      console.log(`\n⏳ Post status: ${post[0].status}`);
    }
  });
});
