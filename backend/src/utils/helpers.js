const crypto = require('crypto');

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const ok = (res, data = null, meta, status = 200) => {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(status).json(body);
};

const paginate = (query, defLimit = 20, maxLimit = 100) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defLimit));
  return { page, limit, offset: (page - 1) * limit };
};
const pageMeta = (p, total) => ({ page: p.page, limit: p.limit, total, pages: Math.max(1, Math.ceil(total / p.limit)) });

const sha256 = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');
const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
const safeEqual = (a, b) => {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// dinheiro em centavos para evitar erros de ponto flutuante
const toCents = (n) => Math.round(Number(n) * 100);
const fromCents = (c) => Math.round(c) / 100;

const digits = (s) => String(s || '').replace(/\D/g, '');
const normPhone = (s) => {
  const d = digits(s);
  return d.length >= 12 && d.startsWith('55') ? d.slice(2) : d;
};
const stripAccents = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const likeEscape = (s) => String(s).replace(/[\\%_]/g, (m) => '\\' + m);

module.exports = { asyncHandler, ok, paginate, pageMeta, sha256, randomToken, safeEqual, toCents, fromCents, digits, normPhone, stripAccents, likeEscape };
