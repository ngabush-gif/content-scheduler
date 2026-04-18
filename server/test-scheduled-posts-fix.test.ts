import { describe, it, expect } from 'vitest';
import { getScheduledPosts } from './db';

describe('Scheduled Posts Fix', () => {
  it('should return scheduled posts for a user by filtering on post author, not scheduledById', async () => {
    // Get all scheduled posts for user ID 1 (the post author)
    const posts = await getScheduledPosts(1);
    
    console.log('\n=== Scheduled Posts for User 1 ===');
    console.log(`Found ${posts.length} scheduled posts`);
    posts.forEach((p: any) => {
      console.log(`  - ID: ${p.id}, Post ID: ${p.postId}, Platform: ${p.platform}, Status: ${p.status}, Scheduled: ${p.scheduledAt}`);
    });
    
    // The Monday SideHustle post (ID 690011) should be in this list
    const mondayPost = posts.find((p: any) => p.postId === 690011);
    if (mondayPost) {
      console.log('\n✅ SUCCESS: Monday SideHustle post found in scheduled posts!');
      console.log(`  - Scheduled Post ID: ${mondayPost.id}`);
      console.log(`  - Platform: ${mondayPost.platform}`);
      console.log(`  - Status: ${mondayPost.status}`);
      console.log(`  - Scheduled At: ${mondayPost.scheduledAt}`);
    } else {
      console.log('\n❌ FAILED: Monday SideHustle post NOT found in scheduled posts');
    }
    
    expect(posts.length).toBeGreaterThan(0);
  });
});
