const { query } = require('../../database/pool');
const settings = require('../settings/settings.service');
const maps = require('../../services/maps.service');
const { unprocessable } = require('../../utils/AppError');
const { stripAccents } = require('../../utils/helpers');

/** RN033: somente regiões habilitadas. Compara cidade sem acento/caixa. */
async function findRegion(city, state) {
  const { rows } = await query('SELECT * FROM delivery_regions WHERE status = TRUE AND upper(state) = upper($1)', [state || '']);
  return rows.find((r) => stripAccents(r.city) === stripAccents(city)) || null;
}

/** Estimativa de frete: distância rodoviária (loja → endereço) x tarifa configurada. */
async function estimate(address) {
  const region = await findRegion(address.city, address.state);
  if (!region) throw unprocessable(`Ainda não entregamos em ${address.city || 'esta cidade'}/${address.state || ''}. Consulte as regiões atendidas.`, [{ field: 'address.city', message: 'Região não atendida' }]);
  const { typed } = await settings.getTyped();
  const origin = { lat: typed.store_latitude, lng: typed.store_longitude };
  let dest = (address.latitude != null && address.longitude != null) ? { lat: Number(address.latitude), lng: Number(address.longitude) } : await maps.geocode(address);
  let distance = null; let approximate = false;
  if (dest) { const r = await maps.routeKm(origin, dest); distance = r.km; approximate = r.estimated; }
  else approximate = true;
  const raw = distance != null ? typed.freight_base + typed.freight_per_km * distance : typed.freight_min;
  const fee = Math.round(Math.max(typed.freight_min, raw) * 100) / 100;
  return { region_id: region.id, fee, distance_km: distance, latitude: dest ? dest.lat : null, longitude: dest ? dest.lng : null, approximate,
    note: approximate ? 'Valor estimado; o responsável confirma o frete final pelo WhatsApp.' : 'Valor estimado pela distância da rota; o frete final é confirmado pelo responsável.' };
}
module.exports = { findRegion, estimate };
