const { query, withTransaction } = require('../../database/pool');
const inventory = require('../inventory/inventory.service');
const delivery = require('../delivery/delivery.service');
const settingsSvc = require('../settings/settings.service');
const notifications = require('../notifications/notifications.service');
const { PROMO_JOIN } = require('../promotions/pricing');
const { audit } = require('../../services/audit.service');
const { nextOpening, isOpenAt } = require('../../services/business-hours');
const maps = require('../../services/maps.service');
const wa = require('../../services/whatsapp.service');
const env = require('../../config/env');
const { randomToken, sha256, toCents, fromCents, normPhone, paginate, pageMeta, likeEscape, digits } = require('../../utils/helpers');
const { AppError, conflict, notFound, unprocessable } = require('../../utils/AppError');

// Máquina de estados (Doc. 00 §4). "saiu_para_entrega" só existe para entrega; retirada vai de preparando → entregue.
const TRANSITIONS = {
  pedido_recebido: ['pedido_confirmado', 'pedido_cancelado'],
  pedido_confirmado: ['preparando_pedido', 'pedido_cancelado'],
  preparando_pedido: ['saiu_para_entrega', 'pedido_entregue', 'pedido_cancelado'],
  saiu_para_entrega: ['pedido_entregue', 'pedido_cancelado'],
  pedido_entregue: [], pedido_cancelado: [],
};
const FINAL = ['pedido_entregue', 'pedido_cancelado'];

// ---------------------------------------------------------------- criação
async function create(req, b) {
  const merged = new Map();                      // junta itens repetidos
  b.items.forEach((i) => merged.set(i.product_id, (merged.get(i.product_id) || 0) + i.quantity));
  const items = [...merged.entries()].map(([product_id, quantity]) => ({ product_id, quantity })).sort((x, y) => x.product_id - y.product_id);   // ordem fixa evita deadlock

  const { typed, raw } = await settingsSvc.getTyped();
  if (b.receiving_method === 'entrega' && !typed.accept_delivery) throw unprocessable('Entregas indisponíveis no momento');
  if (b.receiving_method === 'retirada' && !typed.accept_pickup) throw unprocessable('Retirada na loja indisponível no momento');

  // frete: calculado FORA da transação (chama serviços externos)
  let est = null; let feeCents = 0;
  if (b.receiving_method === 'entrega') { est = await delivery.estimate(b.address); feeCents = toCents(est.fee); }

  const token = randomToken(32);
  const now = new Date();
  const base = isOpenAt(raw, now) ? now : nextOpening(raw, now);     // RN012: fora do horário, o prazo conta a partir da abertura
  const expires = new Date(base.getTime() + typed.reservation_minutes * 60e3);

  const order = await withTransaction(async (c) => {
    const ids = items.map((i) => i.product_id);
    const prods = (await c.query(`SELECT p.id, p.name, p.reference, p.sale_price, p.purchase_cost, p.status, promo.promo_price
        FROM products p ${PROMO_JOIN} WHERE p.id = ANY($1::bigint[])`, [ids])).rows;
    const byId = new Map(prods.map((p) => [p.id, p]));

    let subtotal = 0; let discount = 0; const lines = [];
    for (const it of items) {
      const p = byId.get(it.product_id);
      if (!p || p.status !== 'ativo') throw conflict('Um dos produtos não está mais disponível', [{ product_id: it.product_id }]);
      const list = toCents(p.sale_price); const unit = p.promo_price != null ? toCents(p.promo_price) : list;
      subtotal += list * it.quantity; discount += (list - unit) * it.quantity;
      lines.push({ ...it, p, list, unit });
    }
    const total = subtotal - discount + feeCents;

    // cliente: identifica por telefone (compra sem conta)
    const phone = normPhone(b.customer.phone);
    let cust = (await c.query('SELECT id FROM customers WHERE phone=$1 ORDER BY id LIMIT 1', [phone])).rows[0];
    if (cust) await c.query('UPDATE customers SET name=$2, email=COALESCE($3,email) WHERE id=$1', [cust.id, b.customer.name, b.customer.email || null]);
    else cust = (await c.query('INSERT INTO customers (name, email, phone, cpf) VALUES ($1,$2,$3,$4) RETURNING id', [b.customer.name, b.customer.email || null, phone, b.customer.cpf || null])).rows[0];

    const o = (await c.query(`INSERT INTO orders (order_code, tracking_token_hash, customer_id, subtotal, discount_total, delivery_fee, delivery_fee_estimate, total,
          receiving_method, whatsapp_consent, payment_method_preferred, notes, reservation_expires_at)
        VALUES (lpad(nextval('order_code_seq')::text, 6, '0'), $1,$2,$3,$4,$5,$5,$6,$7,$8,$9,$10,$11) RETURNING id, order_code`,
      [sha256(token), cust.id, fromCents(subtotal), fromCents(discount), fromCents(feeCents), fromCents(total), b.receiving_method,
        b.whatsapp_consent, b.payment_method_preferred || null, b.notes || null, expires])).rows[0];

    for (const l of lines) {
      await c.query(`INSERT INTO order_items (order_id, product_id, product_name, product_reference, quantity, unit_price, unit_cost, discount_amount, total, list_price)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [o.id, l.product_id, l.p.name, l.p.reference, l.quantity, fromCents(l.unit), l.p.purchase_cost, fromCents((l.list - l.unit) * l.quantity), fromCents(l.unit * l.quantity), fromCents(l.list)]);
    }
    // reserva atômica: o UPDATE condicional impede reservas concorrentes acima do disponível (RN014);
    // se qualquer item falhar, a transação inteira é revertida (pedido + reservas).
    for (const l of lines) {
      if (!(await inventory.reserve(c, l.product_id, l.quantity, o.id))) {
        throw conflict(`Estoque insuficiente para "${l.p.name}"`, [{ product_id: l.product_id, product_name: l.p.name }]);
      }
    }
    await c.query(`INSERT INTO order_status_history (order_id, previous_status, new_status, notes) VALUES ($1,NULL,'pedido_recebido','Pedido registrado pelo site')`, [o.id]);

    if (b.receiving_method === 'entrega') {
      const a = b.address;
      const d = (await c.query(`INSERT INTO order_deliveries (order_id, delivery_region_id, postal_code, street, number, complement, neighborhood, city, state, reference, latitude, longitude, distance_km)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
      [o.id, est.region_id, a.postal_code || null, a.street, a.number || null, a.complement || null, a.neighborhood || null, a.city, a.state, a.reference || null, est.latitude, est.longitude, est.distance_km])).rows[0];
      await c.query(`INSERT INTO delivery_status_history (order_delivery_id, status, notes) VALUES ($1,'pedido_recebido','Endereço registrado')`, [d.id]);
      const dup = await c.query('SELECT 1 FROM customer_addresses WHERE customer_id=$1 AND street=$2 AND COALESCE(number,\'\')=$3 AND city=$4', [cust.id, a.street, a.number || '', a.city]);
      if (!dup.rowCount) await c.query(`INSERT INTO customer_addresses (customer_id, postal_code, street, number, complement, neighborhood, city, state, reference) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [cust.id, a.postal_code || null, a.street, a.number || null, a.complement || null, a.neighborhood || null, a.city, a.state, a.reference || null]);
    }
    return { id: o.id, code: o.order_code, total: fromCents(total), subtotal: fromCents(subtotal), discount: fromCents(discount), fee: fromCents(feeCents) };
  });

  const trackingUrl = `${env.frontendUrl}/loja/pages/acompanhar.html?c=${order.code}#t=${token}`;
  // pós-commit, em segundo plano: notificações não bloqueiam nem cancelam o pedido
  setImmediate(() => {
    notifications.notifyStatus(order.id, 'pedido_recebido', { trackingUrl });
    notifications.notifyAdminNewOrder(order.code, order.total);
  });
  const msg = `Olá! Fiz o pedido #${order.code} pelo site. Gostaria de confirmar os detalhes da compra.`;
  return {
    order_code: order.code, tracking_token: token, tracking_url: trackingUrl, status: 'pedido_recebido',
    subtotal: order.subtotal, discount_total: order.discount, delivery_fee: order.fee, total: order.total,
    reservation_expires_at: expires, whatsapp_url: wa.waLink(typed.store_phone, msg), whatsapp_message: msg, store_phone: typed.store_phone,
  };
}

// ---------------------------------------------------------------- mudança de status
/** Aplica a transição dentro de uma transação já aberta. userId=null → ação do sistema. */
async function applyStatus(c, orderId, userId, b, req) {
  const o = (await c.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE', [orderId])).rows[0];
  if (!o) throw notFound('Pedido não encontrado');
  const next = b.status;
  if (!TRANSITIONS[o.status].includes(next)) throw conflict(`Não é possível mudar de "${o.status}" para "${next}"`);
  if (next === 'saiu_para_entrega' && o.receiving_method !== 'entrega') throw unprocessable('Pedido para retirada não "sai para entrega"');
  if (next === 'pedido_entregue' && o.status === 'preparando_pedido' && o.receiving_method === 'entrega') throw unprocessable('Pedido para entrega deve passar por "saiu para entrega"');
  if (next === 'pedido_cancelado' && userId && !(b.notes && b.notes.trim().length >= 3)) throw unprocessable('Informe o motivo do cancelamento', [{ field: 'notes', message: 'Obrigatório' }]);

  const items = (await c.query('SELECT product_id, quantity FROM order_items WHERE order_id=$1', [orderId])).rows;
  const sets = ['status=$2']; const args = [orderId, next];
  const push = (sql, v) => { args.push(v); sets.push(sql.replace('?', `$${args.length}`)); };

  if (next === 'pedido_confirmado') { sets.push('confirmed_at=now()', 'reservation_expires_at=NULL'); }     // reserva passa a valer até a entrega
  if (next === 'pedido_entregue') {
    sets.push('delivered_at=now()', 'reservation_expires_at=NULL');
    for (const it of items) await inventory.consume(c, it.product_id, it.quantity, orderId, userId);        // baixa física
    if (b.payment) {
      await c.query(`INSERT INTO payments (order_id, payment_method, amount, status, transaction_reference, paid_at, user_id) VALUES ($1,$2,$3,'pago',$4,now(),$5)`,
        [orderId, b.payment.payment_method, o.total, b.payment.transaction_reference || null, userId]);
      sets.push("payment_status='pago'");
    }
  }
  if (next === 'pedido_cancelado') {
    sets.push('cancelled_at=now()', 'reservation_expires_at=NULL');
    push('cancel_reason=?', b.notes || null);
    for (const it of items) await inventory.release(c, it.product_id, it.quantity, orderId, userId, 'Pedido cancelado');   // RN010
    sets.push("payment_status='cancelado'");
    await c.query("UPDATE payments SET status='cancelado' WHERE order_id=$1 AND status='pendente'", [orderId]);
  }
  if (b.delivery_fee !== undefined && !FINAL.includes(next)) {
    push('delivery_fee=?', b.delivery_fee); push('total=subtotal - discount_total + ?', b.delivery_fee);
  }
  await c.query(`UPDATE orders SET ${sets.join(', ')} WHERE id=$1`, args);

  const d = (await c.query('SELECT id FROM order_deliveries WHERE order_id=$1', [orderId])).rows[0];
  if (d) {
    if (b.estimated_delivery_at !== undefined || b.carrier) await c.query('UPDATE order_deliveries SET estimated_delivery_at=COALESCE($2, estimated_delivery_at), carrier=COALESCE($3, carrier) WHERE id=$1', [d.id, b.estimated_delivery_at || null, b.carrier || null]);
    await c.query('INSERT INTO delivery_status_history (order_delivery_id, user_id, status, notes) VALUES ($1,$2,$3,$4)', [d.id, userId, next, b.notes || null]);
  }
  await c.query('INSERT INTO order_status_history (order_id, user_id, previous_status, new_status, notes) VALUES ($1,$2,$3,$4,$5)', [orderId, userId, o.status, next, b.notes || null]);
  if (req) await audit(req, next === 'pedido_cancelado' ? 'pedido_cancelado' : 'pedido_status_alterado', 'orders', orderId, { status: o.status }, { status: next, notes: b.notes }, c);
  return { previous: o.status, next };
}

async function changeStatus(req, orderId, b) {
  const r = await withTransaction((c) => applyStatus(c, orderId, req.user.id, b, req));
  setImmediate(() => notifications.notifyStatus(orderId, r.next));
  return getAdmin(orderId);
}

/** Expira reservas de pedidos não confirmados e devolve o estoque (chamado pelo agendador). */
async function expireReservations() {
  const { rows } = await query("SELECT id FROM orders WHERE status='pedido_recebido' AND reservation_expires_at IS NOT NULL AND reservation_expires_at < now() ORDER BY id");
  let n = 0;
  for (const r of rows) {
    try {
      await withTransaction((c) => applyStatus(c, r.id, null, { status: 'pedido_cancelado', notes: 'Reserva expirada sem confirmação do responsável' }, null));
      setImmediate(() => notifications.notifyStatus(r.id, 'pedido_cancelado')); n++;
    } catch (e) { if (!(e instanceof AppError)) console.error('[expirar reserva]', r.id, e.message); }
  }
  return n;
}

async function updateDelivery(req, id, b) {
  await withTransaction(async (c) => {
    const o = (await c.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE', [id])).rows[0]; if (!o) throw notFound('Pedido não encontrado');
    if (FINAL.includes(o.status)) throw conflict('Pedido já finalizado');
    if (b.delivery_fee !== undefined) await c.query('UPDATE orders SET delivery_fee=$2, total=subtotal - discount_total + $2 WHERE id=$1', [id, b.delivery_fee]);
    if (b.estimated_delivery_at !== undefined || b.carrier) await c.query('UPDATE order_deliveries SET estimated_delivery_at=COALESCE($2, estimated_delivery_at), carrier=COALESCE($3, carrier) WHERE order_id=$1', [id, b.estimated_delivery_at || null, b.carrier || null]);
    await audit(req, 'entrega_atualizada', 'orders', id, { delivery_fee: o.delivery_fee }, b, c);
  });
  return getAdmin(id);
}

async function addPayment(req, id, b) {
  await withTransaction(async (c) => {
    const o = (await c.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE', [id])).rows[0]; if (!o) throw notFound('Pedido não encontrado');
    if (o.status === 'pedido_cancelado') throw conflict('Pedido cancelado');
    const paid = b.status === 'pago';
    await c.query('INSERT INTO payments (order_id, payment_method, amount, status, transaction_reference, paid_at, user_id) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [id, b.payment_method, b.amount ?? o.total, b.status, b.transaction_reference || null, paid ? new Date() : null, req.user.id]);
    if (paid) await c.query("UPDATE orders SET payment_status='pago' WHERE id=$1", [id]);
    await audit(req, 'pagamento_registrado', 'orders', id, null, b, c);
  });
  return getAdmin(id);
}

// ---------------------------------------------------------------- consultas
async function list(f) {
  const p = paginate(f, 20); const w = ['TRUE']; const a = [];
  const add = (sql, v) => { a.push(v); w.push(sql.replace(/\?/g, `$${a.length}`)); };
  if (f.status) add('o.status = ANY(string_to_array(?, \',\'))', f.status);
  if (f.awaiting === '1') w.push("o.status = 'pedido_recebido'");
  if (f.receiving_method) add('o.receiving_method = ?', f.receiving_method);
  if (f.from) add('o.created_at >= ?::date', f.from);
  if (f.to) add('o.created_at < (?::date + 1)', f.to);
  if (f.q) { const t = `%${likeEscape(f.q.replace(/^#/, ''))}%`; a.push(t); const n = a.length; a.push(`%${digits(f.q)}%`);
    w.push(`(o.order_code ILIKE $${n} OR unaccent(c.name) ILIKE unaccent($${n}) OR ($${a.length} <> '%%' AND c.phone LIKE $${a.length}))`); }
  const from = 'FROM orders o JOIN customers c ON c.id=o.customer_id LEFT JOIN order_deliveries d ON d.order_id=o.id';
  const total = (await query(`SELECT count(*)::int n ${from} WHERE ${w.join(' AND ')}`, a)).rows[0].n;
  const rows = (await query(`SELECT o.id, o.order_code, o.status, o.total, o.payment_status, o.receiving_method, o.created_at, o.reservation_expires_at,
      c.name AS customer_name, c.phone AS customer_phone, d.city, d.neighborhood
      ${from} WHERE ${w.join(' AND ')} ORDER BY (o.status='pedido_recebido') DESC, o.id DESC LIMIT ${p.limit} OFFSET ${p.offset}`, a)).rows;
  return { rows, meta: pageMeta(p, total) };
}

async function getAdmin(id) {
  const o = (await query(`SELECT o.*, c.name AS customer_name, c.phone AS customer_phone, c.email AS customer_email
    FROM orders o JOIN customers c ON c.id=o.customer_id WHERE o.id=$1`, [id])).rows[0];
  if (!o) throw notFound('Pedido não encontrado');
  delete o.tracking_token_hash;
  o.items = (await query('SELECT * FROM order_items WHERE order_id=$1 ORDER BY id', [id])).rows;
  o.delivery = (await query('SELECT * FROM order_deliveries WHERE order_id=$1', [id])).rows[0] || null;
  o.payments = (await query('SELECT pm.*, u.name AS user_name FROM payments pm LEFT JOIN users u ON u.id=pm.user_id WHERE order_id=$1 ORDER BY pm.id', [id])).rows;
  o.history = (await query('SELECT h.*, u.name AS user_name FROM order_status_history h LEFT JOIN users u ON u.id=h.user_id WHERE order_id=$1 ORDER BY h.id', [id])).rows;
  o.notifications = await notifications.list(id);
  o.allowed_transitions = TRANSITIONS[o.status].filter((s) => !(s === 'saiu_para_entrega' && o.receiving_method !== 'entrega') && !(s === 'pedido_entregue' && o.status === 'preparando_pedido' && o.receiving_method === 'entrega'));
  o.profit = o.items.reduce((s, i) => s + (i.total - i.unit_cost * i.quantity), 0);
  const { typed } = await settingsSvc.getTyped();
  o.whatsapp_link = wa.waLink(o.customer_phone, `Olá, ${o.customer_name}! Sobre o seu pedido #${o.order_code} na ${typed.store_name}:`);
  if (o.delivery && o.delivery.latitude != null) o.map = maps.mapsLinks({ lat: typed.store_latitude, lng: typed.store_longitude }, { lat: Number(o.delivery.latitude), lng: Number(o.delivery.longitude) });   // RF091/RF093
  return o;
}

module.exports = { create, changeStatus, expireReservations, updateDelivery, addPayment, list, getAdmin, applyStatus, TRANSITIONS };
