// Fábrica de CRUD para tabelas simples (categorias, fabricantes, motos, regiões).
// GET é público (somente ativos) — administradores com a permissão veem todos com ?all=1.
const router = require('express').Router;
const { z } = require('zod');
const { query } = require('../database/pool');
const { asyncHandler: h, ok } = require('./helpers');
const { optionalAuth, authenticate, requirePermission, csrfProtection } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const { audit } = require('../services/audit.service');
const { notFound } = require('./AppError');

module.exports = function simpleCrud({ table, entity, permission, schema, cols, select, orderBy, filters = {}, usedBy = [], activeCol = 'status', publicRead = true }) {
  const r = router();
  const sel = select || `SELECT t.* FROM ${table} t`;
  const idParam = { params: z.object({ id: z.coerce.number().int().positive() }) };
  const canAll = (req) => req.query.all === '1' && req.user && (req.user.isAdmin || req.user.permissions.has(permission));

  r.get('/', optionalAuth, h(async (req, res) => {
    if (!publicRead && !req.user) return res.status(401).json({ success: false, error: { code: 'unauthorized', message: 'Não autenticado' } });
    const w = []; const a = [];
    if (!canAll(req)) w.push(`t.${activeCol}`);
    for (const [k, col] of Object.entries(filters)) if (req.query[k] !== undefined && req.query[k] !== '') { a.push(req.query[k]); w.push(`${col} = $${a.length}`); }
    ok(res, (await query(`${sel} ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY ${orderBy}`, a)).rows);
  }));

  const mutate = [authenticate, csrfProtection, requirePermission(permission)];
  r.post('/', ...mutate, validate({ body: schema }), h(async (req, res) => {
    const b = req.valid.body;
    const ins = await query(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(',')}) RETURNING *`, cols.map((c) => b[c] ?? null));
    await audit(req, `${entity}_criado`, table, ins.rows[0].id, null, b);
    ok(res, ins.rows[0], null, 201);
  }));

  r.put('/:id', ...mutate, validate({ ...idParam, body: schema }), h(async (req, res) => {
    const id = req.valid.params.id; const b = req.valid.body;
    const old = (await query(`SELECT * FROM ${table} WHERE id=$1`, [id])).rows[0]; if (!old) throw notFound();
    const upd = await query(`UPDATE ${table} SET ${cols.map((c, i) => `${c}=$${i + 2}`).join(',')} WHERE id=$1 RETURNING *`, [id, ...cols.map((c) => b[c] ?? null)]);
    await audit(req, `${entity}_editado`, table, id, old, upd.rows[0]);
    ok(res, upd.rows[0]);
  }));

  // Exclusão preserva histórico: se o registro estiver em uso, apenas desativa.
  r.delete('/:id', ...mutate, validate(idParam), h(async (req, res) => {
    const id = req.valid.params.id;
    const old = (await query(`SELECT * FROM ${table} WHERE id=$1`, [id])).rows[0]; if (!old) throw notFound();
    let inUse = false;
    for (const sql of usedBy) if ((await query(sql, [id])).rowCount) { inUse = true; break; }
    if (inUse) { await query(`UPDATE ${table} SET ${activeCol}=FALSE WHERE id=$1`, [id]); await audit(req, `${entity}_desativado`, table, id, old); return ok(res, { deactivated: true }); }
    await query(`DELETE FROM ${table} WHERE id=$1`, [id]);
    await audit(req, `${entity}_removido`, table, id, old);
    ok(res, { deleted: true });
  }));
  return r;
};
