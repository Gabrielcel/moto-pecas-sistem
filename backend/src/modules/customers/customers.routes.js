const router = require('express').Router();
const { z } = require('zod');
const { query } = require('../../database/pool');
const { asyncHandler: h, ok, paginate, pageMeta, likeEscape, digits } = require('../../utils/helpers');
const { authenticate, requirePermission } = require('../../middlewares/auth');
const { validate } = require('../../middlewares/validate');
const { notFound } = require('../../utils/AppError');

router.use(authenticate, requirePermission('customers.view'));
router.get('/', h(async (req, res) => {
  const p = paginate(req.query, 20); const a = []; let where = '';
  if (req.query.q) { const t = `%${likeEscape(String(req.query.q).slice(0, 80))}%`; a.push(t, `%${digits(req.query.q)}%`);
    where = `WHERE unaccent(c.name) ILIKE unaccent($1) OR lower(COALESCE(c.email,'')) ILIKE lower($1) OR ($2 <> '%%' AND c.phone LIKE $2)`; }
  const total = (await query(`SELECT count(*)::int n FROM customers c ${where}`, a)).rows[0].n;
  const rows = (await query(`SELECT c.id, c.name, c.email, c.phone, c.created_at,
      count(o.id)::int AS orders_count, COALESCE(sum(o.total) FILTER (WHERE o.status='pedido_entregue'),0) AS total_spent, max(o.created_at) AS last_order_at
      FROM customers c LEFT JOIN orders o ON o.customer_id=c.id ${where} GROUP BY c.id ORDER BY last_order_at DESC NULLS LAST, c.name LIMIT ${p.limit} OFFSET ${p.offset}`, a)).rows;
  ok(res, rows, pageMeta(p, total));
}));
router.get('/:id', validate({ params: z.object({ id: z.coerce.number().int().positive() }) }), h(async (req, res) => {
  const id = req.valid.params.id;
  const c = (await query('SELECT id, name, email, phone, created_at FROM customers WHERE id=$1', [id])).rows[0]; if (!c) throw notFound('Cliente não encontrado');
  c.addresses = (await query('SELECT * FROM customer_addresses WHERE customer_id=$1 ORDER BY id DESC', [id])).rows;
  c.orders = (await query('SELECT id, order_code, status, total, created_at FROM orders WHERE customer_id=$1 ORDER BY id DESC LIMIT 50', [id])).rows;
  ok(res, c);
}));
module.exports = router;
