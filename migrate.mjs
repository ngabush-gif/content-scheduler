import { readFileSync } from 'fs';
import { resolve } from 'path';
import mysql from 'mysql2/promise';

const migrationSQL = readFileSync(resolve('./drizzle/0007_safe_migration.sql'), 'utf-8');

async function runMigration() {
  let connection;
  try {
    console.log('[Migration] Connecting to database...');
    
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      multipleStatements: true,
    });

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
      [process.env.DB_NAME]
    );
    console.log('[Verification] Tables:', tables.map(t => t.TABLE_NAME));

    const [columns] = await connection.execute(
      "SELECT COLUMN_NAME, COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'scheduled_posts' ORDER BY ORDINAL_POSITION",
      [process.env.DB_NAME]
    );
    console.log('[Verification] scheduled_posts columns:');
    columns.forEach(col => {
      console.log(`  - ${col.COLUMN_NAME}: ${col.COLUMN_TYPE}`);
    });

    const [indexes] = await connection.execute(
      "SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'scheduled_posts' AND INDEX_NAME != 'PRIMARY'",
      [process.env.DB_NAME]
    );
    console.log('[Verification] scheduled_posts indexes:', indexes.map(i => i.INDEX_NAME));

    console.log('\n✅ Migration and verification complete!');
    
  } catch (err) {
    console.error('[Migration] Fatal error:', err);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

runMigration();
