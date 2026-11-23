const env = require('../config/env');
const { query } = require('../database/pool');
const { sha256, safeEqual } = require('../utils/helpers');
const { unauthorized, forbidden } = require('../utils/AppError');

const SESSION_COOKIE = 'sid';

async function loadSession(req) {
  const token = req.cookies && req.cookies[SESSION_COOKIE];
  if (!token) return null;
  const { rows } = await query(
    `SELECT s.id AS session_id, s.csrf_hash, s.expires_at, s.absolute_expires_at, s.last_seen_at,
            u.id, u.name, u.email, u.status
       FROM admin_sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1`, [sha256(token)]);
  const s = rows[0];
  if (!s) return null;
  const now = new Date();
  if (s.status !== 'ativo' || new Date(s.expires_at) < now || new Date(s.absolute_expires_at) < now) {
    await query('DELETE FROM admin_sessions WHERE id = $1', [s.session_id]);
    return null;
  }
  const perms = await query(
    `SELECT DISTINCT p.code FROM user_roles ur
       JOIN role_permissions rp ON rp.role_id = ur.role_id
       JOIN permissions p ON p.id = rp.permission_id WHERE ur.user_id = $1`, [s.id]);
  const roles = await query(
    `SELECT r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = $1`, [s.id]);
  // renovação deslizante (no máximo 1x por minuto)
  if (now - new Date(s.last_seen_at) > 60000) {
    const idle = new Date(now.getTime() + env.sessionIdleHours * 3600e3);
    const exp = idle < new Date(s.absolute_expires_at) ? idle : new Date(s.absolute_expires_at);
    await query('UPDATE admin_sessions SET last_seen_at = now(), expires_at = $2 WHERE id = $1', [s.session_id, exp]);
  }
  return {
    id: s.id, name: s.name, email: s.email, sessionId: s.session_id, csrfHash: s.csrf_hash,
    roles: roles.rows.map((r) => r.name),
    permissions: new Set(perms.rows.map((p) => p.code)),
    isAdmin: roles.rows.some((r) => r.name === 'Administrador'),
  };
}

const authenticate = async (req, res, next) => {
  try {
    const user = await loadSession(req);
    if (!user) return next(unauthorized('Sessão inválida ou expirada'));
    req.user = user;
    next();
  } catch (e) { next(e); }
};

const optionalAuth = async (req, res, next) => {
  try { req.user = await loadSession(req); next(); } catch (e) { next(e); }
};

/** Exige ao menos UMA das permissões informadas. Administradores passam sempre. */
const requirePermission = (...codes) => (req, res, next) => {
  if (!req.user) return next(unauthorized());
  if (req.user.isAdmin || codes.some((c) => req.user.permissions.has(c))) return next();
  next(forbidden('Você não possui permissão para esta operação'));
};

const requireAdmin = (req, res, next) => {
  if (!req.user) return next(unauthorized());
  if (!req.user.isAdmin) return next(forbidden('Somente administradores podem executar esta operação'));
  next();
};

/** Proteção CSRF: cabeçalho X-CSRF-Token deve corresponder ao hash guardado na sessão. */
const csrfProtection = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const t = req.get('x-csrf-token');
  if (!t || !req.user || !req.user.csrfHash || !safeEqual(sha256(t), req.user.csrfHash)) {
    return next(forbidden('Token CSRF inválido'));
  }
  next();
};

module.exports = { authenticate, optionalAuth, requirePermission, requireAdmin, csrfProtection, SESSION_COOKIE };
