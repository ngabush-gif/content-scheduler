import { getDb } from "./db";
import { scheduledPosts, contentPosts } from "../drizzle/schema";

async function main() {
  const db = await getDb();
  if (!db) {
    console.error('Could not connect to database');
    process.exit(1);
  }

  console.log('\n=== STARTING SAFE CLEANUP ===\n');

  // Count before
  const scheduledBefore = await db.select().from(scheduledPosts);
  const contentBefore = await db.select().from(contentPosts);
  
  console.log(`Before cleanup:`);
  console.log(`  - Scheduled posts: ${scheduledBefore.length}`);
  console.log(`  - Content posts: ${contentBefore.length}`);

  // Clear scheduled posts
  console.log('\nClearing scheduled posts...');
  const scheduledResult = await db.delete(scheduledPosts);
  console.log(`  ✅ Deleted scheduled posts`);

  // Clear content posts
  console.log('\nClearing content posts...');
  const contentResult = await db.delete(contentPosts);
  console.log(`  ✅ Deleted content posts`);

  // Verify
  console.log('\nVerifying cleanup...');
  const scheduledAfter = await db.select().from(scheduledPosts);
  const contentAfter = await db.select().from(contentPosts);

  console.log(`\nAfter cleanup:`);
  console.log(`  - Scheduled posts: ${scheduledAfter.length}`);
  console.log(`  - Content posts: ${contentAfter.length}`);

  console.log('\n✅ CLEANUP COMPLETE - Dashboard ready for fresh start!');
  process.exit(0);
}

main().catch(err => {
  console.error('Error during cleanup:', err);
  process.exit(1);
});
