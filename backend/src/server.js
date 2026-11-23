const env = require('./config/env');
const app = require('./app');
const { pool } = require('./database/pool');
const scheduler = require('./services/scheduler');

const server = app.listen(env.port, () => {
  console.log(`[servidor] Moto Peças Sistem — http://localhost:${env.port} (${env.nodeEnv})`);
  scheduler.start();
});
const shutdown = (sig) => { console.log(`[servidor] ${sig} — encerrando...`); scheduler.stop(); server.close(() => pool.end().then(() => process.exit(0))); setTimeout(() => process.exit(1), 10000).unref(); };
['SIGINT', 'SIGTERM'].forEach((s) => process.on(s, () => shutdown(s)));
process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e));
