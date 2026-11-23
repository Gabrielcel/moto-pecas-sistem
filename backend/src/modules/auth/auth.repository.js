const { query } = require('../../database/pool');
module.exports = {
  findUserByEmail: async (email) => (await query('SELECT * FROM users WHERE lower(email)=lower($1)', [email])).rows[0],
  findUserById: async (id) => (await query('SELECT * FROM users WHERE id=$1', [id])).rows[0],
  createSession: (userId, tokenHash, csrfHash, idleExp, absExp, ip, ua) => query(
    `INSERT INTO admin_sessions (user_id, token_hash, csrf_hash, expires_at, absolute_expires_at, ip_address, user_agent)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`, [userId, tokenHash, csrfHash, idleExp, absExp, ip, ua]),
  deleteSessionByHash: (h) => query('DELETE FROM admin_sessions WHERE token_hash=$1', [h]),
  deleteUserSessions: (userId, exceptId) => query('DELETE FROM admin_sessions WHERE user_id=$1 AND ($2::bigint IS NULL OR id<>$2)', [userId, exceptId || null]),
  touchLogin: (id) => query('UPDATE users SET last_login_at=now() WHERE id=$1', [id]),
  setPassword: (id, hash) => query('UPDATE users SET password_hash=$2 WHERE id=$1', [id, hash]),
  createResetToken: (userId, hash, exp) => query('INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1,$2,$3)', [userId, hash, exp]),
  findResetToken: async (hash) => (await query('SELECT * FROM password_reset_tokens WHERE token_hash=$1', [hash])).rows[0],
  useResetToken: (id) => query('UPDATE password_reset_tokens SET used_at=now() WHERE id=$1', [id]),
  userRolesAndPerms: async (id) => {
    const roles = (await query('SELECT r.name FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=$1', [id])).rows.map((r) => r.name);
    const perms = (await query(`SELECT DISTINCT p.code FROM user_roles ur JOIN role_permissions rp ON rp.role_id=ur.role_id
      JOIN permissions p ON p.id=rp.permission_id WHERE ur.user_id=$1`, [id])).rows.map((r) => r.code);
    return { roles, permissions: perms };
  },
};
