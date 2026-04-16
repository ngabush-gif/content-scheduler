import { getDb } from './server/db.ts';
import { contentPosts } from './drizzle/schema.ts';
import { eq } from 'drizzle-orm';

const db = await getDb();

try {
  const post = await db.select({
    id: contentPosts.id,
    title: contentPosts.title,
    status: contentPosts.status,
    remotePostId: contentPosts.remotePostId,
    lastError: contentPosts.lastError,
    hashtags: contentPosts.hashtags,
    publishedAt: contentPosts.publishedAt
  }).from(contentPosts).where(eq(contentPosts.id, 540001));
  
  console.log('Post 540001 after Facebook publish:');
  console.log(JSON.stringify(post[0], null, 2));
  process.exit(0);
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
