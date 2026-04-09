import { createConnection } from 'mysql2/promise';

async function runMigration() {
  let connection;
  try {
    // Parse DATABASE_URL
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('DATABASE_URL not set');
    }

    console.log('[Migration] Parsing DATABASE_URL...');
    const url = new URL(dbUrl);
    
    const config = {
      host: url.hostname,
      port: url.port ? parseInt(url.port) : 4000,
      user: url.username,
      password: url.password,
      database: url.pathname.slice(1),
      ssl: {
        rejectUnauthorized: false,
      },
    };

    console.log(`[Migration] Connecting to ${config.host}:${config.port}/${config.database}...`);
    connection = await createConnection(config);
    console.log('[Migration] ✅ Connected');

    // Step 1: Create publishing_jobs table
    console.log('[Migration] Step 1: Creating publishing_jobs table...');
    try {
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS \`publishing_jobs\` (
          \`id\` int AUTO_INCREMENT NOT NULL,
          \`scheduledPostId\` int NOT NULL,
          \`userId\` int NOT NULL,
          \`postId\` int NOT NULL,
          \`platform\` enum('facebook','instagram','tiktok') NOT NULL,
          \`pageId\` varchar(255),
          \`status\` enum('running','success','failed_auth','failed_retrying','failed_permanent') NOT NULL DEFAULT 'running',
          \`remotePostId\` varchar(255),
          \`errorCode\` varchar(100),
          \`errorMessage\` text,
          \`httpStatusCode\` int,
          \`responseBody\` text,
          \`attemptNumber\` int NOT NULL DEFAULT 1,
          \`startedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`completedAt\` timestamp,
          \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT \`publishing_jobs_id\` PRIMARY KEY(\`id\`)
        )
      `);
      console.log('[Migration] ✅ publishing_jobs table created');
    } catch (err) {
      console.log('[Migration] ℹ️  publishing_jobs table already exists or error:', err.message);
    }

    // Step 2: Add columns to scheduled_posts
    console.log('[Migration] Step 2: Adding columns to scheduled_posts...');
    const columnsToAdd = [
      { name: 'connectionId', def: 'int DEFAULT 1' },
      { name: 'pageId', def: 'varchar(255)' },
      { name: 'publishingStartedAt', def: 'timestamp NULL' },
      { name: 'remotePostId', def: 'varchar(255)' },
      { name: 'retryCount', def: 'int DEFAULT 0' },
      { name: 'nextRetryAt', def: 'timestamp NULL' },
      { name: 'lastError', def: 'text' },
    ];

    for (const col of columnsToAdd) {
      try {
        await connection.execute(`
          ALTER TABLE \`scheduled_posts\` 
          ADD COLUMN IF NOT EXISTS \`${col.name}\` ${col.def}
        `);
        console.log(`[Migration] ✅ Added column ${col.name}`);
      } catch (err) {
        console.log(`[Migration] ℹ️  Column ${col.name} already exists or error:`, err.message);
      }
    }

    // Step 3: Update status enum
    console.log('[Migration] Step 3: Updating status enum...');
    try {
      await connection.execute(`
        ALTER TABLE \`scheduled_posts\` 
        MODIFY COLUMN \`status\` enum('scheduled','publishing','published','failed','cancelled','reconnect_required') 
        NOT NULL DEFAULT 'scheduled'
      `);
      console.log('[Migration] ✅ Status enum updated');
    } catch (err) {
      console.log('[Migration] ℹ️  Status enum update failed:', err.message);
    }

    // Step 4: Create indexes
    console.log('[Migration] Step 4: Creating indexes...');
    const indexesToCreate = [
      {
        name: 'idx_scheduled_posts_status_time',
        table: 'scheduled_posts',
        columns: '(`status`, `scheduledAt`, `nextRetryAt`)',
      },
      {
        name: 'idx_publishing_jobs_scheduled_post',
        table: 'publishing_jobs',
        columns: '(`scheduledPostId`)',
      },
      {
        name: 'idx_publishing_jobs_user',
        table: 'publishing_jobs',
        columns: '(`userId`)',
      },
    ];

    for (const idx of indexesToCreate) {
      try {
        await connection.execute(`
          CREATE INDEX IF NOT EXISTS \`${idx.name}\` 
          ON \`${idx.table}\` ${idx.columns}
        `);
        console.log(`[Migration] ✅ Created index ${idx.name}`);
      } catch (err) {
        console.log(`[Migration] ℹ️  Index ${idx.name} already exists or error:`, err.message);
      }
    }

    // Verification
    console.log('\n[Verification] Checking schema...');
    
    const [tables] = await connection.execute(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('publishing_jobs', 'scheduled_posts')",
      [config.database]
    );
    console.log('[Verification] ✅ Tables:', tables.map(t => t.TABLE_NAME).join(', '));

    const [columns] = await connection.execute(
      "SELECT COLUMN_NAME, COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'scheduled_posts' ORDER BY ORDINAL_POSITION",
      [config.database]
    );
    console.log('[Verification] ✅ scheduled_posts columns:');
    const requiredCols = ['id', 'postId', 'scheduledById', 'connectionId', 'pageId', 'platform', 'scheduledAt', 'status', 'publishingStartedAt', 'remotePostId', 'retryCount', 'nextRetryAt', 'lastError'];
    const existingCols = columns.map(c => c.COLUMN_NAME);
    for (const col of requiredCols) {
      const exists = existingCols.includes(col);
      console.log(`  ${exists ? '✅' : '❌'} ${col}`);
    }

    const [indexResults] = await connection.execute(
      "SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'scheduled_posts' AND INDEX_NAME != 'PRIMARY'",
      [config.database]
    );
    console.log('[Verification] ✅ scheduled_posts indexes:', indexResults.map(i => i.INDEX_NAME).join(', ') || 'none');

    const [pubJobsCheck] = await connection.execute(
      "SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'publishing_jobs'",
      [config.database]
    );
    console.log('[Verification] ✅ publishing_jobs table exists:', pubJobsCheck[0].count > 0);

    console.log('\n✅ Migration complete!');
    
  } catch (err) {
    console.error('[Migration] Fatal error:', err.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

runMigration();
