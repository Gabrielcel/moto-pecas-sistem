const bcrypt = require('bcryptjs');
const repo = require('./users.repository');
const { withTransaction } = require('../../database/pool');
const { audit } = require('../../services/audit.service');
const { notFound, conflict, unprocessable } = require('../../utils/AppError');

const isAdminRole = async (roleIds) => (await repo.roles()).some((r) => r.name === 'Administrador' && roleIds.includes(r.id));

async function create(req, { name, email, password, role_ids }) {
  const hash = await bcrypt.hash(password, 12);
  const id = await withTransaction(async (c) => {
    const uid = await repo.insert(c, { name, email, hash });
    await repo.setRoles(c, uid, role_ids);
    await audit(req, 'usuario_criado', 'users', uid, null, { name, email, role_ids }, c);
    return uid;
  });
  return repo.get(id);
}

async function update(req, id, f) {
  const before = await repo.get(id); if (!before) throw notFound('Usuário não encontrado');
  if (f.role_ids && !(await isAdminRole(f.role_ids)) && before.roles.some((r) => r.name === 'Administrador')
      && (await repo.activeAdminCount(null, id)) === 0) throw conflict('É necessário manter ao menos um administrador ativo');
  await withTransaction(async (c) => {
    await repo.update(c, id, f);
    if (f.role_ids) await repo.setRoles(c, id, f.role_ids);
    await audit(req, f.role_ids ? 'permissoes_usuario_alteradas' : 'usuario_editado', 'users', id, before, f, c);
  });
  if (f.role_ids) await repo.killSessions(id);       // permissões novas valem imediatamente
  return repo.get(id);
}

async function setStatus(req, id, status) {
  const before = await repo.get(id); if (!before) throw notFound('Usuário não encontrado');
  if (status === 'bloqueado') {
    if (id === req.user.id) throw conflict('Você não pode bloquear a própria conta');
    if (before.roles.some((r) => r.name === 'Administrador') && (await repo.activeAdminCount(null, id)) === 0)
      throw conflict('É necessário manter ao menos um administrador ativo');
  }
  await repo.setStatus(id, status);
  if (status === 'bloqueado') await repo.killSessions(id);
  await audit(req, status === 'bloqueado' ? 'usuario_bloqueado' : 'usuario_reativado', 'users', id, { status: before.status }, { status });
  return repo.get(id);
}

async function resetPassword(req, id, password) {
  if (!(await repo.get(id))) throw notFound('Usuário não encontrado');
  await repo.setPassword(id, await bcrypt.hash(password, 12));
  await repo.killSessions(id);
  await audit(req, 'senha_redefinida_por_admin', 'users', id);
}

async function saveRole(req, id, { name, description, permission_ids }) {
  if (id) {
    const r = await repo.role(id); if (!r) throw notFound('Função não encontrada');
    if (r.name === 'Administrador' && name !== 'Administrador') throw unprocessable('A função Administrador não pode ser renomeada');
  }
  const rid = await withTransaction(async (c) => {
    const roleId = id || await repo.insertRole(c, name, description);
    if (id) await repo.updateRole(c, id, name, description);
    await repo.setRolePerms(c, roleId, permission_ids);
    await audit(req, id ? 'funcao_alterada' : 'funcao_criada', 'roles', roleId, null, { name, permission_ids }, c);
    return roleId;
  });
  return (await repo.roles()).find((r) => r.id === rid);
}

async function deleteRole(req, id) {
  const r = await repo.role(id); if (!r) throw notFound('Função não encontrada');
  if (r.name === 'Administrador') throw conflict('A função Administrador não pode ser removida');
  await repo.deleteRole(id);       // FK RESTRICT impede remover função em uso
  await audit(req, 'funcao_removida', 'roles', id, r);
}
module.exports = { ...repo, create, update, setStatus, resetPassword, saveRole, deleteRole };
