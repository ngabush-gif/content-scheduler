import { getDb } from './server/db.ts';
import { contentPosts } from './drizzle/schema.ts';

const db = await getDb();

try {
  const posts = await db.select({
    id: contentPosts.id,
    title: contentPosts.title,
    status: contentPosts.status,
    remotePostId: contentPosts.remotePostId,
    lastError: contentPosts.lastError
  }).from(contentPosts).limit(10);
  
  console.log('All posts:');
  posts.forEach(p => {
    console.log(`ID: ${p.id}, Title: ${p.title}, Status: ${p.status}, RemotePostId: ${p.remotePostId}, LastError: ${p.lastError}`);
  });
  process.exit(0);
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
