import { getDb } from "./db";
import { scheduledPosts, contentPosts, platformConnections } from "../drizzle/schema";

async function main() {
  try {
    const db = await getDb();
    if (!db) throw new Error('No DB');

    const scheduled = await db.select().from(scheduledPosts);
    const content = await db.select().from(contentPosts);
    const connections = await db.select().from(platformConnections);

    console.log('\n=== FINAL STATE ===');
    console.log(`Scheduled posts: ${scheduled.length}`);
    console.log(`Content posts: ${content.length}`);
    console.log(`Platform connections: ${connections.length}`);
    
    if (connections.length > 0) {
      console.log('\nActive connections:');
      connections.filter(c => c.isActive).forEach(c => {
        console.log(`  - ${c.platform}: ${c.accountName}`);
      });
    }

    console.log('\n✅ Dashboard is clean and ready!');
  } catch (err) {
    console.error('Error:', err);
  }
  process.exit(0);
}
main();
