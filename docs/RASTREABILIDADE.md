# Rastreabilidade — requisitos × implementação

| Requisitos (Doc. 01) | Onde está |
|---|---|
| RF001–RF010 Loja, catálogo, categorias, busca, filtros, relacionados, destaques, mais vendidos, novidades | `frontend/loja/scripts/{home,catalog,product}.js` · `backend/src/modules/{products,categories,public}` |
| RF011–RF016 Cadastro/edição/desativação, custo, compatibilidade, imagens | `modules/products` · `frontend/admin/scripts/views/products.js` |
| RF017–RF025 Carrinho, checkout sem conta, retirada/entrega, WhatsApp, pedidos 24 h | `loja/scripts/{cart,checkout}.js` · `modules/orders` (`POST /orders`) |
| RF026–RF033 Pedidos: registro, código, status, histórico, cancelamento, link do cliente | `modules/orders/{orders.service,tracking.routes}.js` · `admin/views/orders.js` · `loja/scripts/tracking.js` |
| RF034–RF042 Estoque, entradas/saídas/reservas/ajustes, mínimo, alertas, histórico | `modules/inventory` · `admin/views/inventory.js` · dashboard |
| RF043–RF053 Relatórios, faturamento, lucro bruto, margem, histórico de custos | `modules/reports` · `admin/views/reports.js` · `order_items.unit_cost` |
| RF054–RF061 Login, hash, usuários, permissões, bloqueio, recuperação de senha | `modules/{auth,users}` · `admin/pages/*` |
| RF062–RF065 Identidade visual, responsivo, mobile-first | `frontend/shared/styles/tokens.css`, `loja/styles`, `admin/styles` |
| RF066–RF070 WhatsApp Business, notificações, mensagens manuais, autorização | `modules/notifications` · `services/whatsapp.service.js` |
| RF071–RF076 Horário, pedidos fora do horário, regiões (Crato/Juazeiro) | `modules/settings` · `services/business-hours.js` · `modules/delivery` |
| RF077–RF082 Promoções (%, fixo, validade, encerramento automático) | `modules/promotions` · `services/scheduler.js` |
| RF083–RF087 Avaliações verificadas, média, moderação | `modules/reviews` |
| RF088–RF093 Linha do tempo, endereço, mapa, distância, rota no Google Maps | `loja/scripts/tracking.js` · `services/maps.service.js` · `admin/views/orders.js` |
| RF094–RF103 Proteção de dados, HTTPS, backups, restauração, auditoria | `middlewares/*` · `services/backup.service.js` · `modules/audit` · `docs/DEPLOY.md` |

| Regras (RN) | Garantia |
|---|---|
| RN001–RN005 Produtos/preços | CHECKs no schema; público só vê `ativo`; custo copiado ao item |
| RN006–RN012 Pedidos | `order_code` por sequência; reserva atômica; preço copiado; cancelamento libera reserva; token de acompanhamento; reserva só conta a partir da abertura |
| RN013–RN017 Estoque | `reserved ≤ quantity` (CHECK); movimentos sempre gravados com responsável |
| RN018–RN021 WhatsApp | só com consentimento; falha não cancela pedido; tentativas registradas |
| RN022–RN026 Usuários | sessão obrigatória, conta individual, bloqueio derruba sessões, só admin altera permissões |
| RN027–RN029 Avaliações | exige pedido entregue; 1 por item; média só de publicadas |
| RN030–RN032 Promoções | datas, preço inválido recusado, valor promocional gravado no pedido |
| RN033–RN035 Entregas | só regiões ativas; distância por rota; endereço exibido no painel |
| RN036–RN040 Segurança | bcrypt; backups; restauração documentada; auditoria imutável (trigger) |

Design (Doc. 04): paleta `#087BEB / #20242B / #FFFFFF` + complementares, tipografia Inter/Montserrat, logo em versões clara/escura, banner desktop + versão mobile, botões e estados, acessibilidade (foco visível, rótulos, `aria`), painel com menu lateral e cartões.
