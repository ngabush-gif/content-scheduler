import { db } from './server/db.ts';

try {
  const result = await db.query.platformConnections.findMany({
    where: { platform: 'instagram' },
  });
  console.log('Instagram connections:', JSON.stringify(result, null, 2));
} catch (e) {
  console.error('Error:', e.message);
}
process.exit(0);
