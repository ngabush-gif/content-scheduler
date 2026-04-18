import { getDb } from './server/db.ts';
import { sql } from 'drizzle-orm';

const db = await getDb();

// Find posts with Monday or SideHustle in title
const posts = await db.execute(sql`
  SELECT cp.id, cp.title, cp.status, sp.id as scheduledId, sp.scheduledAt, sp.status as scheduleStatus, sp.platform
  FROM content_posts cp
  LEFT JOIN scheduled_posts sp ON cp.id = sp.postId
  WHERE cp.title LIKE '%Monday%' OR cp.title LIKE '%SideHustle%'
  ORDER BY cp.createdAt DESC LIMIT 10
`);

console.log('Found posts:');
console.log(JSON.stringify(posts, null, 2));

// Check scheduled posts for 2026-04-20
const scheduled = await db.execute(sql`
  SELECT sp.id, sp.postId, cp.title, sp.scheduledAt, sp.status, sp.platform
  FROM scheduled_posts sp
  JOIN content_posts cp ON sp.postId = cp.id
  WHERE DATE(sp.scheduledAt) = '2026-04-20'
  ORDER BY sp.scheduledAt
`);

console.log('\nScheduled posts for 2026-04-20:');
console.log(JSON.stringify(scheduled, null, 2));
