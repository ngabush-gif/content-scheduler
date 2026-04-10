#!/usr/bin/env node

/**
 * End-to-End Test: Publishing Worker
 * 
 * Test 1: Schedule a post for 1 minute from now and verify automatic publishing
 */

import mysql from "mysql2/promise";
import { config } from "dotenv";

config();

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("❌ DATABASE_URL not set");
  process.exit(1);
}

async function getConnection() {
  const url = new URL(DB_URL);
  const connection = await mysql.createConnection({
    host: url.hostname,
    port: url.port || 3306,
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1),
    ssl: url.hostname.includes("rds") || url.hostname.includes("tidb") ? { rejectUnauthorized: false } : undefined,
  });
  return connection;
}

async function test1() {
  console.log("\n📋 TEST 1: Schedule post for 1 minute from now\n");

  const conn = await getConnection();

  try {
    // Step 1: Get or create a test user
    console.log("1️⃣  Getting test user...");
    const [users] = await conn.query(
      "SELECT id FROM users LIMIT 1"
    );
    
    if (!users.length) {
      console.error("❌ No users found in database. Create a user first.");
      process.exit(1);
    }

    const userId = users[0].id;
    console.log(`   ✅ Using user ID: ${userId}`);

    // Step 2: Get or create a test post
    console.log("\n2️⃣  Getting test post...");
    const [posts] = await conn.query(
      "SELECT id FROM content_posts WHERE authorId = ? LIMIT 1",
      [userId]
    );

    let postId;
    if (posts.length) {
      postId = posts[0].id;
      console.log(`   ✅ Using existing post ID: ${postId}`);
    } else {
      console.log("   ℹ️  No posts found. Creating test post...");
      const [result] = await conn.query(
        `INSERT INTO content_posts (authorId, title, caption, status, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, NOW(), NOW())`,
        [userId, "Test Post", "Test post for publishing worker", "approved"]
      );
      postId = result.insertId;
      console.log(`   ✅ Created test post ID: ${postId}`);
    }

    // Step 3: Get a platform connection
    console.log("\n3️⃣  Getting platform connection...");
    const [connections] = await conn.query(
      "SELECT id, platform, accountId FROM platform_connections WHERE userId = ? LIMIT 1",
      [userId]
    );

    if (!connections.length) {
      console.error("❌ No platform connections found. Connect a platform first.");
      process.exit(1);
    }

    const connection = connections[0];
    const connectionId = connection.id;
    const platform = connection.platform;
    const pageId = connection.accountId; // Facebook Page ID stored as accountId

    console.log(`   ✅ Using connection ID: ${connectionId}`);
    console.log(`   ✅ Platform: ${platform}`);
    console.log(`   ✅ Page ID: ${pageId}`);

    // Step 4: Schedule post for 1 minute from now
    console.log("\n4️⃣  Scheduling post for 1 minute from now...");
    const scheduledAt = new Date(Date.now() + 60000); // 1 minute from now
    const scheduledAtIso = scheduledAt.toISOString();

    const [scheduleResult] = await conn.query(
      `INSERT INTO scheduled_posts 
       (postId, scheduledById, connectionId, pageId, platform, scheduledAt, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [postId, userId, connectionId, pageId, platform, scheduledAtIso, "scheduled"]
    );

    const scheduledPostId = scheduleResult.insertId;
    console.log(`   ✅ Scheduled post ID: ${scheduledPostId}`);
    console.log(`   ✅ Scheduled for: ${scheduledAtIso}`);

    // Step 5: Wait and monitor status
    console.log("\n5️⃣  Waiting for worker to execute (max 90 seconds)...");
    console.log("   ⏳ Checking status every 10 seconds...\n");

    let published = false;
    let attempts = 0;
    const maxAttempts = 9; // 90 seconds

    while (attempts < maxAttempts && !published) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      attempts++;

      const [statusResult] = await conn.query(
        "SELECT status, remotePostId, lastError FROM scheduled_posts WHERE id = ?",
        [scheduledPostId]
      );

      const status = statusResult[0].status;
      const remotePostId = statusResult[0].remotePostId;
      const lastError = statusResult[0].lastError;

      console.log(`   [${attempts * 10}s] Status: ${status}`);

      if (status === "published") {
        published = true;
        console.log(`   ✅ PUBLISHED! Remote post ID: ${remotePostId}`);
      } else if (status === "failed") {
        console.log(`   ❌ FAILED! Error: ${lastError}`);
        break;
      } else if (status === "reconnect_required") {
        console.log(`   ⚠️  RECONNECT REQUIRED! Error: ${lastError}`);
        break;
      }
    }

    if (published) {
      console.log("\n✅ TEST 1 PASSED: Post was automatically published!");
      return true;
    } else {
      console.log("\n❌ TEST 1 FAILED: Post was not published within 90 seconds");
      return false;
    }

  } catch (error) {
    console.error("❌ Test error:", error.message);
    return false;
  } finally {
    await conn.end();
  }
}

// Run test
test1().then(success => {
  process.exit(success ? 0 : 1);
});
