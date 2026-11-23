const { query } = require('../database/pool');

/** Registra ação administrativa (usuário, ação, data/hora, valores antes/depois). */
async function audit(req, action, entityType, entityId, oldValues = null, newValues = null, client = null) {
  const q = client ? client.query.bind(client) : query;
  try {
    await q(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values, ip_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [req && req.user ? req.user.id : null, action, entityType, entityId || null,
        oldValues ? JSON.stringify(oldValues) : null, newValues ? JSON.stringify(newValues) : null,
        req && req.ip ? String(req.ip).replace('::ffff:', '') : null]);
  } catch (e) {
    if (client) throw e;           // dentro de transação, a falha deve desfazer
    console.error('[audit] falha ao registrar:', e.message);
  }
}
module.exports = { audit };
