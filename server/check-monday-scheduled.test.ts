import { describe, it } from 'vitest';
import { getDb } from './db';
import { contentPosts, scheduledPosts } from '../drizzle/schema';
import { eq, like, or, sql } from 'drizzle-orm';

describe('Check Monday SideHustle Scheduled Post', () => {
  it('should find scheduled entry for Monday SideHustle', async () => {
    const db = await getDb();
    
    // Find the Monday SideHustle post
    const posts = await db
      .select()
      .from(contentPosts)
      .where(like(contentPosts.title, '%Monday%'));
    
    console.log('\n=== Monday Posts ===');
    console.log(`Found ${posts.length} posts with "Monday"`);
    posts.forEach((p: any) => {
      console.log(`  - ID: ${p.id}, Title: "${p.title}", Status: ${p.status}`);
    });
    
    if (posts.length > 0) {
      const postId = posts[0].id;
      
      // Get all scheduled entries for this post
      const scheduled = await db
        .select()
        .from(scheduledPosts)
        .where(eq(scheduledPosts.postId, postId));
      
      console.log(`\n=== Scheduled Entries for Post ${postId} ===`);
      console.log(`Found ${scheduled.length} scheduled entries`);
      scheduled.forEach((s: any) => {
        const date = new Date(s.scheduledAt);
        console.log(`  - ID: ${s.id}`);
        console.log(`    Platform: ${s.platform}`);
        console.log(`    Scheduled At: ${s.scheduledAt} (${date.toISOString()})`);
        console.log(`    Status: ${s.status}`);
        console.log(`    Connection ID: ${s.connectionId}`);
      });
      
      // Check if there's one scheduled for 2026-04-20 07:30
      const april20 = scheduled.filter((s: any) => {
        const date = new Date(s.scheduledAt);
        return date.toISOString().startsWith('2026-04-20');
      });
      
      console.log(`\n=== Posts Scheduled for 2026-04-20 ===`);
      console.log(`Found ${april20.length} posts for that date`);
      april20.forEach((s: any) => {
        console.log(`  - Time: ${s.scheduledAt}, Status: ${s.status}`);
      });
    }
  });
});
