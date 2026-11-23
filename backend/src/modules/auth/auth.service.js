const bcrypt = require('bcryptjs');
const env = require('../../config/env');
const repo = require('./auth.repository');
const { sha256, randomToken } = require('../../utils/helpers');
const { AppError, unauthorized, unprocessable } = require('../../utils/AppError');
const { audit } = require('../../services/audit.service');
const { sendMail } = require('../../services/email.service');

const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 12);

async function login(req, email, password) {
  const user = await repo.findUserByEmail(email);
  const valid = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);   // tempo constante
  if (!user || !valid) throw unauthorized('E-mail ou senha incorretos');
  if (user.status !== 'ativo') throw new AppError(403, 'Conta bloqueada. Procure o administrador.', 'blocked');   // RN024

  const token = randomToken(32); const csrf = randomToken(24);
  const now = Date.now();
  await repo.createSession(user.id, sha256(token), sha256(csrf),
    new Date(now + env.sessionIdleHours * 3600e3), new Date(now + env.sessionAbsoluteDays * 86400e3),
    String(req.ip || '').replace('::ffff:', '') || null, (req.get('user-agent') || '').slice(0, 300));
  await repo.touchLogin(user.id);
  req.user = { id: user.id };
  await audit(req, 'login', 'users', user.id);
  return { token, csrf, user: await profile(user) };
}

async function profile(user) {
  const { roles, permissions } = await repo.userRolesAndPerms(user.id);
  return { id: user.id, name: user.name, email: user.email, roles, permissions, is_admin: roles.includes('Administrador') };
}

async function logout(token) { if (token) await repo.deleteSessionByHash(sha256(token)); }

async function changePassword(req, current, next) {
  const user = await repo.findUserById(req.user.id);
  if (!(await bcrypt.compare(current, user.password_hash))) throw unprocessable('Senha atual incorreta');
  await repo.setPassword(user.id, await bcrypt.hash(next, 12));
  await repo.deleteUserSessions(user.id, req.user.sessionId);      // encerra as demais sessões
  await audit(req, 'senha_alterada', 'users', user.id);
}

/** Sempre responde igual, para não revelar se o e-mail existe. */
async function forgotPassword(email) {
  const user = await repo.findUserByEmail(email);
  if (!user || user.status !== 'ativo') return;
  const token = randomToken(32);
  await repo.createResetToken(user.id, sha256(token), new Date(Date.now() + 60 * 60e3));   // validade: 1 hora
  const link = `${env.frontendUrl}/admin/pages/redefinir-senha.html#token=${token}`;
  await sendMail({
    to: user.email, subject: 'Recuperação de senha — Moto Peças Sistem',
    text: `Olá, ${user.name}.\n\nPara criar uma nova senha acesse (válido por 1 hora):\n${link}\n\nSe não foi você, ignore este e-mail.`,
  });
}

async function resetPassword(token, newPassword) {
  const t = await repo.findResetToken(sha256(token));
  if (!t || t.used_at || new Date(t.expires_at) < new Date()) throw unprocessable('Link inválido ou expirado');
  await repo.setPassword(t.user_id, await bcrypt.hash(newPassword, 12));
  await repo.useResetToken(t.id);
  await repo.deleteUserSessions(t.user_id);
  await audit({ user: { id: t.user_id } }, 'senha_redefinida', 'users', t.user_id);
}
module.exports = { login, logout, profile, changePassword, forgotPassword, resetPassword };
