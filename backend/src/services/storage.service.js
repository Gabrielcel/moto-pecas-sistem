// Armazenamento de imagens. Implementação local (pasta uploads/). Para S3/R2/etc., troque
// as funções save/remove mantendo a mesma interface (retornam/recebem a URL pública).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const env = require('../config/env');

let sharp = null;
try { sharp = require('sharp'); } catch (_) { /* opcional */ }

const dir = path.join(env.uploadDir, 'products');
fs.mkdirSync(dir, { recursive: true });
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

async function saveImage(buffer, mimetype) {
  if (!EXT[mimetype]) throw new Error('Formato não permitido');
  const id = crypto.randomBytes(12).toString('hex');
  let out = buffer; let ext = EXT[mimetype];
  if (sharp) {
    out = await sharp(buffer).rotate().resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    ext = 'webp';
  }
  const name = `${id}.${ext}`;
  await fs.promises.writeFile(path.join(dir, name), out);
  return `/uploads/products/${name}`;
}

async function removeImage(url) {
  if (!url || !url.startsWith('/uploads/products/')) return;
  const file = path.join(dir, path.basename(url));
  await fs.promises.unlink(file).catch(() => {});
}
module.exports = { saveImage, removeImage };
