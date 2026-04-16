import { getDb } from './server/db.ts';
import { sql } from 'drizzle-orm';

const db = await getDb();

try {
  console.log('Applying migration...');
  
  // Add remotePostId column
  await db.execute(sql.raw(`ALTER TABLE \`content_posts\` ADD COLUMN \`remotePostId\` varchar(255)`));
  console.log('✅ Added remotePostId column');
  
  // Add lastError column
  await db.execute(sql.raw(`ALTER TABLE \`content_posts\` ADD COLUMN \`lastError\` text`));
  console.log('✅ Added lastError column');
  
  // Update status enum to include 'failed'
  await db.execute(sql.raw(`ALTER TABLE \`content_posts\` MODIFY COLUMN \`status\` enum('draft','pending_review','approved','rejected','published','failed') NOT NULL DEFAULT 'draft'`));
  console.log('✅ Updated status enum to include failed');
  
  console.log('✅ Migration applied successfully!');
  process.exit(0);
} catch (err) {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
}
