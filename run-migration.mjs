import mysql from 'mysql2/promise';

const dbUrl = 'mysql://qiAia1ENJ6jK8hF.a1c2f9160ab3:SSDMH4F953p6X5IjsGQc@gateway04.us-east-1.prod.aws.tidbcloud.com:4000/ZaYg9ao8N77sMFoZBt6i77?ssl={"rejectUnauthorized":true}';

try {
  const connection = await mysql.createConnection(dbUrl);
  console.log('✅ Connected to database');
  
  // Execute the migration
  console.log('Executing migration: ALTER TABLE `content_posts` ADD COLUMN IF NOT EXISTS `imagePrompt` text');
  await connection.execute('ALTER TABLE `content_posts` ADD COLUMN IF NOT EXISTS `imagePrompt` text');
  console.log('✅ Migration executed successfully!');
  
  // Verify the column was added
  const [columns] = await connection.execute('DESCRIBE `content_posts`');
  const imagePromptExists = columns.some(col => col.Field === 'imagePrompt');
  console.log('✅ Verification: imagePrompt column exists =', imagePromptExists);
  
  await connection.end();
  process.exit(0);
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
