// Tarefas em segundo plano (Doc. 03 §12.4). Processo único; para múltiplas instâncias use uma fila/cron externo.
const env = require('../config/env');
const orders = require('../modules/orders/orders.service');
const promotions = require('../modules/promotions/promotions.service');
const notifications = require('../modules/notifications/notifications.service');
const backup = require('./backup.service');
const { query } = require('../database/pool');

const safe = (name, fn) => async () => { try { const r = await fn(); if (r) console.log(`[job:${name}]`, r); } catch (e) { console.error(`[job:${name}] falhou:`, e.message); } };
const timers = [];

function start() {
  timers.push(setInterval(safe('reservas-expiradas', orders.expireReservations), 60e3));
  timers.push(setInterval(safe('promocoes-encerradas', promotions.closeExpired), 5 * 60e3));
  timers.push(setInterval(safe('reenvio-notificacoes', notifications.retryFailed), 5 * 60e3));
  timers.push(setInterval(safe('limpeza-sessoes', async () => {
    await query('DELETE FROM admin_sessions WHERE expires_at < now() OR absolute_expires_at < now()');
    await query("DELETE FROM password_reset_tokens WHERE expires_at < now() - interval '1 day'");
  }), 60 * 60e3));
  if (env.backup.enabled) {     // RF098: backup diário no horário configurado
    let last = '';
    timers.push(setInterval(safe('backup', async () => {
      const now = new Date(); const day = now.toISOString().slice(0, 10);
      if (now.getHours() === env.backup.hour && last !== day) { last = day; return backup.createBackup(); }
    }), 60e3));
  }
  timers.forEach((t) => t.unref());
  safe('reservas-expiradas', orders.expireReservations)();
}
const stop = () => timers.forEach(clearInterval);
module.exports = { start, stop };
