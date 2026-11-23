const router = require('express').Router();
const s = require('./users.service');
const v = require('./users.validation');
const { asyncHandler: h, ok } = require('../../utils/helpers');
const { validate } = require('../../middlewares/validate');
const { authenticate, requireAdmin, csrfProtection } = require('../../middlewares/auth');

// RN025: somente administradores gerenciam contas e permissões
router.use(authenticate, requireAdmin, csrfProtection);

router.get('/users', h(async (req, res) => ok(res, await s.list())));
router.post('/users', validate(v.create), h(async (req, res) => ok(res, await s.create(req, req.valid.body), null, 201)));
router.put('/users/:id', validate(v.update), h(async (req, res) => ok(res, await s.update(req, req.valid.params.id, req.valid.body))));
router.patch('/users/:id/status', validate(v.status), h(async (req, res) => ok(res, await s.setStatus(req, req.valid.params.id, req.valid.body.status))));
router.post('/users/:id/reset-password', validate(v.resetPassword), h(async (req, res) => { await s.resetPassword(req, req.valid.params.id, req.valid.body.password); ok(res, null); }));

router.get('/permissions', h(async (req, res) => ok(res, await s.permissions())));
router.get('/roles', h(async (req, res) => ok(res, await s.roles())));
router.post('/roles', validate(v.roleBody), h(async (req, res) => ok(res, await s.saveRole(req, null, req.valid.body), null, 201)));
router.put('/roles/:id', validate(v.roleUpdate), h(async (req, res) => ok(res, await s.saveRole(req, req.valid.params.id, req.valid.body))));
router.delete('/roles/:id', validate(v.id), h(async (req, res) => { await s.deleteRole(req, req.valid.params.id); ok(res, null); }));
module.exports = router;
