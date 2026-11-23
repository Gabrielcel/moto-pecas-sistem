// Gera dist/ com o frontend no layout de URLs esperado (para hospedagem estática separada da API).
// Uso: API_URL=https://api.seudominio.com.br/api/v1 npm run build:frontend
const fs = require('fs'); const path = require('path');
const fe = path.join(__dirname, '../frontend'); const out = path.join(__dirname, '../dist');
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
for (const d of ['loja', 'admin', 'shared']) fs.cpSync(path.join(fe, d), path.join(out, d), { recursive: true });
fs.cpSync(path.join(fe, 'public/assets'), path.join(out, 'assets'), { recursive: true });
fs.copyFileSync(path.join(fe, 'public/favicon.ico'), path.join(out, 'favicon.ico'));
fs.copyFileSync(path.join(fe, 'loja/pages/index.html'), path.join(out, 'index.html'));
const api = process.env.API_URL; const base = (process.env.UPLOADS_BASE || (api ? api.replace(/\/api\/v1\/?$/, '') : ''));
if (api) fs.writeFileSync(path.join(out, 'shared/scripts/config.js'), `window.MP_CONFIG = { API_URL: ${JSON.stringify(api)}, UPLOADS_BASE: ${JSON.stringify(base)} };\n`);
console.log('Frontend gerado em dist/' + (api ? ` (API: ${api})` : ' (API padrão /api/v1)'));
