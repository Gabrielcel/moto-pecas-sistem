// Controle de estoque. Disponível = físico − reservado (RN013).
// As funções reserve/release/consume são atômicas (UPDATE condicional bloqueia a linha → sem venda dupla).
const { query, withTransaction } = require('../../database/pool');
const { audit } = require('../../services/audit.service');
const { unprocessable, notFound, conflict } = require('../../utils/AppError');
const { paginate, pageMeta } = require('../../utils/helpers');

const movement = (c, { productId, userId, orderId, type, qty, reason }) => c.query(
  'INSERT INTO inventory_movements (product_id, user_id, order_id, movement_type, quantity, reason) VALUES ($1,$2,$3,$4,$5,$6)',
  [productId, userId || null, orderId || null, type, qty, reason || null]);

async function reserve(c, productId, qty, orderId) {
  const r = await c.query('UPDATE inventory SET reserved_quantity = reserved_quantity + $2 WHERE product_id=$1 AND quantity - reserved_quantity >= $2', [productId, qty]);
  if (!r.rowCount) return false;
  await movement(c, { productId, orderId, type: 'reserva', qty, reason: 'Reserva de pedido' });
  return true;
}
async function release(c, productId, qty, orderId, userId, reason) {
  await c.query('UPDATE inventory SET reserved_quantity = GREATEST(reserved_quantity - $2, 0) WHERE product_id=$1', [productId, qty]);
  await movement(c, { productId, orderId, userId, type: 'liberacao_reserva', qty, reason: reason || 'Liberação de reserva' });
}
async function consume(c, productId, qty, orderId, userId) {      // pedido entregue: baixa física + fim da reserva
  await c.query('UPDATE inventory SET quantity = quantity - $2, reserved_quantity = reserved_quantity - $2 WHERE product_id=$1', [productId, qty]);
  await movement(c, { productId, orderId, userId, type: 'saida', qty, reason: 'Saída por venda entregue' });
}

async function manualMovement(req, { product_id, movement_type, quantity, reason }) {
  return withTransaction(async (c) => {
    const inv = (await c.query('SELECT * FROM inventory WHERE product_id=$1 FOR UPDATE', [product_id])).rows[0];
    if (!inv) throw notFound('Produto sem registro de estoque');
    const plus = movement_type === 'entrada' || movement_type === 'ajuste_positivo';
    const r = await c.query(
      plus ? 'UPDATE inventory SET quantity = quantity + $2 WHERE product_id=$1'
           : 'UPDATE inventory SET quantity = quantity - $2 WHERE product_id=$1 AND quantity - reserved_quantity >= $2',
      [product_id, quantity]);
    if (!r.rowCount) throw conflict(`Quantidade indisponível: há ${inv.quantity - inv.reserved_quantity} un. disponíveis (o restante está reservado)`);
    await movement(c, { productId: product_id, userId: req.user.id, type: movement_type, qty: quantity, reason });
    const after = (await c.query('SELECT * FROM inventory WHERE product_id=$1', [product_id])).rows[0];
    await audit(req, 'estoque_alterado', 'inventory', inv.id, { quantity: inv.quantity }, { quantity: after.quantity, movement_type, reason }, c);   // RN017
    return after;
  });
}

const LOW = '(i.quantity - i.reserved_quantity) <= i.minimum_quantity';   // RN016: considera reservas
async function list(f) {
  const p = paginate(f, 30); const w = ['TRUE']; const a = [];
  if (f.search) { a.push(`%${f.search}%`); w.push(`(unaccent(p.name) ILIKE unaccent($${a.length}) OR p.reference ILIKE $${a.length})`); }
  if (f.low === '1' || f.low === true) w.push(LOW);
  const total = (await query(`SELECT count(*)::int n FROM inventory i JOIN products p ON p.id=i.product_id WHERE ${w.join(' AND ')}`, a)).rows[0].n;
  const rows = (await query(`SELECT p.id AS product_id, p.name, p.reference, p.status, i.quantity, i.reserved_quantity, i.minimum_quantity,
      (i.quantity - i.reserved_quantity) AS available_quantity, (${LOW}) AS is_low, i.updated_at
      FROM inventory i JOIN products p ON p.id=i.product_id WHERE ${w.join(' AND ')} ORDER BY is_low DESC, p.name LIMIT ${p.limit} OFFSET ${p.offset}`, a)).rows;
  return { rows, meta: pageMeta(p, total) };
}
async function movements(f) {
  const p = paginate(f, 30); const w = ['TRUE']; const a = [];
  if (f.product_id) { a.push(f.product_id); w.push(`m.product_id=$${a.length}`); }
  if (f.type) { a.push(f.type); w.push(`m.movement_type=$${a.length}`); }
  const total = (await query(`SELECT count(*)::int n FROM inventory_movements m WHERE ${w.join(' AND ')}`, a)).rows[0].n;
  const rows = (await query(`SELECT m.*, p.name AS product_name, u.name AS user_name, o.order_code FROM inventory_movements m
      JOIN products p ON p.id=m.product_id LEFT JOIN users u ON u.id=m.user_id LEFT JOIN orders o ON o.id=m.order_id
      WHERE ${w.join(' AND ')} ORDER BY m.id DESC LIMIT ${p.limit} OFFSET ${p.offset}`, a)).rows;
  return { rows, meta: pageMeta(p, total) };
}
async function setMinimum(req, productId, min) {
  const r = await query('UPDATE inventory SET minimum_quantity=$2 WHERE product_id=$1 RETURNING *', [productId, min]);
  if (!r.rowCount) throw notFound('Produto sem registro de estoque');
  await audit(req, 'estoque_minimo_alterado', 'inventory', r.rows[0].id, null, { minimum_quantity: min });
  return r.rows[0];
}
const lowStock = async (limit = 10) => (await query(`SELECT p.id AS product_id, p.name, i.quantity, i.reserved_quantity, i.minimum_quantity,
  (i.quantity - i.reserved_quantity) AS available_quantity FROM inventory i JOIN products p ON p.id=i.product_id
  WHERE p.status='ativo' AND ${LOW} ORDER BY (i.quantity - i.reserved_quantity), p.name LIMIT $1`, [limit])).rows;

module.exports = { reserve, release, consume, manualMovement, list, movements, setMinimum, lowStock, movement };
