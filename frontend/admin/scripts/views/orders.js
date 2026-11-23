(function () {
  const { h, $, mount, brl, api, toast, setLoading, debounce } = MP; const { table, errorBox } = MP.kit;
  const STATUSES = Object.keys(MP.STATUS);
  const ACTION = { pedido_confirmado: ['✅ Confirmar pedido', 'success'], preparando_pedido: ['📦 Iniciar preparação', ''], saiu_para_entrega: ['🚚 Saiu para entrega', ''], pedido_entregue: ['🎉 Marcar como entregue', 'success'], pedido_cancelado: ['✕ Cancelar pedido', 'danger'] };

  MP.views.orders = { title: 'Pedidos', perm: 'orders.view', render(root, params) {
    const f = { page: 1, status: '', q: '', from: '', to: '' }; const out = h('div'); let timer;
    const can = MP.can('orders.update');
    const sel = (label, key, opts) => h('div', { class: 'field' }, h('label', {}, label), h('select', { onchange: (e) => { f[key] = e.target.value; f.page = 1; load(); } }, opts.map(([v, l]) => h('option', { value: v }, l))));
    mount(root, h('div', { class: 'page-head' }, h('h2', {}, 'Pedidos'), h('span', { class: 'muted small' }, 'Atualiza automaticamente a cada 30 segundos')),
      h('div', { class: 'filters-bar' }, h('div', { class: 'field' }, h('label', {}, 'Buscar'), h('input', { type: 'search', placeholder: 'Nº, cliente ou telefone', oninput: debounce((e) => { f.q = e.target.value; f.page = 1; load(); }) })),
        sel('Status', 'status', [['', 'Todos'], ...STATUSES.map((s) => [s, MP.statusLabel(s)])]), sel('Entrega', 'receiving_method', [['', 'Todas'], ['entrega', 'Entrega'], ['retirada', 'Retirada']]),
        h('div', { class: 'field' }, h('label', {}, 'De'), h('input', { type: 'date', onchange: (e) => { f.from = e.target.value; load(); } })), h('div', { class: 'field' }, h('label', {}, 'Até'), h('input', { type: 'date', onchange: (e) => { f.to = e.target.value; load(); } }))), out);

    async function load(silent) {
      try {
        const { data, meta } = await api.get('/orders', { ...f, limit: 20 });
        mount(out, table({ rowClass: (r) => (r.status === 'pedido_recebido' ? 'pending-row' : ''), columns: [
          { label: 'Pedido', render: (r) => h('a', { href: '#', onclick: (e) => { e.preventDefault(); open(r.id); } }, h('b', {}, `#${r.order_code}`)) }, { label: 'Data', render: (r) => MP.dateTime(r.created_at) },
          { label: 'Cliente', render: (r) => h('div', {}, r.customer_name, h('div', { class: 'small muted' }, r.customer_phone)) }, { label: 'Entrega', render: (r) => (r.receiving_method === 'retirada' ? '🏪 Retirada' : `🚚 ${r.neighborhood ? r.neighborhood + ', ' : ''}${r.city || ''}`) },
          { label: 'Total', num: true, render: (r) => brl(r.total) }, { label: 'Pagamento', render: (r) => h('span', { class: `badge ${r.payment_status === 'pago' ? 'green' : 'gray'}` }, r.payment_status) },
          { label: 'Status', render: (r) => h('div', {}, MP.statusBadge(r.status), r.status === 'pedido_recebido' && r.reservation_expires_at ? h('div', { class: 'small muted' }, `reserva até ${MP.dateTime(r.reservation_expires_at)}`) : null) },
          { label: '', render: (r) => h('button', { class: 'btn secondary small', onclick: () => open(r.id) }, 'Abrir') }], rows: data, empty: 'Nenhum pedido encontrado.' }), MP.pager(meta, (p) => { f.page = p; load(); }));
      } catch (e) { if (!silent) mount(out, errorBox(e)); }
    }
    load(); timer = setInterval(() => { if (!document.querySelector('.modal-backdrop') && location.hash.startsWith('#/orders')) load(true); }, 30000);
    MP.onLeave = () => clearInterval(timer);
    if (params.open) open(Number(params.open));

    async function open(id) {
      let o; try { o = (await api.get(`/orders/${id}`)).data; } catch (e) { return toast(e.message, 'error'); }
      const body = h('div'); const m = MP.modal({ title: `Pedido #${o.order_code}`, wide: true, body, onClose: () => load(true) });
      const refresh = async () => { o = (await api.get(`/orders/${id}`)).data; draw(); };
      const addr = o.delivery;
      function draw() {
        mount(body,
          h('div', { class: 'row between', style: 'margin-bottom:12px' }, h('div', {}, MP.statusBadge(o.status), ' ', h('span', { class: `badge ${o.payment_status === 'pago' ? 'green' : 'gray'}` }, `pagamento: ${o.payment_status}`), ' ', h('span', { class: 'badge gray' }, o.receiving_method === 'entrega' ? '🚚 Entrega' : '🏪 Retirada')), h('span', { class: 'muted small' }, `Criado em ${MP.dateTime(o.created_at)}`)),
          o.status === 'pedido_recebido' ? h('div', { class: 'alert warn' }, `Aguardando sua confirmação. A reserva do estoque expira em ${MP.dateTime(o.reservation_expires_at)}.`) : null,
          o.cancel_reason ? h('div', { class: 'alert error' }, `Motivo do cancelamento: ${o.cancel_reason}`) : null,
          h('div', { class: 'detail-grid' },
            h('div', {}, h('h4', {}, 'Cliente'), h('p', { style: 'margin:0' }, h('b', {}, o.customer_name)), h('p', { style: 'margin:0' }, o.customer_phone, o.customer_email ? ` · ${o.customer_email}` : ''), h('p', { class: 'small muted' }, o.whatsapp_consent ? '✅ Autorizou WhatsApp' : '⚠️ Não autorizou notificações automáticas'),
              h('a', { class: 'btn whatsapp small', href: o.whatsapp_link, target: '_blank', rel: 'noopener' }, '💬 Abrir conversa no WhatsApp'), o.notes ? h('p', { class: 'small', style: 'margin-top:10px' }, h('b', {}, 'Observações: '), o.notes) : null,
              o.payment_method_preferred ? h('p', { class: 'small' }, h('b', {}, 'Pagamento preferido: '), MP.PAYMENT[o.payment_method_preferred]) : null),
            h('div', {}, h('h4', {}, o.receiving_method === 'entrega' ? 'Endereço de entrega' : 'Retirada na loja'),
              addr ? h('div', {}, h('p', { style: 'margin:0' }, `${addr.street}, ${addr.number || 's/n'}${addr.complement ? ' — ' + addr.complement : ''}`), h('p', { style: 'margin:0' }, `${addr.neighborhood || ''} · ${addr.city}/${addr.state}${addr.postal_code ? ' · CEP ' + addr.postal_code : ''}`), addr.reference ? h('p', { class: 'small muted', style: 'margin:0' }, `Ref.: ${addr.reference}`) : null,
                addr.distance_km != null ? h('p', { class: 'small', style: 'margin:4px 0' }, `Distância estimada: ${addr.distance_km} km`) : null, addr.estimated_delivery_at ? h('p', { class: 'small' }, `Previsão: ${MP.dateTime(addr.estimated_delivery_at)} · ${addr.carrier}`) : null,
                o.map ? h('div', {}, h('iframe', { class: 'map', src: o.map.embed, loading: 'lazy', title: 'Mapa do destino' }), h('a', { class: 'btn secondary small', href: o.map.directions, target: '_blank', rel: 'noopener', style: 'margin-top:6px' }, '🧭 Abrir rota no Google Maps')) : h('p', { class: 'small muted' }, 'Sem coordenadas — informe o endereço no app de navegação.')) : null)),
          h('h4', { style: 'margin:18px 0 6px' }, 'Itens'),
          table({ columns: [{ label: 'Produto', render: (i) => h('div', {}, i.product_name, h('div', { class: 'small muted' }, i.product_reference || '')) }, { label: 'Qtd', num: true, key: 'quantity' }, { label: 'Unitário', num: true, render: (i) => brl(i.unit_price) }, { label: 'Custo', num: true, render: (i) => brl(i.unit_cost) }, { label: 'Total', num: true, render: (i) => brl(i.total) }], rows: o.items }),
          h('div', { class: 'row between', style: 'margin:10px 0' }, h('div', { class: 'small muted' }, `Lucro bruto dos itens: ${brl(o.profit)}`),
            h('div', { class: 'right' }, h('div', { class: 'small' }, `Subtotal ${brl(o.subtotal)}${o.discount_total ? ` · desconto −${brl(o.discount_total)}` : ''} · frete ${brl(o.delivery_fee)}`, o.delivery_fee !== o.delivery_fee_estimate ? h('span', { class: 'muted' }, ` (estimado ${brl(o.delivery_fee_estimate)})`) : null), h('div', { style: 'font-size:1.3rem;font-weight:800' }, brl(o.total)))),
          can ? actions() : null, h('div', { class: 'detail-grid', style: 'margin-top:18px' }, history(), extras()));
      }
      const history = () => h('div', {}, h('h4', {}, 'Histórico'), h('ul', { style: 'margin:0;padding-left:18px;font-size:.88rem' }, o.history.map((x) => h('li', {}, h('b', {}, MP.statusLabel(x.new_status)), ` — ${MP.dateTime(x.created_at)} · ${x.user_name || 'Sistema/cliente'}`, x.notes ? h('div', { class: 'muted' }, x.notes) : null))));
      const extras = () => h('div', {}, h('h4', {}, 'Pagamentos'), o.payments.length ? h('ul', { style: 'margin:0 0 10px;padding-left:18px;font-size:.88rem' }, o.payments.map((p) => h('li', {}, `${MP.PAYMENT[p.payment_method]} · ${brl(p.amount)} · ${p.status}${p.paid_at ? ' em ' + MP.dateTime(p.paid_at) : ''}`))) : h('p', { class: 'small muted' }, 'Nenhum pagamento registrado.'),
        h('h4', {}, 'Notificações WhatsApp'), o.notifications.length ? h('ul', { style: 'margin:0;padding-left:18px;font-size:.85rem' }, o.notifications.map((n) => h('li', {}, `${n.notification_type} — `, h('span', { class: `badge ${n.status === 'enviada' ? 'green' : n.status === 'falhou' ? 'red' : 'gray'}` }, n.status), n.status === 'falhou' ? h('button', { class: 'btn secondary small', style: 'margin-left:6px', onclick: async () => { await api.post(`/notifications/${n.id}/retry`, {}); refresh(); } }, 'Reenviar') : null))) : h('p', { class: 'small muted' }, 'Nenhuma enviada (API não configurada ou sem autorização do cliente).'));

      function actions() {
        const box = h('div', { class: 'card', style: 'background:var(--gray-50);box-shadow:none' }, h('h4', { style: 'margin:0 0 10px' }, 'Ações'));
        const row = h('div', { class: 'rowact' }); box.append(row);
        o.allowed_transitions.forEach((s) => row.append(h('button', { class: `btn small ${ACTION[s][1]}`, onclick: () => transition(s) }, ACTION[s][0])));
        if (o.status !== 'pedido_cancelado') {
          if (o.receiving_method === 'entrega' && o.status !== 'pedido_entregue') row.append(h('button', { class: 'btn secondary small', onclick: editDelivery }, '✏️ Frete / previsão'));
          if (o.payment_status !== 'pago') row.append(h('button', { class: 'btn secondary small', onclick: addPayment }, '💰 Registrar pagamento'));
          row.append(h('button', { class: 'btn secondary small', onclick: message }, '✉️ Mensagem ao cliente'));
        }
        if (!row.children.length) box.append(h('p', { class: 'small muted', style: 'margin:0' }, 'Pedido finalizado.'));
        return box;
      }

      function transition(s) {
        const needFee = s === 'pedido_confirmado' && o.receiving_method === 'entrega'; const needEta = ['pedido_confirmado', 'saiu_para_entrega'].includes(s) && o.receiving_method === 'entrega';
        const fee = h('input', { type: 'number', step: '0.01', min: 0, value: o.delivery_fee }); const eta = h('input', { type: 'datetime-local', value: MP.toInputDateTime(addr && addr.estimated_delivery_at) });
        const carrier = h('select', {}, [['proprio', 'Entrega própria'], ['uber', 'Uber'], ['outro', 'Outro']].map(([v, l]) => h('option', { value: v, selected: addr && addr.carrier === v }, l)));
        const pay = h('select', {}, h('option', { value: '' }, '— selecione —'), Object.entries(MP.PAYMENT).map(([v, l]) => h('option', { value: v, selected: v === o.payment_method_preferred }, l)));
        const notes = h('textarea', { placeholder: s === 'pedido_cancelado' ? 'Motivo do cancelamento (obrigatório)' : 'Observação (opcional)', maxlength: 500 });
        const err = h('div'); const go = h('button', { class: `btn ${ACTION[s][1]}`, type: 'button' }, ACTION[s][0]);
        const sub = MP.modal({ title: ACTION[s][0], body: [
          s === 'pedido_cancelado' ? h('div', { class: 'alert warn' }, 'As unidades reservadas voltarão ao estoque disponível.') : null,
          needFee ? h('div', { class: 'field' }, h('label', {}, 'Frete final (R$)'), fee, h('span', { class: 'hint' }, `Estimativa do site: ${brl(o.delivery_fee_estimate)}`)) : null,
          needEta ? h('div', { class: 'grid-2' }, h('div', { class: 'field' }, h('label', {}, 'Previsão de entrega'), eta), h('div', { class: 'field' }, h('label', {}, 'Transporte'), carrier)) : null,
          s === 'pedido_entregue' ? h('div', { class: 'field' }, h('label', {}, 'Pagamento recebido via'), pay, h('span', { class: 'hint' }, `Registra ${brl(o.total)} como pago.`)) : null,
          h('div', { class: 'field' }, h('label', {}, 'Observações'), notes), err], footer: [h('button', { class: 'btn secondary', type: 'button', onclick: () => sub.close() }, 'Voltar'), go] });
        go.addEventListener('click', async () => {
          const b = { status: s, notes: notes.value.trim() || undefined };
          if (needFee) b.delivery_fee = Number(fee.value); if (needEta) { b.estimated_delivery_at = MP.fromInputDateTime(eta.value) || undefined; b.carrier = carrier.value; }
          if (s === 'pedido_entregue' && pay.value) b.payment = { payment_method: pay.value };
          setLoading(go, true); try { o = (await api.patch(`/orders/${id}/status`, b)).data; sub.close(); toast('Status atualizado', 'success'); draw(); } catch (e) { mount(err, h('div', { class: 'alert error' }, e.message)); setLoading(go, false); }
        });
      }
      function editDelivery() {
        const fee = h('input', { type: 'number', step: '0.01', min: 0, value: o.delivery_fee }); const eta = h('input', { type: 'datetime-local', value: MP.toInputDateTime(addr && addr.estimated_delivery_at) });
        const carrier = h('select', {}, [['proprio', 'Entrega própria'], ['uber', 'Uber'], ['outro', 'Outro']].map(([v, l]) => h('option', { value: v, selected: addr && addr.carrier === v }, l))); const err = h('div');
        const go = h('button', { class: 'btn', type: 'button', onclick: async () => { try { o = (await api.patch(`/orders/${id}/delivery`, { delivery_fee: Number(fee.value), estimated_delivery_at: MP.fromInputDateTime(eta.value), carrier: carrier.value })).data; sub.close(); toast('Entrega atualizada', 'success'); draw(); } catch (e) { mount(err, h('div', { class: 'alert error' }, e.message)); } } }, 'Salvar');
        const sub = MP.modal({ title: 'Frete e previsão de entrega', body: [h('div', { class: 'field' }, h('label', {}, 'Frete final (R$)'), fee), h('div', { class: 'grid-2' }, h('div', { class: 'field' }, h('label', {}, 'Previsão'), eta), h('div', { class: 'field' }, h('label', {}, 'Transporte'), carrier)), err], footer: [go] });
      }
      function addPayment() {
        const pay = h('select', {}, Object.entries(MP.PAYMENT).map(([v, l]) => h('option', { value: v, selected: v === o.payment_method_preferred }, l))); const ref = h('input', { placeholder: 'Comprovante / observação (opcional)' }); const err = h('div');
        const go = h('button', { class: 'btn success', type: 'button', onclick: async () => { try { o = (await api.post(`/orders/${id}/payments`, { payment_method: pay.value, status: 'pago', transaction_reference: ref.value || undefined })).data; sub.close(); toast('Pagamento registrado', 'success'); draw(); } catch (e) { mount(err, h('div', { class: 'alert error' }, e.message)); } } }, `Registrar ${brl(o.total)} como pago`);
        const sub = MP.modal({ title: 'Registrar pagamento recebido', body: [h('div', { class: 'field' }, h('label', {}, 'Forma de pagamento'), pay), h('div', { class: 'field' }, h('label', {}, 'Referência'), ref), err], footer: [go] });
      }
      function message() {
        const t = h('textarea', { maxlength: 1000, placeholder: 'Escreva a mensagem…' }); t.value = `Olá, ${o.customer_name.split(' ')[0]}! Sobre o seu pedido #${o.order_code}: `; const err = h('div');
        const go = h('button', { class: 'btn whatsapp', type: 'button', onclick: async () => { try { const r = (await api.post('/notifications/manual', { order_id: id, message: t.value })).data; sub.close();
          if (r.status === 'enviada') toast('Mensagem enviada pelo WhatsApp', 'success'); else { toast('API do WhatsApp não configurada — abrindo o WhatsApp Web', 'warn'); window.open(r.wa_link, '_blank', 'noopener'); } refresh(); } catch (e) { mount(err, h('div', { class: 'alert error' }, e.message)); } } }, 'Enviar');
        const sub = MP.modal({ title: 'Mensagem ao cliente', body: [h('div', { class: 'field' }, h('label', {}, 'Mensagem'), t), err], footer: [go] });
      }
      draw();
    }
  } };
})();
