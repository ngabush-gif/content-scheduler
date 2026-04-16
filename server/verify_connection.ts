import { getDb, getConnectionWithCredentials } from "./db";
import { getTokenInfo } from "./facebookOAuth";

async function main() {
  const db = await getDb();
  if (!db) {
    console.error('Could not connect to database');
    process.exit(1);
  }

  // Get the active Facebook connection
  const connectionId = 90001;
  
  console.log('\n=== VERIFYING CONNECTION 90001 ===');
  
  const connection = await getConnectionWithCredentials(connectionId);
  
  if (!connection) {
    console.error('Connection not found!');
    process.exit(1);
  }

  console.log('\nConnection Details:');
  console.log(`- ID: ${connection.id}`);
  console.log(`- Platform: ${connection.platform}`);
  console.log(`- Account Name: ${connection.accountName}`);
  console.log(`- Account ID: ${connection.accountId}`);
  console.log(`- Is Active: ${connection.isActive}`);
  console.log(`- Connected At: ${connection.connectedAt}`);
  console.log(`- Has Access Token: ${!!connection.accessToken}`);

  // Check token validity
  if (connection.accessToken) {
    console.log('\n=== CHECKING TOKEN VALIDITY ===');
    const tokenInfo = await getTokenInfo(connection.accessToken);
    console.log(`- Token Type: ${tokenInfo?.type}`);
    console.log(`- Is Valid: ${tokenInfo?.isValid}`);
    console.log(`- Expires At: ${tokenInfo?.expiresAt}`);
    console.log(`- Scopes: ${tokenInfo?.scopes?.join(', ') || 'N/A'}`);
    console.log(`- Error: ${tokenInfo?.error || 'None'}`);
  }

  console.log('\n✅ Connection is ready for cleanup!');
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
