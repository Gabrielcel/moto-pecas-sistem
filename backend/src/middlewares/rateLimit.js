const rateLimit = require('express-rate-limit');
const mk = (windowMs, max, message) => rateLimit({
  windowMs, max, standardHeaders: true, legacyHeaders: false,
  message: { success: false, error: { code: 'rate_limited', message } },
});
module.exports = {
  apiLimiter: mk(60e3, 600, 'Muitas requisições. Aguarde um instante.'),
  loginLimiter: mk(15 * 60e3, 10, 'Muitas tentativas de login. Tente novamente em 15 minutos.'),
  passwordLimiter: mk(60 * 60e3, 10, 'Muitas solicitações. Tente novamente mais tarde.'),
  orderLimiter: mk(60 * 60e3, 30, 'Muitos pedidos enviados deste endereço. Tente novamente mais tarde.'),
  trackingLimiter: mk(15 * 60e3, 60, 'Muitas consultas. Tente novamente em alguns minutos.'),
  estimateLimiter: mk(60e3, 30, 'Muitas consultas de frete. Aguarde um instante.'),
};
