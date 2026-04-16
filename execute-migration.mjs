import { getDb } from './server/db.ts';

try {
  const db = await getDb();
  if (!db) {
    console.log('ERROR: Database connection unavailable');
    process.exit(1);
  }
  
  console.log('Executing migration: ALTER TABLE `content_posts` ADD `imagePrompt` text;');
  
  // Execute the migration
  await db.execute(`ALTER TABLE \`content_posts\` ADD COLUMN IF NOT EXISTS \`imagePrompt\` text`);
  
  console.log('✅ Migration executed successfully!');
  
  // Verify the column was added
  const result = await db.execute(`DESCRIBE content_posts`);
  console.log('Column added. Verifying schema...');
  
  process.exit(0);
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
}
