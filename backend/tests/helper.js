// Helper de testes: exige um banco DEDICADO (nome contendo "test"); recria o schema a cada execução.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (!/test/i.test(process.env.DATABASE_URL || '')) { console.error('Defina TEST_DATABASE_URL apontando para um banco de testes (nome contendo "test").'); process.exit(1); }
process.env.MAPS_PROVIDER = 'haversine';
process.env.NODE_ENV = 'test';
process.env.ADMIN_EMAIL = 'admin@teste.com'; process.env.ADMIN_PASSWORD = 'Senha@12345';

const http = require('http');
const { pool } = require('../src/database/pool');
const { migrate } = require('../src/database/migrate');
const { seed } = require('../src/database/seed');
const app = require('../src/app');

let server; let base;
async function setup() {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await migrate(); await seed();
  server = http.createServer(app); await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}/api/v1`;
  return base;
}
async function teardown() { await new Promise((r) => server.close(r)); await pool.end(); }

async function api(method, path, { body, cookies, headers = {} } = {}) {
  const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(cookies ? { Cookie: cookies.cookie, 'X-CSRF-Token': cookies.csrf } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json, headers: res.headers };
}
async function login(email = 'admin@teste.com', password = 'Senha@12345') {
  const res = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const j = await res.json();
  if (res.status !== 200) return { status: res.status, body: j };
  const cookie = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  return { status: 200, cookie, csrf: j.data.csrf_token, user: j.data.user };
}
module.exports = { setup, teardown, api, login, pool };
