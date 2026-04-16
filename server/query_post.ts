import { getDb } from './db';
import { scheduledPosts } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) {
    console.error('Could not connect to database');
    process.exit(1);
  }

  const rows = await db.select().from(scheduledPosts).where(eq(scheduledPosts.id, 390004)).limit(1);
  
  if (rows.length > 0) {
    const post = rows[0];
    console.log('\n=== Scheduled Post 390004 ===');
    console.log('ID:', post.id);
    console.log('PostID:', post.postId);
    console.log('Platform:', post.platform);
    console.log('ScheduledAt:', post.scheduledAt);
    console.log('Status:', post.status);
    console.log('ConnectionId:', post.connectionId);
    console.log('PageId:', post.pageId);
    console.log('RemotePostId:', post.remotePostId);
    console.log('LastError:', post.lastError);
  } else {
    console.log('Post 390004 not found');
  }
  
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
