// Horário comercial. America/Fortaleza = UTC-3 fixo (sem horário de verão desde 2019).
const OFFSET_MS = -3 * 3600e3;
const toLocal = (d) => new Date(d.getTime() + OFFSET_MS);          // use getUTC* no resultado
const fromLocal = (d) => new Date(d.getTime() - OFFSET_MS);
const hm = (s) => { const [h, m] = String(s || '00:00').split(':').map(Number); return (h || 0) * 60 + (m || 0); };

function parseConfig(settings) {
  let days = [1, 2, 3, 4, 5, 6]; let hours = { open: '08:00', close: '18:00' };
  try { days = JSON.parse(settings.business_days); } catch (_) { /* padrão */ }
  try { hours = JSON.parse(settings.business_hours); } catch (_) { /* padrão */ }
  return { days, open: hm(hours.open), close: hm(hours.close) };
}

function isOpenAt(settings, date = new Date()) {
  const { days, open, close } = parseConfig(settings);
  const l = toLocal(date);
  const mins = l.getUTCHours() * 60 + l.getUTCMinutes();
  return days.includes(l.getUTCDay()) && mins >= open && mins < close;
}

/** Próximo instante de abertura (ou agora, se já aberto). */
function nextOpening(settings, date = new Date()) {
  if (isOpenAt(settings, date)) return date;
  const { days, open } = parseConfig(settings);
  const l = toLocal(date);
  for (let i = 0; i <= 8; i++) {
    const day = new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate() + i, 0, open));
    if (!days.includes(day.getUTCDay())) continue;
    const real = fromLocal(day);
    if (real > date) return real;
  }
  return date;
}
module.exports = { isOpenAt, nextOpening };
