import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

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

const sql = fs.readFileSync('./drizzle/0011_aromatic_rictor.sql', 'utf8');
console.log('Executing migration:', sql);

await conn.execute(sql);
console.log('Migration applied successfully');

await conn.end();
