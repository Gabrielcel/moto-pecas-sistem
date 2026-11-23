// WhatsApp Business — API oficial (Cloud API da Meta). Credenciais ficam só no backend.
// Observação: mensagens de texto livre só são entregues dentro da janela de 24h de atendimento;
// fora dela é necessário usar modelos (templates) aprovados pela Meta.
const env = require('../config/env');

const toE164 = (phone) => {
  const d = String(phone || '').replace(/\D/g, '');
  return d.startsWith('55') && d.length >= 12 ? d : `55${d}`;
};
const isConfigured = () => env.whatsapp.provider === 'cloud_api' && env.whatsapp.token && env.whatsapp.phoneNumberId;

/** Retorna { configured, ok, id, error } — nunca lança. */
async function sendText(phone, text) {
  if (!isConfigured()) return { configured: false, ok: false, error: 'Integração do WhatsApp não configurada' };
  try {
    const res = await fetch(`https://graph.facebook.com/${env.whatsapp.apiVersion}/${env.whatsapp.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.whatsapp.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: toE164(phone), type: 'text', text: { body: text, preview_url: true } }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { configured: true, ok: false, error: (data.error && data.error.message) || `HTTP ${res.status}` };
    return { configured: true, ok: true, id: data.messages && data.messages[0] && data.messages[0].id };
  } catch (e) {
    return { configured: true, ok: false, error: e.message };
  }
}
const waLink = (phone, text) => `https://wa.me/${toE164(phone)}?text=${encodeURIComponent(text)}`;
module.exports = { sendText, isConfigured, waLink, toE164 };
