(async function () {
  const { h, $, mount, brl, api, imgUrl } = MP; await MP.ready; const root = $('#track');
  const code = MP.getParam('c'); const token = (location.hash.match(/t=([\w-]+)/) || [])[1];

  function lookup() {
    let saved = []; try { saved = JSON.parse(localStorage.getItem('mp_orders') || '[]'); } catch (_) {}
    const input = h('input', { type: 'url', id: 'lnk', placeholder: 'Cole aqui o link de acompanhamento recebido' });
    mount(root, h('h1', {}, 'Acompanhar pedido'), h('div', { class: 'card stack' },
      h('p', {}, 'Use o link de acompanhamento enviado após o pedido (por segurança, só quem tem o link vê o pedido).'),
      h('div', { class: 'field' }, h('label', { for: 'lnk' }, 'Link do pedido'), input), h('button', { class: 'btn', onclick: () => { try { const u = new URL(input.value.trim()); location.href = `${location.pathname}${u.search}${u.hash}`; } catch (_) { MP.toast('Link inválido', 'error'); } } }, 'Consultar')),
      saved.length ? h('div', { class: 'card', style: 'margin-top:16px' }, h('h3', {}, 'Pedidos deste aparelho'), saved.map((s) => h('div', { class: 'row between', style: 'padding:6px 0' }, h('span', {}, `#${s.code} · ${MP.dateTime(s.at)} · ${brl(s.total)}`), h('a', { class: 'btn small secondary', href: `?c=${s.code}#t=${s.token}` }, 'Abrir')))) : null);
  }
  if (!code || !token) return lookup();

  async function load() {
    try {
      const { data: o } = await api.get(`/tracking/${code}`, null, { headers: { 'X-Tracking-Token': token } });
      const cancelled = o.status === 'pedido_cancelado'; const idx = o.steps.indexOf(o.status);
      const label = { pedido_recebido: 'Pedido recebido', pedido_confirmado: 'Pedido confirmado', preparando_pedido: 'Preparando pedido', saiu_para_entrega: 'Saiu para entrega', pedido_entregue: o.receiving_method === 'retirada' ? 'Pedido retirado' : 'Pedido entregue' };
      const when = (s) => { const r = [...o.history].reverse().find((x) => x.status === s); return r ? MP.dateTime(r.created_at) : ''; };
      const steps = cancelled ? [...o.steps.filter((s) => o.history.some((x) => x.status === s)), 'pedido_cancelado'] : o.steps;
      mount(root, h('div', { class: 'row between' }, h('div', {}, h('div', { class: 'muted small' }, 'Pedido'), h('div', { class: 'code-big' }, `#${o.order_code}`)), MP.statusBadge(o.status)),
        o.status === 'pedido_recebido' ? h('div', { class: 'alert warn' }, 'Aguardando a confirmação do responsável. Se ainda não enviou a mensagem no WhatsApp, envie para agilizar.') : null,
        cancelled ? h('div', { class: 'alert error' }, `Pedido cancelado${o.cancel_reason ? ': ' + o.cancel_reason : '.'}`) : null,
        o.estimated_delivery_at && !cancelled && o.status !== 'pedido_entregue' ? h('div', { class: 'alert info' }, `📅 Previsão de entrega: ${MP.dateTime(o.estimated_delivery_at)}`) : null,
        h('div', { class: 'card' }, h('h3', {}, 'Andamento'), h('ol', { class: 'timeline' }, steps.map((s, i) => { const done = cancelled ? s !== 'pedido_cancelado' : i <= idx; const cur = !cancelled && i === idx && s !== 'pedido_entregue';
          return h('li', { class: `${s === 'pedido_cancelado' ? 'cancel' : done ? 'done' : ''}${cur ? ' current' : ''}` }, h('span', { class: 'bullet' }, s === 'pedido_cancelado' ? '✕' : done ? '✓' : ''), label[s] || 'Pedido cancelado', h('div', { class: 'small muted' }, done || s === 'pedido_cancelado' ? when(s) : ''));
        }))),
        h('div', { class: 'card', style: 'margin-top:16px' }, h('h3', {}, 'Itens'), o.items.map((i) => h('div', { class: 'cart-item', style: 'grid-template-columns:64px 1fr auto' }, h('img', { src: imgUrl(i.image_url), alt: '', style: 'width:64px;height:64px' }), h('div', {}, h('div', { style: 'font-weight:600' }, i.product_name), h('div', { class: 'small muted' }, `${i.quantity}× ${brl(i.unit_price)}`), i.can_review ? reviewBox(i) : null), h('b', {}, brl(i.total)))),
          h('div', { class: 'summary', style: 'position:static' }, h('div', { class: 'line' }, h('span', {}, 'Subtotal'), h('span', {}, brl(o.subtotal))), o.discount_total ? h('div', { class: 'line' }, h('span', {}, 'Descontos'), h('span', {}, '− ' + brl(o.discount_total))) : null, h('div', { class: 'line' }, h('span', {}, 'Frete'), h('span', {}, brl(o.delivery_fee))), h('div', { class: 'line total' }, h('span', {}, 'Total'), h('span', {}, brl(o.total))),
            h('p', { class: 'small muted' }, `${o.receiving_method === 'entrega' ? 'Entrega em: ' + (o.delivery_address || '') : 'Retirada na loja'} · Pagamento: ${o.payment_status === 'pago' ? 'pago ✅' : 'na entrega' + (o.payment_method_preferred ? ' (' + MP.PAYMENT[o.payment_method_preferred] + ')' : '')}`))),
        o.can_cancel ? h('button', { class: 'btn danger small', style: 'margin-top:16px', onclick: async () => { if (!(await MP.confirmDialog('Deseja cancelar este pedido?', { danger: true, okText: 'Cancelar pedido' }))) return; try { await api.post(`/tracking/${code}/cancel`, {}, { headers: { 'X-Tracking-Token': token } }); MP.toast('Pedido cancelado', 'success'); load(); } catch (e) { MP.toast(e.message, 'error'); } } }, 'Cancelar pedido') : null,
        h('p', { class: 'small muted', style: 'margin-top:14px' }, 'Esta página atualiza ao recarregar. ', h('a', { href: '#', onclick: (e) => { e.preventDefault(); load(); } }, 'Atualizar agora')));
    } catch (e) { mount(root, h('div', { class: 'card empty' }, h('h2', {}, 'Pedido não encontrado'), h('p', {}, e.message), h('a', { class: 'btn', href: '/loja/pages/acompanhar.html' }, 'Tentar outro link'))); }
  }

  function reviewBox(item) {
    let rating = 0; const box = h('div', { style: 'margin-top:8px' });
    const starsEl = h('div', { role: 'radiogroup', 'aria-label': 'Nota' }, [1, 2, 3, 4, 5].map((n) => h('button', { type: 'button', class: 'icon-btn', 'aria-label': `${n} estrela(s)`, onclick: () => { rating = n; [...starsEl.children].forEach((b, i) => { b.style.color = i < n ? 'var(--yellow)' : 'var(--gray-200)'; }); } }, '★')));
    [...starsEl.children].forEach((b) => { b.style.color = 'var(--gray-200)'; b.style.fontSize = '1.5rem'; });
    const txt = h('textarea', { maxlength: 1000, placeholder: 'Conte como foi (opcional)', 'aria-label': 'Comentário' });
    const btn = h('button', { class: 'btn small', type: 'button', onclick: async () => { if (!rating) return MP.toast('Escolha uma nota de 1 a 5', 'warn'); MP.setLoading(btn, true); try { await api.post('/reviews', { code, order_item_id: item.id, rating, comment: txt.value || null }, { headers: { 'X-Tracking-Token': token } }); MP.toast('Obrigado pela avaliação!', 'success'); load(); } catch (e) { MP.setLoading(btn, false); MP.toast(e.message, 'error'); } } }, 'Enviar avaliação');
    mount(box, h('details', {}, h('summary', { style: 'cursor:pointer;color:var(--blue)' }, '⭐ Avaliar este produto'), starsEl, txt, btn)); return box;
  }
  load();
})();
