const router = require('express').Router();
const { z } = require('zod');
const { query, withTransaction } = require('../../database/pool');
const orders = require('./orders.service');
const { asyncHandler: h, ok, sha256, safeEqual } = require('../../utils/helpers');
const { validate } = require('../../middlewares/validate');
const { trackingLimiter } = require('../../middlewares/rateLimit');
const { notFound, forbidden } = require('../../utils/AppError');
const notifications = require('../notifications/notifications.service');

const STEPS = ['pedido_recebido', 'pedido_confirmado', 'preparando_pedido', 'saiu_para_entrega', 'pedido_entregue'];
const params = z.object({ code: z.string().regex(/^\d{1,12}$/) });

/** Carrega o pedido validando o token (comparação em tempo constante). Mesma resposta para código ou token errados. */
async function authorize(req) {
  const token = req.get('x-tracking-token') || '';
  const o = (await query('SELECT * FROM orders WHERE order_code=$1', [req.valid.params.code])).rows[0];
  if (!o || !token || !safeEqual(sha256(token), o.tracking_token_hash)) throw notFound('Pedido não encontrado. Confira o link recebido.');
  return o;
}

router.use(trackingLimiter);
router.get('/:code', validate({ params: params }), h(async (req, res) => {
  const o = await authorize(req);
  const items = (await query(`SELECT oi.id, oi.product_id, oi.product_name, oi.quantity, oi.unit_price, oi.list_price, oi.total,
      (o.status='pedido_entregue' AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.order_item_id=oi.id)) AS can_review,
      (SELECT image_url FROM product_images WHERE product_id=oi.product_id ORDER BY is_primary DESC, id LIMIT 1) AS image_url
      FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE oi.order_id=$1 ORDER BY oi.id`, [o.id])).rows;
  const history = (await query('SELECT new_status AS status, created_at FROM order_status_history WHERE order_id=$1 ORDER BY id', [o.id])).rows;
  const d = (await query('SELECT city, neighborhood, street, number, estimated_delivery_at, carrier FROM order_deliveries WHERE order_id=$1', [o.id])).rows[0] || null;
  ok(res, {
    order_code: o.order_code, status: o.status, receiving_method: o.receiving_method, created_at: o.created_at,
    subtotal: o.subtotal, discount_total: o.discount_total, delivery_fee: o.delivery_fee, total: o.total, payment_status: o.payment_status,
    payment_method_preferred: o.payment_method_preferred, cancel_reason: o.cancel_reason, reservation_expires_at: o.status === 'pedido_recebido' ? o.reservation_expires_at : null,
    estimated_delivery_at: d && d.estimated_delivery_at, delivery_address: d && `${d.street}${d.number ? ', ' + d.number : ''} — ${d.neighborhood ? d.neighborhood + ', ' : ''}${d.city}`,
    steps: STEPS.filter((s) => s !== 'saiu_para_entrega' || o.receiving_method === 'entrega'), history, items,
    can_cancel: o.status === 'pedido_recebido',
  });
}));

// O cliente pode cancelar enquanto o pedido ainda não foi confirmado.
router.post('/:code/cancel', validate({ params: params, body: z.object({ reason: z.string().max(300).optional() }) }), h(async (req, res) => {
  const o = await authorize(req);
  if (o.status !== 'pedido_recebido') throw forbidden('Este pedido já foi confirmado. Fale com o responsável pelo WhatsApp para cancelar.');
  await withTransaction((c) => orders.applyStatus(c, o.id, null, { status: 'pedido_cancelado', notes: `Cancelado pelo cliente${req.valid.body.reason ? ': ' + req.valid.body.reason : ''}` }, null));
  setImmediate(() => notifications.notifyStatus(o.id, 'pedido_cancelado'));
  ok(res, { status: 'pedido_cancelado' });
}));
module.exports = router;
