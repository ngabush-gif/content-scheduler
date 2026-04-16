import { getDb } from "./db";
import { scheduledPosts, contentPosts, platformConnections } from "../drizzle/schema";

async function main() {
  const db = await getDb();
  if (!db) {
    console.error('Could not connect to database');
    process.exit(1);
  }

  // Check scheduled posts
  const scheduled = await db.select().from(scheduledPosts);
  console.log('\n=== SCHEDULED POSTS ===');
  console.log(`Total: ${scheduled.length}`);
  if (scheduled.length > 0) {
    console.log('Sample:', scheduled.slice(0, 2).map(p => ({
      id: p.id,
      status: p.status,
      platform: p.platform,
      scheduledAt: p.scheduledAt,
    })));
  }

  // Check content posts
  const content = await db.select().from(contentPosts);
  console.log('\n=== CONTENT POSTS ===');
  console.log(`Total: ${content.length}`);
  if (content.length > 0) {
    console.log('Sample:', content.slice(0, 2).map(p => ({
      id: p.id,
      title: p.title,
      status: p.status,
    })));
  }

  // Check platform connections
  const connections = await db.select().from(platformConnections);
  console.log('\n=== PLATFORM CONNECTIONS ===');
  console.log(`Total: ${connections.length}`);
  if (connections.length > 0) {
    console.log('Sample:', connections.map(c => ({
      id: c.id,
      platform: c.platform,
      accountId: c.accountId,
      accountName: c.accountName,
      isActive: c.isActive,
    })));
  }

  console.log('\n=== CLEANUP PLAN ===');
  console.log(`Will clear: ${scheduled.length} scheduled posts`);
  console.log(`Will clear: ${content.length} content posts`);
  console.log(`Will KEEP: ${connections.length} platform connections`);
  console.log(`Will KEEP: Database schema, migrations, codebase`);

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
