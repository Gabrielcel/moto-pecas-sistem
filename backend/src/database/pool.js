const { Pool, types } = require('pg');
const env = require('../config/env');

types.setTypeParser(20, (v) => parseInt(v, 10));      // BIGINT -> number
types.setTypeParser(1700, (v) => parseFloat(v));      // NUMERIC -> number (2 casas; cálculos usam centavos)

const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: env.databaseSsl ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30000,
});
pool.on('error', (err) => console.error('[db] erro em conexão ociosa:', err.message));

const query = (text, params) => pool.query(text, params);

/** Executa fn(client) dentro de uma transação; faz rollback em caso de erro. */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }
}
module.exports = { pool, query, withTransaction };
