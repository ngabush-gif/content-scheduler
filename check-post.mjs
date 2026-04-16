import { getDb } from './server/db.ts';
import { contentPosts } from './drizzle/schema.ts';
import { eq } from 'drizzle-orm';

const db = await getDb();

try {
  const post = await db.select().from(contentPosts).where(eq(contentPosts.id, 2));
  console.log('Post ID 2:');
  console.log(JSON.stringify(post[0], null, 2));
  process.exit(0);
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
