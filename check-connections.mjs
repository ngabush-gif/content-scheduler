import { getDb } from './server/db.ts';
import { platformConnections } from './drizzle/schema.ts';

const db = await getDb();

try {
  const connections = await db.select({
    id: platformConnections.id,
    platform: platformConnections.platform,
    accountName: platformConnections.accountName,
    accountId: platformConnections.accountId,
    isActive: platformConnections.isActive
  }).from(platformConnections);
  
  console.log('All platform connections:');
  connections.forEach(c => {
    console.log(`ID: ${c.id}, Platform: ${c.platform}, Account: ${c.accountName}, AccountID: ${c.accountId}, Active: ${c.isActive}`);
  });
  process.exit(0);
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
