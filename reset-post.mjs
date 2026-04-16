import { getDb } from './server/db.ts';
import { contentPosts } from './drizzle/schema.ts';
import { eq } from 'drizzle-orm';

const db = await getDb();

try {
  await db.update(contentPosts)
    .set({
      status: 'approved',
      remotePostId: null,
      lastError: null
    })
    .where(eq(contentPosts.id, 540001));
  
  console.log('Post 540001 reset to approved status');
  process.exit(0);
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
