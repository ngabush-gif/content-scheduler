import { drizzle } from "drizzle-orm/mysql2/http";
import { platformConnections } from "./drizzle/schema.js";
import { eq, and } from "drizzle-orm";

// Page token we verified works
const PAGE_TOKEN = "EAAXAHuqy1NABRJVbqQCdWqeMZCk0KzqJ8F0I3i2BW5Gwyph8d7zy3343L1qlJpiMSOZB18HcP3cp7pJJFJr3msilljdXj73S8zrpbKBK3M57CedRjhYjPUZCZBjFtMtGOytLCIyF3LYlndqoGk7U5lkrplEzRSyZAFKbZAm0rtV7Kr0f0HE84iYn5fHSUwG5ZBIe4Rc";
const PAGE_ID = "838862115974989";
const PAGE_NAME = "Time Wealth with Leon Makara";
const USER_ID = 1; // Assuming first user (Leon)

async function insertConnection() {
  try {
    console.log("[Test] Connecting to database...");
    const db = drizzle(process.env.DATABASE_URL);

    console.log("[Test] Checking for existing connection...");
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
      console.log("[Test] Connection exists, updating...");
      await db
        .update(platformConnections)
        .set({
          accessToken: PAGE_TOKEN,
          isActive: 1,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(platformConnections.id, existing[0].id));
      console.log(`[Test] ✅ Updated connection ${existing[0].id}`);
    } else {
      console.log("[Test] Creating new connection...");
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
      console.log(`[Test] ✅ Created connection`);
    }

    // Verify it was saved
    console.log("[Test] Verifying connection...");
    const verified = await db
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

    if (verified.length > 0) {
      console.log("[Test] ✅ Connection verified:");
      console.log(`  - ID: ${verified[0].id}`);
      console.log(`  - Platform: ${verified[0].platform}`);
      console.log(`  - Page: ${verified[0].accountName} (${verified[0].accountId})`);
      console.log(`  - Token saved: ${verified[0].accessToken.substring(0, 20)}...`);
      console.log(`  - Active: ${verified[0].isActive === 1}`);
    }
  } catch (error) {
    console.error("[Test] ❌ Error:", error);
    process.exit(1);
  }
}

insertConnection();
