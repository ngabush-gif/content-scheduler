import mysql from 'mysql2/promise';

const connection = await mysql.createConnection({
  host: process.env.DATABASE_HOST || 'localhost',
  user: process.env.DATABASE_USER || 'root',
  password: process.env.DATABASE_PASSWORD || '',
  database: process.env.DATABASE_NAME || 'content_creator_hub'
});

const [rows] = await connection.execute(
  'SELECT id, title, hashtags, imagePrompt FROM content_posts WHERE id = 570001'
);

console.log('\n=== RAW DATABASE ROW ===');
console.log('ID:', rows[0].id);
console.log('Title:', rows[0].title);
console.log('Hashtags (raw):', rows[0].hashtags);
console.log('Hashtags (type):', typeof rows[0].hashtags);
console.log('ImagePrompt (first 100 chars):', rows[0].imagePrompt?.substring(0, 100));

// Simulate deserialization
let hashtags = rows[0].hashtags;
if (typeof hashtags === 'string') {
  try {
    hashtags = JSON.parse(hashtags);
    console.log('\n✅ Deserialized as JSON array:', hashtags);
  } catch (e) {
    const tags = hashtags.trim().split(/\s+/).filter(tag => tag.length > 0);
    console.log('\n✅ Deserialized as space-separated:', tags);
  }
}

await connection.end();
