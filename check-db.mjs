import mysql from 'mysql2/promise';

const connection = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'content_creator_hub'
});

const [columns] = await connection.execute(`DESCRIBE content_posts`);
const imagePromptExists = columns.some(col => col.Field === 'imagePrompt');
console.log('imagePrompt column exists:', imagePromptExists);
console.log('All columns:', columns.map(col => col.Field).join(', '));

await connection.end();
