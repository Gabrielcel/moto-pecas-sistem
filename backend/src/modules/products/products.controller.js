const s = require('./products.service');
const { ok } = require('../../utils/helpers');
const canManage = (req) => !!(req.user && (req.user.isAdmin || req.user.permissions.has('products.manage')));

exports.list = async (req, res) => { const r = await s.list(req.valid.query, canManage(req)); ok(res, r.rows, r.meta); };
exports.get = async (req, res) => ok(res, await s.get(req.valid.params.id, canManage(req)));
exports.related = async (req, res) => ok(res, await s.related(req.valid.params.id));
exports.create = async (req, res) => ok(res, await s.create(req, req.valid.body), null, 201);
exports.update = async (req, res) => ok(res, await s.update(req, req.valid.params.id, req.valid.body));
exports.remove = async (req, res) => { await s.deactivate(req, req.valid.params.id); ok(res, { deactivated: true }); };
exports.setCompat = async (req, res) => ok(res, await s.setCompat(req, req.valid.params.id, req.valid.body.compatibilities));
exports.addImages = async (req, res) => ok(res, await s.addImages(req, req.valid.params.id, req.files), null, 201);
exports.patchImage = async (req, res) => ok(res, await s.patchImage(req, req.valid.params.id, req.valid.params.imageId, req.valid.body));
exports.removeImage = async (req, res) => ok(res, await s.removeImage(req, req.valid.params.id, req.valid.params.imageId));
