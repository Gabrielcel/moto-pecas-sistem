const repo = require('./settings.repository');
const { audit } = require('../../services/audit.service');
const { isOpenAt } = require('../../services/business-hours');

const JSON_KEYS = ['business_days', 'business_hours', 'payment_methods'];
const BOOL_KEYS = ['accept_pickup', 'accept_delivery', 'reviews_require_approval'];
const NUM_KEYS = ['store_latitude', 'store_longitude', 'reservation_minutes', 'freight_base', 'freight_per_km', 'freight_min'];

/** Configurações já tipadas (para uso interno e painel). */
async function getTyped() {
  const raw = await repo.getAll(); const out = { ...raw };
  JSON_KEYS.forEach((k) => { try { out[k] = JSON.parse(raw[k]); } catch (_) { out[k] = null; } });
  BOOL_KEYS.forEach((k) => { out[k] = raw[k] === 'true'; });
  NUM_KEYS.forEach((k) => { out[k] = Number(raw[k]); });
  return { typed: out, raw };
}

async function getPublic() {
  const { typed, raw } = await getTyped();
  return {
    store_name: typed.store_name, store_phone: typed.store_phone, store_email: typed.store_email,
    store_address: typed.store_address, contact_info: typed.contact_info,
    business_days: typed.business_days, business_hours: typed.business_hours,
    accept_pickup: typed.accept_pickup, accept_delivery: typed.accept_delivery,
    payment_methods: typed.payment_methods, is_open_now: isOpenAt(raw),
    store_latitude: typed.store_latitude, store_longitude: typed.store_longitude,
  };
}

async function update(req, values) {
  const before = (await getTyped()).typed;
  for (const [k, v] of Object.entries(values)) {
    const str = JSON_KEYS.includes(k) ? JSON.stringify(v) : String(v);
    await repo.set(k, str, req.user.id);
  }
  await audit(req, 'configuracoes_alteradas', 'store_settings', null,
    Object.fromEntries(Object.keys(values).map((k) => [k, before[k]])), values);
  return (await getTyped()).typed;
}
module.exports = { getTyped, getPublic, update };
