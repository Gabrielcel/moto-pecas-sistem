// Notificações do pedido (WhatsApp). Falhas NUNCA cancelam pedidos (RN020); todo envio é registrado (RN021).
const { query } = require('../../database/pool');
const wa = require('../../services/whatsapp.service');
const env = require('../../config/env');
const settings = require('../settings/settings.service');

const fmt = (n) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const TEMPLATES = {
  pedido_recebido: (o, x) => `Olá, ${o.customer_name}! Recebemos seu pedido #${o.order_code} (${fmt(o.total)}). Em breve confirmaremos os detalhes com você.${x.trackingUrl ? `\nAcompanhe: ${x.trackingUrl}` : ''}`,
  pedido_confirmado: (o) => `Seu pedido #${o.order_code} foi confirmado! Total: ${fmt(o.total)}. Pagamento combinado na entrega.`,
  preparando_pedido: (o) => `Estamos preparando seu pedido #${o.order_code}.`,
  saiu_para_entrega: (o, x) => `Seu pedido #${o.order_code} saiu para entrega!${x.eta ? ` Previsão: ${x.eta}.` : ''}`,
  pedido_entregue: (o) => `Pedido #${o.order_code} entregue. Obrigado pela preferência! Avalie suas peças pelo link de acompanhamento.`,
  pedido_cancelado: (o) => `Seu pedido #${o.order_code} foi cancelado.${o.cancel_reason ? ` Motivo: ${o.cancel_reason}.` : ''} Qualquer dúvida, fale conosco.`,
};

async function deliver(notificationId, phone, message) {
  const prev = (await query('SELECT count(*)::int n FROM notification_attempts WHERE notification_id=$1', [notificationId])).rows[0].n;
  const r = await wa.sendText(phone, message);
  const result = r.ok ? 'enviada' : (r.configured ? 'falhou' : 'nao_configurado');
  await query('INSERT INTO notification_attempts (notification_id, attempt_number, result, error_message) VALUES ($1,$2,$3,$4)', [notificationId, prev + 1, result, r.error || null]);
  await query('UPDATE notifications SET status=$2::varchar, external_reference=$3, sent_at=CASE WHEN $2::varchar=\'enviada\' THEN now() ELSE sent_at END WHERE id=$1', [notificationId, result, r.id || null]);
  return result;
}

async function loadOrder(orderId) {
  return (await query(`SELECT o.*, c.name AS customer_name, c.phone, d.estimated_delivery_at
    FROM orders o JOIN customers c ON c.id=o.customer_id LEFT JOIN order_deliveries d ON d.order_id=o.id WHERE o.id=$1`, [orderId])).rows[0];
}

/** Dispara notificação automática de status, respeitando a autorização do cliente (RN018). Não lança erro. */
async function notifyStatus(orderId, type, extra = {}) {
  try {
    const o = await loadOrder(orderId);
    if (!o || !o.whatsapp_consent || !TEMPLATES[type]) return null;
    const eta = o.estimated_delivery_at ? new Date(o.estimated_delivery_at).toLocaleString('pt-BR', { timeZone: 'America/Fortaleza', dateStyle: 'short', timeStyle: 'short' }) : null;
    const message = TEMPLATES[type](o, { ...extra, eta });
    const n = (await query(`INSERT INTO notifications (order_id, customer_id, channel, notification_type, message) VALUES ($1,$2,'whatsapp',$3,$4) RETURNING id`, [o.id, o.customer_id, type, message])).rows[0];
    return await deliver(n.id, o.phone, message);
  } catch (e) { console.error('[notificacao] falha:', e.message); return null; }
}

/** Aviso ao responsável sobre novo pedido aguardando confirmação (se a API estiver configurada). */
async function notifyAdminNewOrder(orderCode, total) {
  try {
    if (!env.whatsapp.adminNotifyPhone || !wa.isConfigured()) return;
    await wa.sendText(env.whatsapp.adminNotifyPhone, `Novo pedido #${orderCode} aguardando confirmação (${fmt(total)}). Abra o painel para analisar.`);
  } catch (_) { /* silencioso */ }
}

async function sendManual(req, orderId, message) {
  const o = await loadOrder(orderId); if (!o) return null;
  const n = (await query(`INSERT INTO notifications (order_id, customer_id, channel, notification_type, message) VALUES ($1,$2,'whatsapp','manual',$3) RETURNING id`, [o.id, o.customer_id, message])).rows[0];
  const status = await deliver(n.id, o.phone, message);
  return { id: n.id, status, wa_link: wa.waLink(o.phone, message) };
}

async function retryFailed() {
  const { rows } = await query(`SELECT n.id, n.message, c.phone FROM notifications n JOIN customers c ON c.id=n.customer_id
    WHERE n.status='falhou' AND n.created_at > now() - interval '24 hours'
      AND (SELECT count(*) FROM notification_attempts a WHERE a.notification_id=n.id) < 3`);
  for (const r of rows) await deliver(r.id, r.phone, r.message);
  return rows.length;
}
const list = async (orderId) => (await query(`SELECT n.*, (SELECT count(*)::int FROM notification_attempts a WHERE a.notification_id=n.id) AS attempts
  FROM notifications n WHERE ($1::bigint IS NULL OR n.order_id=$1) ORDER BY n.id DESC LIMIT 100`, [orderId || null])).rows;
const retry = async (id) => { const r = (await query(`SELECT n.id, n.message, c.phone FROM notifications n JOIN customers c ON c.id=n.customer_id WHERE n.id=$1`, [id])).rows[0]; return r ? deliver(r.id, r.phone, r.message) : null; };
module.exports = { notifyStatus, notifyAdminNewOrder, sendManual, retryFailed, list, retry };
