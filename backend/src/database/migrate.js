const fs = require('fs');
const path = require('path');
const { pool } = require('./pool');

const dir = path.resolve(__dirname, '../../../database/migrations');

async function migrate() {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  const done = new Set((await pool.query('SELECT filename FROM schema_migrations')).rows.map((r) => r.filename));
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    if (done.has(f)) continue;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(fs.readFileSync(path.join(dir, f), 'utf8'));
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [f]);
      await client.query('COMMIT');
      console.log('[migrate] aplicada:', f);
    } catch (e) {
      await client.query('ROLLBACK');
      throw new Error(`Falha na migração ${f}: ${e.message}`);
    } finally { client.release(); }
  }
  console.log('[migrate] banco atualizado.');
}
module.exports = { migrate };
if (require.main === module) migrate().then(() => pool.end()).catch((e) => { console.error(e.message); process.exit(1); });
