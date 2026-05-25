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

  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const { rows: applied } = await client.query('SELECT name FROM _migrations');
  const appliedSet = new Set(applied.map(r => r.name));

  // Если _migrations пустая, но таблицы уже существуют — значит миграции
  // применялись раньше без трекинга. Обнаруживаем по наличию таблицы masters.
  if (appliedSet.size === 0) {
    const { rows } = await client.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename = 'masters'
    `);
    if (rows.length > 0) {
      console.log('ℹ  Detected existing schema — marking all current migrations as applied');
      const migrationsDir = path.join(__dirname, 'src/infrastructure/supabase/migrations');
      const allFiles = fs.readdirSync(migrationsDir).sort().filter(f => f.endsWith('.sql'));
      for (const file of allFiles) {
        await client.query(
          'INSERT INTO _migrations (name) VALUES ($1) ON CONFLICT DO NOTHING',
          [file]
        );
        appliedSet.add(file);
        console.log(`  ✓ marked: ${file}`);
      }
    }
  }

  const migrationsDir = path.join(__dirname, 'src/infrastructure/supabase/migrations');
  const files = fs.readdirSync(migrationsDir).sort().filter(f => f.endsWith('.sql'));

  let ran = 0;
  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`⏭  ${file} — already applied, skipping`);
      continue;
    }
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    console.log(`Running migration: ${file}`);
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`✓ ${file} — OK`);
      ran++;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`✗ ${file} — ERROR: ${err.message}`);
      await client.end();
      process.exit(1);
    }
  }

  await client.end();
  console.log(`\nDone. ${ran} new migration(s) applied.`);
}

migrate().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
