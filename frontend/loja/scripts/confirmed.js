(async function () {
  const { h, $, mount, brl } = MP; await MP.ready; const root = $('#done');
  let o; try { o = JSON.parse(sessionStorage.getItem('mp_last_order')); } catch (_) {}
  if (!o) return mount(root, h('div', { class: 'card empty' }, h('p', {}, 'Nenhum pedido recente por aqui.'), h('a', { class: 'btn', href: '/loja/pages/acompanhar.html' }, 'Acompanhar pedido'), ' ', h('a', { class: 'btn secondary', href: '/' }, 'Voltar à loja')));
  const exp = o.reservation_expires_at ? new Date(o.reservation_expires_at) : null;
  let left = 8; let timer;
  const cancelBtn = h('button', { class: 'btn secondary small', type: 'button', onclick: () => { clearInterval(timer); count.textContent = 'Redirecionamento cancelado. Use o botão acima.'; cancelBtn.remove(); } }, 'Cancelar redirecionamento');
  const count = h('p', { class: 'small muted' }, `Abrindo o WhatsApp em ${left}s…`);
  mount(root, h('div', { class: 'card center stack' },
    h('div', { style: 'font-size:3rem' }, '✅'), h('h1', {}, 'Pedido registrado!'), h('div', { class: 'code-big' }, `#${o.order_code}`),
    h('p', {}, 'Seu pedido foi salvo e as peças estão reservadas. ', h('b', {}, 'Agora é só enviar a mensagem no WhatsApp'), ' para o responsável confirmar os detalhes (itens, frete e pagamento).'),
    h('a', { class: 'btn whatsapp block', href: o.whatsapp_url, target: '_blank', rel: 'noopener' }, '💬 Abrir WhatsApp e enviar mensagem'), count, cancelBtn,
    h('div', { class: 'alert info', style: 'text-align:left' }, `Mensagem pronta: “${o.whatsapp_message}” — você ainda precisa tocar em enviar. Mesmo que feche o WhatsApp, o pedido continua registrado.`),
    h('div', { class: 'card', style: 'text-align:left;box-shadow:none' }, h('h3', {}, 'Resumo'), o.summary.items.map((i) => h('div', { class: 'row between small' }, h('span', {}, `${i.qty}× ${i.name}`), h('span', {}, brl(i.price * i.qty)))),
      h('div', { class: 'row between small' }, h('span', {}, 'Frete (estimado)'), h('span', {}, o.delivery_fee ? brl(o.delivery_fee) : 'Grátis')), h('div', { class: 'row between' }, h('b', {}, 'Total'), h('b', {}, brl(o.total)))),
    exp ? h('p', { class: 'small muted' }, `Reserva válida até ${MP.dateTime(exp)} aguardando a confirmação do responsável.`) : null,
    h('a', { class: 'btn block', href: o.tracking_url }, '📦 Acompanhar meu pedido'), h('p', { class: 'small muted' }, 'Guarde o link de acompanhamento: ele é a sua “chave” para consultar o pedido, sem precisar de cadastro.'),
    h('a', { href: '/' }, 'Voltar à loja')));
  timer = setInterval(() => { left--; if (left <= 0) { clearInterval(timer); location.href = o.whatsapp_url; } else count.textContent = `Abrindo o WhatsApp em ${left}s…`; }, 1000);
})();
