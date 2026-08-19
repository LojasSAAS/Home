/* eslint-disable @typescript-eslint/no-var-requires */
require('dotenv/config');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function run() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  const migrationsDir = path.join(__dirname, '..', 'src', 'database', 'migrations');
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    console.log(`Aplicando migration: ${file}`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    await pool.query(sql);
  }

  console.log('Migrations aplicadas com sucesso.');
  await pool.end();
}

run().catch((err) => {
  console.error('Falha ao rodar migrations:', err);
  process.exit(1);
});
