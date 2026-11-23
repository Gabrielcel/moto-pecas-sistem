const env = require('../../config/env');
const service = require('./auth.service');
const repo = require('./auth.repository');
const { ok } = require('../../utils/helpers');
const { SESSION_COOKIE } = require('../../middlewares/auth');

const cookieBase = () => ({ secure: env.cookieSecure, sameSite: env.cookieSameSite, path: '/', maxAge: env.sessionAbsoluteDays * 86400e3 });

exports.login = async (req, res) => {
  const { token, csrf, user } = await service.login(req, req.valid.body.email, req.valid.body.password);
  res.cookie(SESSION_COOKIE, token, { ...cookieBase(), httpOnly: true });
  res.cookie('csrf_token', csrf, { ...cookieBase(), httpOnly: false });
  ok(res, { user, csrf_token: csrf });
};
exports.logout = async (req, res) => {
  await service.logout(req.cookies[SESSION_COOKIE]);
  res.clearCookie(SESSION_COOKIE, { path: '/' }); res.clearCookie('csrf_token', { path: '/' });
  ok(res, null);
};
exports.me = async (req, res) => ok(res, await service.profile(await repo.findUserById(req.user.id)));
exports.changePassword = async (req, res) => { await service.changePassword(req, req.valid.body.current_password, req.valid.body.new_password); ok(res, null); };
exports.forgot = async (req, res) => { await service.forgotPassword(req.valid.body.email); ok(res, { message: 'Se o e-mail estiver cadastrado, você receberá as instruções.' }); };
exports.reset = async (req, res) => { await service.resetPassword(req.valid.body.token, req.valid.body.new_password); ok(res, null); };
