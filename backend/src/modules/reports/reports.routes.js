// Relatórios comerciais e financeiros. "Venda concluída" = pedido ENTREGUE (pagamento na entrega).
// Lucro bruto = receita dos itens − custo histórico dos itens (order_items.unit_cost) — RF051/RF053.
const router = require('express').Router();
const { z } = require('zod');
const { query } = require('../../database/pool');
const { asyncHandler: h, ok } = require('../../utils/helpers');
const { authenticate, requirePermission } = require('../../middlewares/auth');
const { validate } = require('../../middlewares/validate');
const inventory = require('../inventory/inventory.service');

const TZ = "'America/Fortaleza'";
const range = z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  period: z.enum(['day', 'week', 'month', 'year']).default('day'), limit: z.coerce.number().int().min(1).max(100).default(10) });
const rng = (f, col) => ({ cond: `${col} >= COALESCE($1::date, CURRENT_DATE - 30)::timestamp AT TIME ZONE ${TZ} AND ${col} < (COALESCE($2::date, CURRENT_DATE) + 1)::timestamp AT TIME ZONE ${TZ}`, args: [f.from || null, f.to || null] });

router.use(authenticate, requirePermission('reports.view'));

router.get('/summary', validate({ query: range }), h(async (req, res) => {
  const f = req.valid.query; const r = rng(f, 'o.delivered_at');
  const sales = (await query(`SELECT count(*)::int AS completed_orders, COALESCE(sum(o.total),0) AS revenue_total, COALESCE(sum(o.delivery_fee),0) AS delivery_fees,
      COALESCE(sum(it.revenue),0) AS revenue_products, COALESCE(sum(it.cost),0) AS cost_total
      FROM orders o JOIN LATERAL (SELECT sum(total) revenue, sum(unit_cost*quantity) cost FROM order_items WHERE order_id=o.id) it ON TRUE
      WHERE o.status='pedido_entregue' AND ${r.cond}`, r.args)).rows[0];
  const rc = rng(f, 'o.cancelled_at');
  const canc = (await query(`SELECT count(*)::int AS cancelled_orders FROM orders o WHERE o.status='pedido_cancelado' AND ${rc.cond}`, rc.args)).rows[0];
  const profit = sales.revenue_products - sales.cost_total;
  ok(res, { ...sales, ...canc, gross_profit: Math.round(profit * 100) / 100,
    margin_percent: sales.revenue_products ? Math.round((profit / sales.revenue_products) * 1000) / 10 : 0,
    average_ticket: sales.completed_orders ? Math.round((sales.revenue_total / sales.completed_orders) * 100) / 100 : 0 });
}));

router.get('/sales', validate({ query: range }), h(async (req, res) => {
  const f = req.valid.query; const r = rng(f, 'o.delivered_at');
  const rows = (await query(`SELECT date_trunc('${f.period}', o.delivered_at AT TIME ZONE ${TZ})::date AS period, count(*)::int AS orders,
      sum(o.total) AS revenue_total, sum(it.revenue) AS revenue_products, sum(it.revenue - it.cost) AS gross_profit
      FROM orders o JOIN LATERAL (SELECT sum(total) revenue, sum(unit_cost*quantity) cost FROM order_items WHERE order_id=o.id) it ON TRUE
      WHERE o.status='pedido_entregue' AND ${r.cond} GROUP BY 1 ORDER BY 1`, r.args)).rows;
  ok(res, rows);
}));

const productsSql = (dir) => `SELECT p.id AS product_id, p.name, p.reference, COALESCE(sum(oi.quantity),0)::int AS units_sold, COALESCE(sum(oi.total),0) AS revenue,
    COALESCE(sum(oi.total - oi.unit_cost*oi.quantity),0) AS gross_profit,
    CASE WHEN COALESCE(sum(oi.total),0)=0 THEN NULL ELSE round((sum(oi.total - oi.unit_cost*oi.quantity)/sum(oi.total))*100,1) END AS margin_percent
    FROM products p LEFT JOIN (order_items oi JOIN orders o ON o.id=oi.order_id AND o.status='pedido_entregue' AND __RANGE__) ON oi.product_id=p.id
    WHERE p.status='ativo' GROUP BY p.id ORDER BY units_sold ${dir}, p.name LIMIT $3`;
router.get('/top-products', validate({ query: range }), h(async (req, res) => {
  const f = req.valid.query; const r = rng(f, 'o.delivered_at');
  ok(res, (await query(productsSql('DESC').replace('__RANGE__', r.cond), [...r.args, f.limit])).rows.filter((x) => x.units_sold > 0));
}));
router.get('/low-movement', validate({ query: range }), h(async (req, res) => {
  const f = req.valid.query; const r = rng(f, 'o.delivered_at');
  ok(res, (await query(productsSql('ASC').replace('__RANGE__', r.cond), [...r.args, f.limit])).rows);
}));
router.get('/cancelled', validate({ query: range }), h(async (req, res) => {
  const f = req.valid.query; const r = rng(f, 'o.cancelled_at');
  ok(res, (await query(`SELECT o.order_code, o.total, o.cancelled_at, o.cancel_reason, c.name AS customer_name FROM orders o JOIN customers c ON c.id=o.customer_id
    WHERE o.status='pedido_cancelado' AND ${r.cond} ORDER BY o.cancelled_at DESC LIMIT 200`, r.args)).rows);
}));
router.get('/payment-methods', validate({ query: range }), h(async (req, res) => {
  const f = req.valid.query; const r = rng(f, 'pm.paid_at');
  ok(res, (await query(`SELECT pm.payment_method, count(*)::int AS payments, COALESCE(sum(pm.amount),0) AS amount FROM payments pm
    WHERE pm.status='pago' AND ${r.cond} GROUP BY 1 ORDER BY amount DESC`, r.args)).rows);
}));

router.get('/dashboard', h(async (req, res) => {
  const q = (await query(`SELECT
    (SELECT count(*)::int FROM orders) AS total_orders,
    (SELECT count(*)::int FROM orders WHERE status='pedido_recebido') AS pending_orders,
    (SELECT count(*)::int FROM orders WHERE status IN ('pedido_confirmado','preparando_pedido','saiu_para_entrega')) AS in_progress_orders,
    (SELECT count(*)::int FROM orders WHERE status='pedido_entregue') AS completed_orders,
    (SELECT COALESCE(sum(total),0) FROM orders WHERE status='pedido_entregue') AS revenue,
    (SELECT COALESCE(sum(total),0) FROM orders WHERE status='pedido_entregue' AND delivered_at >= date_trunc('month', now() AT TIME ZONE ${TZ})) AS revenue_month,
    (SELECT count(*)::int FROM products) AS products_count,
    (SELECT count(*)::int FROM products WHERE status='ativo') AS active_products`)).rows[0];
  const low = await inventory.lowStock(10);
  const awaiting = (await query(`SELECT o.id, o.order_code, o.total, o.created_at, o.reservation_expires_at, c.name AS customer_name FROM orders o
    JOIN customers c ON c.id=o.customer_id WHERE o.status='pedido_recebido' ORDER BY o.created_at LIMIT 10`)).rows;
  ok(res, { ...q, low_stock_count: low.length, low_stock: low, awaiting_orders: awaiting });
}));
module.exports = router;
