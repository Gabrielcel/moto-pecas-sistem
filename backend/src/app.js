const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const env = require('./config/env');
const routes = require('./routes');
const { apiLimiter } = require('./middlewares/rateLimit');
const { notFoundHandler, errorHandler } = require('./middlewares/error');

const app = express();
app.set('trust proxy', 1);                      // atrás de proxy/HTTPS do provedor
app.disable('x-powered-by');

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'img-src': ["'self'", 'data:', 'https:'],
      'script-src': ["'self'"],
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'font-src': ["'self'", 'https://fonts.gstatic.com'],
      'connect-src': ["'self'", 'https://viacep.com.br'],
      'frame-src': ['https://www.openstreetmap.org'],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
if (env.corsOrigins.length) app.use(cors({ origin: env.corsOrigins, credentials: true }));
app.use(express.json({ limit: '200kb' }));
app.use(cookieParser());

app.use('/api/v1', apiLimiter, routes);
app.use('/api', (req, res) => res.status(404).json({ success: false, error: { code: 'not_found', message: 'Rota não encontrada' } }));

app.use('/uploads', express.static(env.uploadDir, { maxAge: '7d', index: false }));

if (env.serveFrontend) {
  const fe = path.resolve(__dirname, '../../frontend');
  app.use('/assets', express.static(path.join(fe, 'public/assets'), { maxAge: '7d' }));
  app.use('/favicon.ico', express.static(path.join(fe, 'public/favicon.ico')));
  app.use('/shared', express.static(path.join(fe, 'shared')));
  app.use('/loja', express.static(path.join(fe, 'loja')));
  app.use('/admin', express.static(path.join(fe, 'admin')));
  app.get('/', (req, res) => res.sendFile(path.join(fe, 'loja/pages/index.html')));
}

app.use(notFoundHandler);
app.use(errorHandler);
module.exports = app;
