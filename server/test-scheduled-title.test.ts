import { describe, it, expect } from 'vitest';
import { getScheduledPosts } from './db';

describe('Scheduled Posts with Title', () => {
  it('should return scheduled posts with title field populated', async () => {
    // Get all scheduled posts for user ID 1
    const posts = await getScheduledPosts(1);
    
    console.log('\n=== Scheduled Posts Data ===');
    console.log(`Total posts: ${posts.length}`);
    
    posts.forEach((p: any) => {
      console.log(`\nPost ID: ${p.id}`);
      console.log(`  - postId: ${p.postId}`);
      console.log(`  - title: "${p.title}"`);
      console.log(`  - platform: ${p.platform}`);
      console.log(`  - scheduledAt: ${p.scheduledAt}`);
      console.log(`  - status: ${p.status}`);
      console.log(`  - imageUrl: ${p.imageUrl}`);
    });
    
    // Find Monday SideHustle
    const mondayPost = posts.find((p: any) => p.postId === 690011);
    if (mondayPost) {
      console.log('\n✅ Monday SideHustle Post Found:');
      console.log(`  Title: ${mondayPost.title}`);
      console.log(`  Scheduled: ${mondayPost.scheduledAt}`);
      expect(mondayPost.title).toBeDefined();
      expect(mondayPost.title).toBeTruthy();
    } else {
      console.log('\n❌ Monday SideHustle post not found');
    }
    
    expect(posts.length).toBeGreaterThan(0);
  });
});
