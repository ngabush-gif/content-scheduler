import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DATABASE_URL?.split("@")[1]?.split(":")[0] || "localhost",
  user: process.env.DATABASE_URL?.split("://")[1]?.split(":")[0] || "root",
  password: process.env.DATABASE_URL?.split(":")[2]?.split("@")[0] || "",
  database: process.env.DATABASE_URL?.split("/")[3]?.split("?")[0] || "content_creator",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: "Amazon RDS" in process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
});

async function runTests() {
  const connection = await pool.getConnection();

  try {
    console.log("🧪 Starting End-to-End Facebook Publishing Tests\n");

    // Test 1: Check database schema
    console.log("Test 1: Verify database schema");
    const tables = await connection.query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME IN ('scheduled_posts', 'publishing_jobs', 'platform_connections')
    `);
    console.log(`✓ Found ${tables[0].length} required tables\n`);

    // Test 2: Check scheduled_posts columns
    console.log("Test 2: Verify scheduled_posts columns");
    const columns = await connection.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'scheduled_posts'
    `);
    const columnNames = columns[0].map((c) => c.COLUMN_NAME);
    const requiredColumns = [
      "id",
      "connectionId",
      "pageId",
      "status",
      "scheduledAt",
      "publishingStartedAt",
      "retryCount",
      "nextRetryAt",
      "lastError",
      "remotePostId",
    ];
    const missingColumns = requiredColumns.filter((col) => !columnNames.includes(col));
    if (missingColumns.length === 0) {
      console.log("✓ All required columns present\n");
    } else {
      console.log(`✗ Missing columns: ${missingColumns.join(", ")}\n`);
    }

    // Test 3: Check publishing_jobs table
    console.log("Test 3: Verify publishing_jobs table");
    const jobColumns = await connection.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'publishing_jobs'
    `);
    console.log(`✓ publishing_jobs has ${jobColumns[0].length} columns\n`);

    // Test 4: Check platform_connections
    console.log("Test 4: Verify platform_connections table");
    const connColumns = await connection.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'platform_connections'
    `);
    console.log(`✓ platform_connections has ${connColumns[0].length} columns\n`);

    // Test 5: Check status enum values
    console.log("Test 5: Verify status enum values");
    const statusCheck = await connection.query(`
      SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'scheduled_posts' 
      AND COLUMN_NAME = 'status'
    `);
    const statusEnum = statusCheck[0][0]?.COLUMN_TYPE || "";
    const requiredStatuses = ["scheduled", "publishing", "published", "failed", "reconnect_required"];
    const hasAllStatuses = requiredStatuses.every((status) => statusEnum.includes(status));
    if (hasAllStatuses) {
      console.log(`✓ All required status values present: ${requiredStatuses.join(", ")}\n`);
    } else {
      console.log(`✗ Missing status values. Current: ${statusEnum}\n`);
    }

    // Test 6: Check indexes
    console.log("Test 6: Verify indexes for atomic job claiming");
    const indexes = await connection.query(`
      SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'scheduled_posts'
      AND INDEX_NAME LIKE '%status%'
    `);
    if (indexes[0].length > 0) {
      console.log(`✓ Found ${indexes[0].length} status-related indexes\n`);
    } else {
      console.log("⚠ No status indexes found - job claiming may be slow\n");
    }

    // Test 7: Sample data - create test post
    console.log("Test 7: Create test content post");
    const testUserId = 1; // Assuming user ID 1 exists
    const now = new Date().toISOString();
    const testPost = await connection.query(
      `
      INSERT INTO content_posts (userId, caption, createdAt, updatedAt, niche, platform)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
      [testUserId, "Test post for publishing worker", now, now, "Technology", "facebook"]
    );
    const postId = testPost[0].insertId;
    console.log(`✓ Created test post with ID: ${postId}\n`);

    // Test 8: Check platform connections
    console.log("Test 8: Check existing Facebook connections");
    const connections = await connection.query(
      `
      SELECT id, pageId, pageName, isActive FROM platform_connections 
      WHERE platform = 'facebook' 
      LIMIT 1
    `
    );
    if (connections[0].length > 0) {
      const conn = connections[0][0];
      console.log(`✓ Found Facebook connection: ${conn.pageName} (ID: ${conn.id})`);
      console.log(`  Page ID: ${conn.pageId}`);
      console.log(`  Active: ${conn.isActive ? "Yes" : "No"}\n`);

      // Test 9: Create scheduled post
      console.log("Test 9: Create scheduled post for 1 minute from now");
      const scheduledAt = new Date(Date.now() + 60000).toISOString(); // 1 minute from now
      const scheduledPost = await connection.query(
        `
        INSERT INTO scheduled_posts 
        (postId, userId, connectionId, pageId, platform, scheduledAt, status, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          postId,
          testUserId,
          conn.id,
          conn.pageId,
          "facebook",
          scheduledAt,
          "scheduled",
          now,
          now,
        ]
      );
      const scheduledPostId = scheduledPost[0].insertId;
      console.log(`✓ Created scheduled post with ID: ${scheduledPostId}`);
      console.log(`  Scheduled for: ${scheduledAt}\n`);

      // Test 10: Monitor job status
      console.log("Test 10: Monitoring job status (checking every 10 seconds for 2 minutes)");
      let jobPublished = false;
      for (let i = 0; i < 12; i++) {
        await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait 10 seconds

        const jobStatus = await connection.query(
          `
          SELECT status, remotePostId, lastError, retryCount 
          FROM scheduled_posts 
          WHERE id = ?
        `,
          [scheduledPostId]
        );

        if (jobStatus[0].length > 0) {
          const job = jobStatus[0][0];
          console.log(`  [${new Date().toLocaleTimeString()}] Status: ${job.status}`);

          if (job.status === "published") {
            console.log(`  ✓ Post published! Remote ID: ${job.remotePostId}\n`);
            jobPublished = true;
            break;
          } else if (job.status === "failed") {
            console.log(`  ✗ Publishing failed: ${job.lastError}\n`);
            break;
          } else if (job.status === "reconnect_required") {
            console.log(`  ⚠ Token expired - reconnection required\n`);
            break;
          }
        }
      }

      if (!jobPublished) {
        console.log("⚠ Job did not complete within 2 minutes\n");
      }
    } else {
      console.log("✗ No Facebook connections found");
      console.log("  Please connect a Facebook page first via the Connections page\n");
    }

    console.log("🎉 End-to-End Tests Complete\n");
  } catch (error) {
    console.error("❌ Test Error:", error.message);
  } finally {
    await connection.release();
    await pool.end();
  }
}

runTests();
