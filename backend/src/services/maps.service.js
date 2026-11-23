// Mapas e distância por ROTA (RN034). Provedores: OSRM (rota rodoviária) com geocodificação
// Nominatim (OpenStreetMap). Se indisponível, usa Haversine × 1,3 e marca "estimated".
// Os servidores públicos são para testes; em produção use instâncias próprias ou provedor pago.
const env = require('../config/env');

const toRad = (x) => (x * Math.PI) / 180;
function haversineKm(a, b) {
  const R = 6371; const dLat = toRad(b.lat - a.lat); const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const get = (url) => fetch(url, { headers: { 'User-Agent': env.maps.userAgent, Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });

async function geocode({ street, number, neighborhood, city, state, postal_code }) {
  if (env.maps.provider === 'haversine') return null;
  const q = [[street, number].filter(Boolean).join(', '), neighborhood, city, state, 'Brasil'].filter(Boolean).join(', ');
  try {
    const res = await get(`${env.maps.nominatimUrl}/search?format=jsonv2&limit=1&countrycodes=br&q=${encodeURIComponent(q)}`);
    if (!res.ok) return null;
    const [hit] = await res.json();
    return hit ? { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon) } : null;
  } catch (_) { return null; }
}

async function routeKm(from, to) {
  if (env.maps.provider === 'osrm') {
    try {
      const res = await get(`${env.maps.osrmUrl}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`);
      if (res.ok) {
        const d = await res.json();
        if (d.routes && d.routes[0]) return { km: Math.round(d.routes[0].distance / 10) / 100, estimated: false };
      }
    } catch (_) { /* cai para estimativa */ }
  }
  return { km: Math.round(haversineKm(from, to) * 1.3 * 100) / 100, estimated: true };
}

const mapsLinks = (origin, dest) => ({
  directions: `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${dest.lat},${dest.lng}&travelmode=driving`,
  embed: `https://www.openstreetmap.org/export/embed.html?bbox=${dest.lng - 0.01}%2C${dest.lat - 0.01}%2C${dest.lng + 0.01}%2C${dest.lat + 0.01}&layer=mapnik&marker=${dest.lat}%2C${dest.lng}`,
});
module.exports = { geocode, routeKm, haversineKm, mapsLinks };
