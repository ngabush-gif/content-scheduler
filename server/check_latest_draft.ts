import { getDb } from "./db";
import { contentPosts } from "../drizzle/schema";
import { desc } from "drizzle-orm";

async function main() {
  const db = await getDb();
  if (!db) {
    console.error('No DB');
    process.exit(1);
  }

  const latest = await db
    .select()
    .from(contentPosts)
    .orderBy(desc(contentPosts.id))
    .limit(1);

  if (latest.length === 0) {
    console.log('No posts found');
    process.exit(0);
  }

  const post = latest[0];
  console.log('\n=== LATEST DRAFT ===');
  console.log('ID:', post.id);
  console.log('Title:', post.title);
  console.log('Platform:', post.platform);
  console.log('ContentType:', post.contentType);
  console.log('\n--- CAPTION ---');
  console.log(post.caption);
  console.log('\n--- HASHTAGS ---');
  console.log(post.hashtags);
  console.log('\n--- FULL CONTENT ---');
  console.log(post.fullContent);
  console.log('\n--- TONE ---');
  console.log(post.tone);

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
