import { getDb } from "./db";
import { scheduledPosts } from "../drizzle/schema";
import { eq } from "drizzle-orm";

async function main() {
  const db = await getDb();
  if (!db) {
    console.error('Could not connect to database');
    process.exit(1);
  }

  // Reset post 390004 to scheduled status
  await db
    .update(scheduledPosts)
    .set({
      status: "scheduled",
      lastError: null,
      publishingStartedAt: null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(scheduledPosts.id, 390004));

  console.log('Reset post 390004 to scheduled status');
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
