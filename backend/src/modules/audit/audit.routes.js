const router = require('express').Router();
const { z } = require('zod');
const { query } = require('../../database/pool');
const { asyncHandler: h, ok, paginate, pageMeta } = require('../../utils/helpers');
const { authenticate, requirePermission } = require('../../middlewares/auth');
const { validate } = require('../../middlewares/validate');

const q = z.object({ page: z.any(), limit: z.any(), user_id: z.coerce.number().optional(), action: z.string().max(100).optional(),
  entity_type: z.string().max(80).optional(), from: z.string().optional(), to: z.string().optional() });

router.get('/', authenticate, requirePermission('audit.view'), validate({ query: q }), h(async (req, res) => {
  const f = req.valid.query; const p = paginate(f, 30); const w = []; const a = [];
  const add = (sql, val) => { a.push(val); w.push(sql.replace('?', `$${a.length}`)); };
  if (f.user_id) add('a.user_id = ?', f.user_id);
  if (f.action) add('a.action ILIKE ?', `%${f.action}%`);
  if (f.entity_type) add('a.entity_type = ?', f.entity_type);
  if (f.from) add('a.created_at >= ?', f.from);
  if (f.to) add("a.created_at < (?::date + 1)", f.to);
  const where = w.length ? `WHERE ${w.join(' AND ')}` : '';
  const total = (await query(`SELECT count(*)::int n FROM audit_logs a ${where}`, a)).rows[0].n;
  const rows = (await query(`SELECT a.id, a.action, a.entity_type, a.entity_id, a.old_values, a.new_values, host(a.ip_address) AS ip_address,
      a.created_at, u.name AS user_name FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id ${where}
      ORDER BY a.id DESC LIMIT ${p.limit} OFFSET ${p.offset}`, a)).rows;
  ok(res, rows, pageMeta(p, total));
}));
module.exports = router;
