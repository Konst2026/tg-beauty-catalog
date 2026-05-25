const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function migrate() {
  const client = new Client({
    connectionString: process.env.DATABASE_DIRECT_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('Connected to Supabase PostgreSQL');

  const migrationsDir = path.join(__dirname, 'src/infrastructure/supabase/migrations');
  const files = fs.readdirSync(migrationsDir).sort();

  for (const file of files) {
    if (!file.endsWith('.sql')) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    console.log(`Running migration: ${file}`);
    try {
      await client.query(sql);
      console.log(`✓ ${file} — OK`);
    } catch (err) {
      console.error(`✗ ${file} — ERROR: ${err.message}`);
      await client.end();
      process.exit(1);
    }
  }

  await client.end();
  console.log('\nAll migrations completed successfully.');
}

migrate().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
