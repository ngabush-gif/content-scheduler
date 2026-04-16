import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

// Parse connection string: mysql://user:pass@host/db
const match = dbUrl.match(/mysql:\/\/([^:]+):([^@]+)@([^/]+)\/(.+)/);
if (!match) {
  console.error('Invalid DATABASE_URL format');
  process.exit(1);
}

const [, user, password, host, database] = match;

const conn = await mysql.createConnection({
  host,
  user,
  password,
  database,
});

const [rows] = await conn.execute(
  'SELECT id, platform, accountName, accountId, isActive, expiresAt, updatedAt FROM platform_connections WHERE platform = "instagram"'
);

console.log('Instagram connections:');
console.log(JSON.stringify(rows, null, 2));

await conn.end();
