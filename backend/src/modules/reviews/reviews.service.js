const { query } = require('../../database/pool');
const settingsSvc = require('../settings/settings.service');
const { audit } = require('../../services/audit.service');
const { sha256, safeEqual, paginate, pageMeta } = require('../../utils/helpers');
const { notFound, unprocessable, conflict } = require('../../utils/AppError');

const clean = (s) => String(s || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();   // XSS: a exibição também escapa no frontend

/** RF085/RN027: só quem recebeu o produto (pedido entregue) avalia; vínculo com a compra (RN028). */
async function create(code, token, { order_item_id, rating, comment }) {
  const o = (await query('SELECT * FROM orders WHERE order_code=$1', [code])).rows[0];
  if (!o || !safeEqual(sha256(token || ''), o.tracking_token_hash)) throw notFound('Pedido não encontrado');
  if (o.status !== 'pedido_entregue') throw unprocessable('Você poderá avaliar depois que o pedido for entregue');
  const item = (await query('SELECT * FROM order_items WHERE id=$1 AND order_id=$2', [order_item_id, o.id])).rows[0];
  if (!item) throw notFound('Item não encontrado neste pedido');
  const { typed } = await settingsSvc.getTyped();
  try {
    return (await query(`INSERT INTO reviews (product_id, order_item_id, customer_id, rating, comment, status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, status`,
      [item.product_id, item.id, o.customer_id, rating, clean(comment) || null, typed.reviews_require_approval ? 'pendente' : 'publicada'])).rows[0];
  } catch (e) { if (e.code === '23505') throw conflict('Este item já foi avaliado'); throw e; }
}

// RN029: média considera só avaliações publicadas
async function listForProduct(productId) {
  const rows = (await query(`SELECT r.id, r.rating, r.comment, r.created_at, split_part(c.name, ' ', 1) AS customer_name
    FROM reviews r JOIN customers c ON c.id=r.customer_id WHERE r.product_id=$1 AND r.status='publicada' ORDER BY r.id DESC LIMIT 50`, [productId])).rows;
  const sum = (await query(`SELECT round(avg(rating)::numeric,1)::float AS average, count(*)::int AS count FROM reviews WHERE product_id=$1 AND status='publicada'`, [productId])).rows[0];
  return { summary: { average: sum.average || 0, count: sum.count }, reviews: rows };
}

async function listAdmin(f) {
  const p = paginate(f, 20); const w = ['TRUE']; const a = [];
  if (f.status) { a.push(f.status); w.push(`r.status=$${a.length}`); }
  const total = (await query(`SELECT count(*)::int n FROM reviews r WHERE ${w.join(' AND ')}`, a)).rows[0].n;
  const rows = (await query(`SELECT r.*, p.name AS product_name, c.name AS customer_name, o.order_code FROM reviews r
    JOIN products p ON p.id=r.product_id JOIN customers c ON c.id=r.customer_id JOIN order_items oi ON oi.id=r.order_item_id JOIN orders o ON o.id=oi.order_id
    WHERE ${w.join(' AND ')} ORDER BY r.id DESC LIMIT ${p.limit} OFFSET ${p.offset}`, a)).rows;
  return { rows, meta: pageMeta(p, total) };
}
async function setStatus(req, id, status) {
  const r = await query('UPDATE reviews SET status=$2 WHERE id=$1 RETURNING *', [id, status]);
  if (!r.rowCount) throw notFound('Avaliação não encontrada');
  await audit(req, 'avaliacao_moderada', 'reviews', id, null, { status });
  return r.rows[0];
}
module.exports = { create, listForProduct, listAdmin, setStatus };
