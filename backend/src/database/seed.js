const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const env = require('../config/env');
const { pool } = require('./pool');

const dir = path.resolve(__dirname, '../../../database/seeds');

async function seed() {
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    await pool.query(fs.readFileSync(path.join(dir, f), 'utf8'));
    console.log('[seed] executado:', f);
  }
  const { rows } = await pool.query('SELECT id FROM users WHERE lower(email)=lower($1)', [env.admin.email]);
  if (!rows.length) {
    const hash = await bcrypt.hash(env.admin.password, 12);
    const u = await pool.query(
      `INSERT INTO users (name, email, password_hash) VALUES ($1,$2,$3) RETURNING id`,
      [env.admin.name, env.admin.email, hash]);
    await pool.query(`INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE name='Administrador'`, [u.rows[0].id]);
    console.log(`[seed] administrador criado: ${env.admin.email} (troque a senha no primeiro acesso!)`);
  } else console.log('[seed] administrador já existe.');
}
module.exports = { seed };
if (require.main === module) seed().then(() => pool.end()).catch((e) => { console.error(e); process.exit(1); });
