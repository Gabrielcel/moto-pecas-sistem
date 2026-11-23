// Backup do PostgreSQL com pg_dump (formato custom). Requer o cliente PostgreSQL (pg_dump) instalado.
const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');
const env = require('../config/env');

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');

function run(cmd, args, opts) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, opts); let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', reject);
    p.on('close', (c) => (c === 0 ? resolve() : reject(new Error(`${cmd} saiu com código ${c}: ${err.trim()}`))));
  });
}

async function createBackup() {
  fs.mkdirSync(env.backup.dir, { recursive: true });
  const file = path.join(env.backup.dir, `motopecas-${stamp()}.dump`);
  await run('pg_dump', ['--format=custom', '--no-owner', '--file', file, env.databaseUrl], { env: process.env });
  fs.chmodSync(file, 0o600);
  // RF099: cópia em local separado do servidor principal
  if (env.backup.externalDir) {
    fs.mkdirSync(env.backup.externalDir, { recursive: true });
    fs.copyFileSync(file, path.join(env.backup.externalDir, path.basename(file)));
  }
  if (env.backup.uploadCommand) {
    await new Promise((res, rej) => exec(env.backup.uploadCommand.replace('{file}', `"${file}"`), (e) => (e ? rej(e) : res())));
  }
  pruneOld(env.backup.dir); if (env.backup.externalDir) pruneOld(env.backup.externalDir);
  return file;
}

// RF100: retenção configurável (padrão 14 dias; planejado entre 7 e 30)
function pruneOld(dir) {
  const limit = Date.now() - env.backup.retentionDays * 86400e3;
  for (const f of fs.readdirSync(dir)) {
    if (!/^motopecas-.*\.dump$/.test(f)) continue;
    const full = path.join(dir, f);
    if (fs.statSync(full).mtimeMs < limit) fs.unlinkSync(full);
  }
}

async function restoreBackup(file) {
  await run('pg_restore', ['--clean', '--if-exists', '--no-owner', '--dbname', env.databaseUrl, file], { env: process.env });
}
module.exports = { createBackup, restoreBackup };
