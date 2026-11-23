(async function () {
  const { h, $, mount, brl } = MP; await MP.ready; const s = await MP.settings();
  mount($('#info'), h('h1', {}, 'Informações da loja'),
    h('section', { class: 'card', id: 'entrega' }, h('h2', {}, '🚚 Entrega e frete'), h('p', {}, 'Entregamos em ', h('b', {}, 'Crato e Juazeiro do Norte (CE)'), '. A entrega é feita pelo próprio responsável ou por serviço de transporte (como Uber).'),
      h('p', {}, 'O frete é estimado pela distância da rota entre a loja e o seu endereço. O valor final é confirmado pelo responsável antes da entrega. Você também pode retirar na loja, sem frete.')),
    h('section', { class: 'card', id: 'pagamento', style: 'margin-top:16px' }, h('h2', {}, '💳 Formas de pagamento'), h('p', {}, 'O pagamento é feito ', h('b', {}, 'na entrega'), `: ${(s.payment_methods || []).map((m) => MP.PAYMENT[m]).join(', ')}. O Pix é a forma preferencial. Não cobramos nada pelo site.`)),
    h('section', { class: 'card', id: 'como', style: 'margin-top:16px' }, h('h2', {}, '🛒 Como comprar'), h('ol', {}, h('li', {}, 'Escolha as peças e confira a compatibilidade com a sua moto.'), h('li', {}, 'Monte o carrinho e informe seus dados — sem cadastro.'), h('li', {}, 'Envie o pedido; ele é registrado e as peças ficam reservadas.'), h('li', {}, 'Confirme os detalhes com o responsável pelo WhatsApp.'), h('li', {}, 'Acompanhe pelo link e pague ao receber.'))),
    h('section', { class: 'card', id: 'contato', style: 'margin-top:16px' }, h('h2', {}, '📞 Fale conosco'), h('p', {}, s.contact_info), h('p', {}, h('b', {}, 'Horário: '), MP.hoursText(s)), h('p', {}, h('b', {}, 'Endereço: '), s.store_address), s.store_email ? h('p', {}, h('b', {}, 'E-mail: '), s.store_email) : null,
      s.store_phone ? h('a', { class: 'btn whatsapp', href: MP.waLink(s, 'Olá! Preciso de ajuda.'), target: '_blank', rel: 'noopener' }, '💬 WhatsApp') : null));
  if (location.hash) { const t = document.querySelector(location.hash); if (t) t.scrollIntoView(); }
})();
