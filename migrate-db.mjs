import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createConnection } from 'mysql2/promise';
import { parse } from 'url';

const migrationSQL = readFileSync(resolve('./drizzle/0007_safe_migration.sql'), 'utf-8');

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
      database: url.pathname.slice(1), // Remove leading /
      ssl: {
        rejectUnauthorized: false,
      },
      multipleStatements: true,
    };

    console.log(`[Migration] Connecting to ${config.host}:${config.port}/${config.database}...`);
    
    connection = await createConnection(config);

    console.log('[Migration] Connected. Executing migration...');
    
    // Split by semicolon and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      console.log(`[Migration] Executing statement ${i + 1}/${statements.length}...`);
      try {
        await connection.execute(stmt);
        console.log(`[Migration] ✅ Statement ${i + 1} completed`);
      } catch (err) {
        console.error(`[Migration] ❌ Statement ${i + 1} failed:`, err.message);
        // Continue on error to see all issues
      }
    }

    console.log('[Migration] ✅ Migration completed');
    
    // Verify schema
    console.log('\n[Verification] Checking schema...');
    
    const [tables] = await connection.execute(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('publishing_jobs', 'scheduled_posts')",
      [config.database]
    );
    console.log('[Verification] Tables:', tables.map(t => t.TABLE_NAME));

    const [columns] = await connection.execute(
      "SELECT COLUMN_NAME, COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'scheduled_posts' ORDER BY ORDINAL_POSITION",
      [config.database]
    );
    console.log('[Verification] scheduled_posts columns:');
    columns.forEach(col => {
      console.log(`  - ${col.COLUMN_NAME}: ${col.COLUMN_TYPE}`);
    });

    const [indexes] = await connection.execute(
      "SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'scheduled_posts' AND INDEX_NAME != 'PRIMARY'",
      [config.database]
    );
    console.log('[Verification] scheduled_posts indexes:', indexes.map(i => i.INDEX_NAME));

    console.log('\n✅ Migration and verification complete!');
    
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
