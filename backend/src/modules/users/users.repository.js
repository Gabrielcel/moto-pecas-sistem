const { query } = require('../../database/pool');
const USER_SQL = `SELECT u.id, u.name, u.email, u.status, u.created_at, u.last_login_at,
  COALESCE(json_agg(json_build_object('id', r.id, 'name', r.name)) FILTER (WHERE r.id IS NOT NULL), '[]') AS roles
  FROM users u LEFT JOIN user_roles ur ON ur.user_id=u.id LEFT JOIN roles r ON r.id=ur.role_id`;
module.exports = {
  list: async () => (await query(`${USER_SQL} GROUP BY u.id ORDER BY u.name`)).rows,
  get: async (id, c) => (await (c || { query }).query(`${USER_SQL} WHERE u.id=$1 GROUP BY u.id`, [id])).rows[0],
  insert: async (c, { name, email, hash }) => (await c.query('INSERT INTO users (name,email,password_hash) VALUES ($1,$2,$3) RETURNING id', [name, email, hash])).rows[0].id,
  update: (c, id, f) => c.query('UPDATE users SET name=COALESCE($2,name), email=COALESCE($3,email) WHERE id=$1', [id, f.name || null, f.email || null]),
  setRoles: async (c, id, roleIds) => {
    await c.query('DELETE FROM user_roles WHERE user_id=$1', [id]);
    for (const r of roleIds) await c.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1,$2)', [id, r]);
  },
  setStatus: (id, s) => query('UPDATE users SET status=$2 WHERE id=$1', [id, s]),
  setPassword: (id, hash) => query('UPDATE users SET password_hash=$2 WHERE id=$1', [id, hash]),
  killSessions: (id) => query('DELETE FROM admin_sessions WHERE user_id=$1', [id]),
  activeAdminCount: async (c, excludeId) => (await (c || { query }).query(
    `SELECT count(DISTINCT u.id)::int AS n FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id
      WHERE r.name='Administrador' AND u.status='ativo' AND ($1::bigint IS NULL OR u.id<>$1)`, [excludeId || null])).rows[0].n,
  roles: async () => (await query(`SELECT r.id, r.name, r.description,
      COALESCE(json_agg(p.id ORDER BY p.id) FILTER (WHERE p.id IS NOT NULL), '[]') AS permission_ids,
      (SELECT count(*)::int FROM user_roles ur WHERE ur.role_id=r.id) AS users_count
      FROM roles r LEFT JOIN role_permissions rp ON rp.role_id=r.id LEFT JOIN permissions p ON p.id=rp.permission_id
      GROUP BY r.id ORDER BY r.id`)).rows,
  permissions: async () => (await query('SELECT id, code, name, description FROM permissions ORDER BY id')).rows,
  role: async (id) => (await query('SELECT * FROM roles WHERE id=$1', [id])).rows[0],
  insertRole: async (c, name, desc) => (await c.query('INSERT INTO roles (name, description) VALUES ($1,$2) RETURNING id', [name, desc || null])).rows[0].id,
  updateRole: (c, id, name, desc) => c.query('UPDATE roles SET name=$2, description=$3 WHERE id=$1', [id, name, desc || null]),
  setRolePerms: async (c, id, ids) => {
    await c.query('DELETE FROM role_permissions WHERE role_id=$1', [id]);
    for (const p of ids) await c.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1,$2)', [id, p]);
  },
  deleteRole: (id) => query('DELETE FROM roles WHERE id=$1', [id]),
};
