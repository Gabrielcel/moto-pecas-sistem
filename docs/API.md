# API REST — `/api/v1`
Respostas: `{ "success": true, "data": …, "meta": … }` ou `{ "success": false, "error": { "code", "message", "details?" } }`.
Códigos: 200, 201, 400, 401, 403, 404, 409 (conflito, ex.: estoque), 422 (validação), 429, 500.
Rotas administrativas exigem cookie de sessão (`sid`) e, em escrita, o cabeçalho `X-CSRF-Token` (valor retornado no login / cookie `csrf_token`).

## Público
| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | Saúde da API/banco |
| GET | `/settings/public` | Dados da loja, horário, “aberto agora”, pagamentos |
| GET | `/public/home` | Destaques, novidades, mais vendidos, promoções, categorias |
| GET | `/products` | Busca/filtros: `q, category_id, brand_id, moto_brand_id, moto_model_id, min_price, max_price, in_stock, promo, featured, sort, page, limit` |
| GET | `/products/:id` · `/products/:id/related` · `/products/:id/reviews` | Produto, relacionados, avaliações |
| GET | `/categories` · `/brands` · `/motorcycles/brands` · `/motorcycles/models?brand_id=` · `/delivery/regions` | Listas ativas |
| POST | `/delivery/estimate` | Estimativa de frete `{city,state,street?,number?,neighborhood?}` |
| POST | `/orders` | Cria pedido (reserva estoque). Retorna `order_code`, `tracking_token`, `whatsapp_url` |
| GET | `/tracking/:code` | Cabeçalho `X-Tracking-Token`. Status, linha do tempo, itens |
| POST | `/tracking/:code/cancel` | Cliente cancela (somente pedido não confirmado) |
| POST | `/reviews` | `X-Tracking-Token` + `{code, order_item_id, rating, comment?}` |

## Autenticação
`POST /auth/login` · `POST /auth/logout` · `GET /auth/me` · `POST /auth/change-password` · `POST /auth/forgot-password` · `POST /auth/reset-password`

## Administrativo (permissão entre parênteses)
| Recurso | Rotas |
|---|---|
| Produtos (`products.manage`) | `POST /products` · `PUT /products/:id` · `DELETE /products/:id` (desativa) · `PUT /products/:id/compatibilities` · `POST /products/:id/images` (multipart `images`) · `PATCH|DELETE /products/:id/images/:imageId` |
| Categorias, fabricantes, motos (`products.manage`) | `POST/PUT/DELETE` em `/categories`, `/brands`, `/motorcycles/brands`, `/motorcycles/models` (`?all=1` no GET lista inativos) |
| Estoque (`inventory.manage`) | `GET /inventory` · `/inventory/alerts` · `/inventory/movements` · `POST /inventory/movements` · `PUT /inventory/:productId/minimum` |
| Pedidos (`orders.view` / `orders.update`) | `GET /orders` · `GET /orders/:id` · `PATCH /orders/:id/status` · `PATCH /orders/:id/delivery` · `POST /orders/:id/payments` |
| Notificações | `GET /notifications` · `POST /notifications/manual` · `POST /notifications/:id/retry` |
| Clientes (`customers.view`) | `GET /customers` · `/customers/:id` |
| Promoções (`promotions.manage`) | `GET/POST /promotions` · `PUT/DELETE /promotions/:id` |
| Avaliações (`reviews.moderate`) | `GET /reviews` · `PATCH /reviews/:id/status` |
| Relatórios (`reports.view`) | `/reports/summary · sales · top-products · low-movement · cancelled · payment-methods · dashboard` |
| Configurações (`settings.manage`) | `GET/PUT /settings` · `POST/PUT/DELETE /delivery/regions` |
| Auditoria (`audit.view`) | `GET /audit` |
| Usuários (somente administrador) | `/users` · `PATCH /users/:id/status` · `POST /users/:id/reset-password` · `/roles` · `/permissions` |

### Máquina de status do pedido
`pedido_recebido → pedido_confirmado → preparando_pedido → saiu_para_entrega → pedido_entregue` (retirada pula “saiu para entrega”). `pedido_cancelado` a partir de qualquer estado não final (motivo obrigatório no painel).
