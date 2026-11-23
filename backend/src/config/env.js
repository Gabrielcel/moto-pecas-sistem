const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const bool = (v, d = false) => (v === undefined || v === '' ? d : ['1', 'true', 'yes', 'sim'].includes(String(v).toLowerCase()));
const num = (v, d) => (v === undefined || v === '' || Number.isNaN(Number(v)) ? d : Number(v));

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: num(process.env.PORT, 3000),
  frontendUrl: (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, ''),
  corsOrigins: (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
  serveFrontend: bool(process.env.SERVE_FRONTEND, true),
  databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/motopecas',
  databaseSsl: bool(process.env.DATABASE_SSL, false),
  cookieSecure: bool(process.env.COOKIE_SECURE, false),
  cookieSameSite: process.env.COOKIE_SAMESITE || 'lax',
  sessionIdleHours: num(process.env.SESSION_IDLE_HOURS, 8),
  sessionAbsoluteDays: num(process.env.SESSION_ABSOLUTE_DAYS, 7),
  admin: {
    name: process.env.ADMIN_NAME || 'Administrador',
    email: process.env.ADMIN_EMAIL || 'admin@motopecassistem.com.br',
    password: process.env.ADMIN_PASSWORD || 'Trocar@123456',
  },
  uploadDir: path.resolve(__dirname, '../..', process.env.UPLOAD_DIR || './uploads'),
  whatsapp: {
    provider: process.env.WHATSAPP_PROVIDER || 'disabled',
    token: process.env.WHATSAPP_TOKEN || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    apiVersion: process.env.WHATSAPP_API_VERSION || 'v20.0',
    adminNotifyPhone: process.env.ADMIN_NOTIFY_PHONE || '',
  },
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: num(process.env.SMTP_PORT, 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'Moto Peças Sistem <no-reply@localhost>',
  },
  maps: {
    provider: process.env.MAPS_PROVIDER || 'osrm',
    osrmUrl: (process.env.OSRM_URL || 'https://router.project-osrm.org').replace(/\/$/, ''),
    nominatimUrl: (process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org').replace(/\/$/, ''),
    userAgent: process.env.MAPS_USER_AGENT || 'MotoPecasSistem/1.0',
  },
  backup: {
    enabled: bool(process.env.BACKUP_ENABLED, false),
    dir: path.resolve(__dirname, '../..', process.env.BACKUP_DIR || './backups'),
    externalDir: process.env.BACKUP_EXTERNAL_DIR || '',
    uploadCommand: process.env.BACKUP_UPLOAD_COMMAND || '',
    retentionDays: num(process.env.BACKUP_RETENTION_DAYS, 14),
    hour: num(process.env.BACKUP_HOUR, 3),
  },
};
env.isProd = env.nodeEnv === 'production';
module.exports = env;
