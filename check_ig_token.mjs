import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'localhost',
  user: 'root',
  password: process.env.DATABASE_URL?.split(':')[1]?.split('@')[0],
  database: process.env.DATABASE_URL?.split('/').pop(),
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
});

const conn = await pool.getConnection();
const [rows] = await conn.execute(
  'SELECT id, platform, accountId, accessToken, createdAt, updatedAt FROM platform_connections WHERE platform = "instagram" LIMIT 5'
);
console.log(JSON.stringify(rows, null, 2));
conn.release();
process.exit(0);
