# Banco de dados

- `migrations/001_schema.sql` — tabelas, chaves, CHECKs e gatilhos (Documento 02)
- `migrations/002_indexes.sql` — índices (busca por nome com `pg_trgm`, pedidos, estoque, auditoria…)
- `seeds/001_base.sql` — funções, permissões, regiões Crato/Juazeiro, configurações, categorias iniciais (idempotente)
- Aplicação: `npm run migrate` (controla versões em `schema_migrations`) · `npm run seed`

## Extensões feitas à modelagem do Documento 02
Todas necessárias a regras descritas nos Documentos 00/01/03:

| Tabela | Acréscimo | Motivo |
|---|---|---|
| `permissions` | `code` | identificador técnico de permissão (ex.: `orders.update`) |
| `admin_sessions` | nova | sessões revogáveis (hash do token), expiração deslizante/absoluta, CSRF |
| `password_reset_tokens` | nova | recuperação de senha com validade (RF060) |
| `orders` | `delivery_fee_estimate`, `payment_method_preferred`, `notes`, `reservation_expires_at`, `confirmed_at`, `delivered_at`, `cancelled_at`, `cancel_reason` | frete estimado × final, reserva temporária de 30 min, carimbos e motivo |
| `order_items` | `list_price` | exibir “de/por” no histórico; `unit_price` já é o preço vendido |
| `order_deliveries` | `estimated_delivery_at`, `carrier` | previsão de entrega; entrega própria/Uber |
| `payments` | `user_id` | quem registrou o recebimento |
| `reviews.status` | valor `pendente` | moderação opcional |
| `notifications.status` | valor `nao_configurado` | API do WhatsApp ainda não configurada |

## Garantias no próprio banco
`inventory`: `quantity ≥ 0`, `reserved ≥ 0`, `reserved ≤ quantity` · `audit_logs`: gatilho bloqueia UPDATE/DELETE · `products`: ativo exige preço > 0 · `promotions`: percentual < 100, término > início · e-mail de usuário único (case-insensitive) · `order_code` por sequência.

## Convenções
Datas `TIMESTAMPTZ` (UTC; exibição em America/Fortaleza) · dinheiro `NUMERIC(12,2)` (cálculos em centavos no backend) · exclusões de cadastros em uso viram **desativação** (preserva histórico, RN040).
