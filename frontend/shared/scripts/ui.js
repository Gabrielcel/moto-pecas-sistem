/* Utilitários de interface compartilhados. Todo conteúdo dinâmico entra via textContent (proteção XSS). */
(function () {
  const MP = (window.MP = window.MP || {});

  /** h('div', {class:'x', onclick: fn}, 'texto', outroNo) */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === false || v == null) continue;
      if (k === 'class') el.className = v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
    (function add(list) { for (const c of list) { if (c == null || c === false) continue; if (Array.isArray(c)) add(c); else el.append(c.nodeType ? c : document.createTextNode(String(c))); } })(kids);
    return el;
  }
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
  const mount = (el, ...kids) => { clear(el).append(...kids.flat().filter((k) => k != null)); return el; };

  const brl = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const TZ = 'America/Fortaleza';
  const dateTime = (d) => (d ? new Date(d).toLocaleString('pt-BR', { timeZone: TZ, dateStyle: 'short', timeStyle: 'short' }) : '—');
  const date = (d) => (d ? new Date(d).toLocaleDateString('pt-BR', { timeZone: TZ }) : '—');
  const toInputDateTime = (d) => { if (!d) return ''; const x = new Date(new Date(d).getTime() - 3 * 3600e3); return x.toISOString().slice(0, 16); };
  const fromInputDateTime = (s) => (s ? new Date(s + ':00-03:00').toISOString() : null);
  const digits = (s) => String(s || '').replace(/\D/g, '');
  const phoneMask = (v) => { const d = digits(v).slice(0, 11); if (d.length <= 2) return d; if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`; if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`; return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`; };
  const cepMask = (v) => { const d = digits(v).slice(0, 8); return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d; };
  const debounce = (fn, ms = 350) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  const STATUS = {
    pedido_recebido: ['Pedido recebido', 'yellow'], pedido_confirmado: ['Pedido confirmado', 'blue'], preparando_pedido: ['Preparando pedido', 'blue'],
    saiu_para_entrega: ['Saiu para entrega', 'blue'], pedido_entregue: ['Pedido entregue', 'green'], pedido_cancelado: ['Pedido cancelado', 'red'],
  };
  const statusLabel = (s) => (STATUS[s] ? STATUS[s][0] : s);
  const statusBadge = (s) => h('span', { class: `badge ${STATUS[s] ? STATUS[s][1] : 'gray'}` }, statusLabel(s));
  const PAYMENT = { pix: 'Pix', dinheiro: 'Dinheiro', cartao_credito: 'Cartão de crédito', cartao_debito: 'Cartão de débito' };
  const stars = (n, max = 5) => h('span', { class: 'stars', role: 'img', 'aria-label': `${n} de ${max} estrelas` }, '★'.repeat(Math.round(n)), h('span', { class: 'off' }, '★'.repeat(max - Math.round(n))));

  function toast(msg, type = 'info', ms = 4200) {
    let box = $('.toasts'); if (!box) { box = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' }); document.body.append(box); }
    const t = h('div', { class: `toast ${type}` }, msg); box.append(t); setTimeout(() => t.remove(), ms);
  }

  /** Modal acessível. Retorna { el, close, body }. */
  function modal({ title, body, footer, wide, onClose }) {
    const prev = document.activeElement;
    const close = () => { backdrop.remove(); document.removeEventListener('keydown', esc); if (prev && prev.focus) prev.focus(); if (onClose) onClose(); };
    const esc = (e) => { if (e.key === 'Escape') close(); };
    const bodyEl = h('div', { class: 'modal-body' }, body);
    const dlg = h('div', { class: `modal${wide ? ' wide' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('div', { class: 'modal-head' }, h('h3', {}, title), h('button', { class: 'icon-btn', 'aria-label': 'Fechar', onclick: close }, '✕')),
      bodyEl, footer ? h('div', { class: 'modal-foot' }, footer) : null);
    const backdrop = h('div', { class: 'modal-backdrop', onmousedown: (e) => { if (e.target === backdrop) close(); } }, dlg);
    document.body.append(backdrop); document.addEventListener('keydown', esc);
    const first = $('input,select,textarea,button.btn', bodyEl); if (first) first.focus();
    return { el: dlg, close, body: bodyEl };
  }
  function confirmDialog(message, { okText = 'Confirmar', danger = false, title = 'Confirmação' } = {}) {
    return new Promise((resolve) => {
      let done = false; const fin = (v) => { if (!done) { done = true; resolve(v); } };
      const m = modal({ title, body: h('p', {}, message), onClose: () => fin(false),
        footer: [h('button', { class: 'btn secondary', onclick: () => m.close() }, 'Cancelar'), h('button', { class: `btn${danger ? ' danger' : ''}`, onclick: () => { fin(true); m.close(); } }, okText)] });
    });
  }
  const setLoading = (btn, on) => { btn.classList.toggle('loading', on); btn.disabled = on; };

  /** Exibe erros de validação da API (422) nos campos do formulário. */
  function showFieldErrors(form, details) {
    $$('.field.invalid', form).forEach((f) => { f.classList.remove('invalid'); const m = $('.error-msg', f); if (m) m.remove(); });
    (details || []).forEach((d) => {
      const name = String(d.field || '').replace(/^body\./, '');
      const input = form.querySelector(`[name="${name}"]`); if (!input) return;
      const f = input.closest('.field'); if (!f) return; f.classList.add('invalid'); f.append(h('span', { class: 'error-msg' }, d.message));
    });
  }
  function pager(meta, onPage) {
    if (!meta || meta.pages <= 1) return h('div');
    const b = (label, p, o = {}) => h('button', { type: 'button', class: o.active ? 'active' : '', disabled: o.disabled, 'aria-label': o.aria, onclick: () => onPage(p) }, label);
    const pages = []; const s = Math.max(1, Math.min(meta.page - 2, meta.pages - 4)); for (let i = s; i <= Math.min(meta.pages, s + 4); i++) pages.push(b(String(i), i, { active: i === meta.page, aria: `Página ${i}` }));
    return h('div', { class: 'pager' }, b('‹', meta.page - 1, { disabled: meta.page <= 1, aria: 'Anterior' }), pages, b('›', meta.page + 1, { disabled: meta.page >= meta.pages, aria: 'Próxima' }));
  }
  const imgUrl = (u) => (u && /^https?:/.test(u) ? u : (window.MP_CONFIG.UPLOADS_BASE || '') + (u || '/assets/images/placeholder-produto.svg'));

  Object.assign(MP, { h, $, $$, clear, mount, brl, dateTime, date, toInputDateTime, fromInputDateTime, digits, phoneMask, cepMask, debounce,
    STATUS, statusLabel, statusBadge, PAYMENT, stars, toast, modal, confirmDialog, setLoading, showFieldErrors, pager, imgUrl });
})();
