(async function () {
  const { h, $, mount, brl, api, imgUrl, debounce } = MP; await MP.ready;
  const root = $('#checkout'); const settings = await MP.settings();
  if (!MP.cart.items().length) return mount(root, h('div', { class: 'empty card' }, h('p', {}, 'Seu carrinho está vazio.'), h('a', { class: 'btn', href: '/loja/pages/catalogo.html' }, 'Ver peças')));
  let regions = []; try { regions = (await api.get('/delivery/regions')).data; } catch (_) {}
  let saved = {}; try { saved = JSON.parse(localStorage.getItem('mp_checkout')) || {}; } catch (_) {}
  const st = { fee: null, feeNote: '', step: 1, method: settings.accept_delivery === false ? 'retirada' : 'entrega' };

  const field = (label, name, o = {}) => h('div', { class: `field${o.cls ? ' ' + o.cls : ''}` }, h('label', { for: name }, label + (o.req ? ' *' : '')),
    o.select ? h('select', { id: name, name, required: o.req }, o.select) : o.area ? h('textarea', { id: name, name, maxlength: 500, placeholder: o.ph }) : h('input', { id: name, name, type: o.type || 'text', required: o.req, value: saved[name] || '', placeholder: o.ph || '', autocomplete: o.ac || 'off', inputmode: o.im, maxlength: o.max }), o.hint ? h('span', { class: 'hint' }, o.hint) : null);

  const form = h('form', { id: 'f', novalidate: true, class: 'card' },
    h('div', { class: 'steps' }, h('span', { class: 'on' }, '1. Seus dados'), h('span', { id: 'st2' }, '2. Revisar'), h('span', {}, '3. Enviar')),
    h('h3', {}, 'Seus dados'),
    h('div', { class: 'grid-2' }, field('Nome completo', 'customer.name', { req: true, ac: 'name' }), field('Telefone / WhatsApp', 'customer.phone', { req: true, type: 'tel', ac: 'tel', im: 'tel', ph: '(88) 90000-0000' })),
    field('E-mail (opcional)', 'customer.email', { type: 'email', ac: 'email' }),
    h('h3', { style: 'margin-top:8px' }, 'Como deseja receber?'),
    h('div', { class: 'radio-cards', style: 'margin-bottom:14px' },
      settings.accept_delivery !== false ? h('label', { class: 'radio-card' }, h('input', { type: 'radio', name: 'method', value: 'entrega', checked: st.method === 'entrega' }), h('span', {}, h('b', {}, '🚚 Entrega'), h('br'), h('span', { class: 'small muted' }, 'Crato e Juazeiro do Norte'))) : null,
      settings.accept_pickup !== false ? h('label', { class: 'radio-card' }, h('input', { type: 'radio', name: 'method', value: 'retirada', checked: st.method === 'retirada' }), h('span', {}, h('b', {}, '🏪 Retirar na loja'), h('br'), h('span', { class: 'small muted' }, 'Sem frete'))) : null),
    h('div', { id: 'addr' },
      h('div', { class: 'grid-2' }, field('CEP', 'address.postal_code', { im: 'numeric', ph: '00000-000', ac: 'postal-code', max: 9 }), field('Cidade', 'address.city', { req: true, select: [h('option', { value: '' }, 'Selecione'), regions.map((r) => h('option', { value: r.city, 'data-uf': r.state }, `${r.city}/${r.state}`))] })),
      h('div', { class: 'grid-2' }, field('Rua / Avenida', 'address.street', { req: true, ac: 'address-line1' }), field('Número', 'address.number', { req: true, ph: 'S/N se não houver' })),
      h('div', { class: 'grid-2' }, field('Bairro', 'address.neighborhood', { req: true }), field('Complemento', 'address.complement')),
      field('Ponto de referência', 'address.reference', { hint: 'Ajuda o entregador a localizar o endereço.' })),
    h('h3', { style: 'margin-top:8px' }, 'Pagamento'),
    h('p', { class: 'small muted' }, 'O pagamento é feito na entrega, combinado com o responsável pelo WhatsApp.'),
    field('Forma preferida', 'payment', { select: (settings.payment_methods || ['pix']).map((m) => h('option', { value: m }, MP.PAYMENT[m] + (m === 'pix' ? ' (preferencial)' : ''))) }),
    h('div', { class: 'field' }, h('label', { for: 'notes' }, 'Observações'), h('textarea', { id: 'notes', name: 'notes', maxlength: 500, placeholder: 'Ex.: horário de preferência, dúvidas sobre a peça…' })),
    h('label', { class: 'check' }, h('input', { type: 'checkbox', name: 'consent', checked: saved.consent !== false }), h('span', {}, 'Aceito receber atualizações do pedido pelo WhatsApp.')),
    h('div', { id: 'err' }), h('button', { class: 'btn block', type: 'submit', style: 'margin-top:16px' }, 'Revisar pedido'));

  const summary = h('aside', { class: 'card summary', id: 'sum' });
  const items = () => MP.cart.items();
  function drawSummary() {
    const sub = MP.cart.subtotal(); const fee = st.method === 'entrega' ? st.fee : 0;
    mount(summary, h('h3', {}, 'Seu pedido'), items().map((i) => h('div', { class: 'line small' }, h('span', {}, `${i.qty}× ${i.name}`), h('span', {}, brl(i.price * i.qty)))),
      h('div', { class: 'line', style: 'border-top:1px solid var(--gray-200);margin-top:8px;padding-top:8px' }, h('span', {}, 'Subtotal'), h('b', {}, brl(sub))),
      h('div', { class: 'line' }, h('span', {}, st.method === 'entrega' ? 'Frete (estimativa)' : 'Retirada'), h('b', {}, st.method === 'retirada' ? 'Grátis' : fee == null ? 'informe o endereço' : brl(fee))),
      st.feeNote && st.method === 'entrega' ? h('p', { class: 'small muted' }, st.feeNote) : null, h('div', { class: 'line total' }, h('span', {}, 'Total'), h('span', {}, brl(sub + (fee || 0)))));
  }
  mount(root, h('div', { class: 'cols' }, h('div', { id: 'main' }, form), summary)); drawSummary();

  const $f = (n) => form.elements[n];
  form.elements['customer.phone'].addEventListener('input', (e) => { e.target.value = MP.phoneMask(e.target.value); });
  const cep = $f('address.postal_code'); cep.addEventListener('input', async () => {
    cep.value = MP.cepMask(cep.value); if (MP.digits(cep.value).length !== 8) return;
    try { const d = await (await fetch(`https://viacep.com.br/ws/${MP.digits(cep.value)}/json/`)).json(); if (d.erro) return;
      if (d.logradouro) $f('address.street').value = d.logradouro; if (d.bairro) $f('address.neighborhood').value = d.bairro; const c = [...$f('address.city').options].find((o) => o.value.toLowerCase() === (d.localidade || '').toLowerCase()); if (c) $f('address.city').value = c.value; estimate(); } catch (_) { /* preenchimento manual */ }
  });
  const readAddress = () => { const o = $f('address.city').selectedOptions[0]; return { postal_code: $f('address.postal_code').value || null, street: $f('address.street').value.trim(), number: $f('address.number').value.trim() || null, complement: $f('address.complement').value.trim() || null, neighborhood: $f('address.neighborhood').value.trim() || null, city: $f('address.city').value, state: (o && o.dataset.uf) || 'CE', reference: $f('address.reference').value.trim() || null }; };
  let eseq = 0;
  const estimate = debounce(async () => {
    if (st.method !== 'entrega') return; const a = readAddress(); if (!a.city) return; const my = ++eseq;
    try { const r = (await api.post('/delivery/estimate', a)).data; if (my !== eseq) return; st.fee = r.fee; st.feeNote = r.note; $('#err').replaceChildren(); } catch (e) { st.fee = null; st.feeNote = ''; mount($('#err'), h('div', { class: 'alert error' }, e.message)); }
    drawSummary();
  }, 500);
  ['address.city', 'address.street', 'address.number', 'address.neighborhood'].forEach((n) => $f(n).addEventListener('change', estimate));
  const pre = (() => { try { return JSON.parse(localStorage.getItem('mp_ship')); } catch (_) { return null; } })(); if (pre && pre.city) { $f('address.city').value = pre.city; }
  const toggle = () => { st.method = form.querySelector('input[name=method]:checked').value; $('#addr').classList.toggle('hidden', st.method !== 'entrega'); form.querySelectorAll('#addr [required]').forEach((i) => { i.required = st.method === 'entrega'; }); drawSummary(); estimate(); };
  form.querySelectorAll('input[name=method]').forEach((r) => r.addEventListener('change', toggle)); toggle();

  function payload() {
    return { customer: { name: $f('customer.name').value.trim(), phone: $f('customer.phone').value, email: $f('customer.email').value.trim() || null }, receiving_method: st.method,
      address: st.method === 'entrega' ? readAddress() : null, items: items().map((i) => ({ product_id: i.id, quantity: i.qty })), whatsapp_consent: $f('consent').checked, payment_method_preferred: $f('payment').value || null, notes: $f('notes').value.trim() || null };
  }
  function validate() {
    const errs = []; const p = payload();
    if (p.customer.name.length < 3) errs.push('Informe seu nome completo.'); if (MP.digits(p.customer.phone).length < 10) errs.push('Informe um telefone válido com DDD.');
    if (st.method === 'entrega') { if (!p.address.city) errs.push('Selecione a cidade.'); if (!p.address.street) errs.push('Informe a rua.'); if (!p.address.number) errs.push('Informe o número.'); if (!p.address.neighborhood) errs.push('Informe o bairro.'); }
    return errs;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault(); const errs = validate(); const box = $('#err');
    if (errs.length) { mount(box, h('div', { class: 'alert error', role: 'alert' }, errs.map((x) => h('div', {}, x)))); box.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    if (st.method === 'entrega' && st.fee == null) await estimate.flush?.();
    try { localStorage.setItem('mp_checkout', JSON.stringify({ 'customer.name': $f('customer.name').value, 'customer.phone': $f('customer.phone').value, 'customer.email': $f('customer.email').value, consent: $f('consent').checked })); } catch (_) {}
    review(payload());
  });

  function review(p) {
    const sub = MP.cart.subtotal(); const fee = p.receiving_method === 'entrega' ? (st.fee || 0) : 0;
    const err = h('div'); const send = h('button', { class: 'btn success block', type: 'button' }, '✅ Enviar pedido');
    mount($('#main'), h('div', { class: 'card' }, h('div', { class: 'steps' }, h('span', {}, '1. Seus dados'), h('span', { class: 'on' }, '2. Revisar'), h('span', {}, '3. Enviar')),
      h('h3', {}, 'Confira seu pedido'),
      h('div', { class: 'alert info' }, 'Ao enviar, seu pedido é registrado e as peças ficam reservadas enquanto o responsável confirma. Depois você será levado ao WhatsApp para combinar os detalhes.'),
      h('p', {}, h('b', {}, p.customer.name), h('br'), p.customer.phone, p.customer.email ? ` · ${p.customer.email}` : ''),
      h('p', {}, h('b', {}, p.receiving_method === 'entrega' ? 'Entrega em:' : 'Retirada na loja'), h('br'), p.address ? `${p.address.street}, ${p.address.number} — ${p.address.neighborhood}, ${p.address.city}/${p.address.state}${p.address.complement ? ' — ' + p.address.complement : ''}` : settings.store_address),
      h('p', {}, h('b', {}, 'Pagamento na entrega: '), MP.PAYMENT[p.payment_method_preferred] || 'a combinar'),
      h('div', { class: 'table-wrap' }, h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Item'), h('th', { class: 'num' }, 'Qtd'), h('th', { class: 'num' }, 'Valor'))), h('tbody', {}, items().map((i) => h('tr', {}, h('td', {}, i.name), h('td', { class: 'num' }, i.qty), h('td', { class: 'num' }, brl(i.price * i.qty))))))),
      h('div', { class: 'summary', style: 'position:static' }, h('div', { class: 'line' }, h('span', {}, 'Subtotal'), h('b', {}, brl(sub))), h('div', { class: 'line' }, h('span', {}, 'Frete estimado'), h('b', {}, fee ? brl(fee) : 'Grátis')), h('div', { class: 'line total' }, h('span', {}, 'Total'), h('span', {}, brl(sub + fee)))),
      err, h('div', { class: 'row', style: 'margin-top:14px' }, h('button', { class: 'btn secondary', type: 'button', onclick: () => { mount($('#main'), form); } }, '← Editar dados'), send)));
    window.scrollTo({ top: 0, behavior: 'smooth' });
    send.addEventListener('click', async () => {
      MP.setLoading(send, true);
      try {
        const r = (await api.post('/orders', p)).data;
        const summary = { items: items().map((i) => ({ name: i.name, qty: i.qty, price: i.price })), receiving_method: p.receiving_method };
        sessionStorage.setItem('mp_last_order', JSON.stringify({ ...r, summary }));
        try { const l = JSON.parse(localStorage.getItem('mp_orders') || '[]'); l.unshift({ code: r.order_code, token: r.tracking_token, at: Date.now(), total: r.total }); localStorage.setItem('mp_orders', JSON.stringify(l.slice(0, 20))); } catch (_) {}
        MP.cart.clear(); location.href = '/loja/pages/pedido-confirmado.html';
      } catch (e) {
        MP.setLoading(send, false);
        mount(err, h('div', { class: 'alert error', role: 'alert' }, e.message, e.status === 409 ? h('div', {}, h('a', { href: '/loja/pages/carrinho.html' }, 'Revisar carrinho')) : null));
      }
    });
  }
})();
