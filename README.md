# 🏍️ Moto Peças Sistem — Loja virtual de peças de moto

Implementação completa dos Documentos 00 a 04 do projeto: **loja virtual**, **painel administrativo**, **API REST**, **banco PostgreSQL**, controle de estoque com **reserva temporária**, pedidos com **acompanhamento por link**, **frete por distância**, **WhatsApp**, relatórios, auditoria e backups.

- **Região inicial:** Crato e Juazeiro do Norte (CE) · **Pagamento:** na entrega (Pix/cartão/dinheiro) · **Sem cadastro de cliente**
- **Stack:** HTML + CSS + JavaScript (sem build) · Node.js + Express · PostgreSQL · identidade azul/grafite/branco

## Início rápido

**Requisitos:** Node.js 18+ e PostgreSQL 14+ (ou Docker).

```bash
# 1) Banco (opção Docker)  — ou use seu próprio PostgreSQL
docker compose up -d db

# 2) Configuração
cp backend/.env.example backend/.env        # ajuste DATABASE_URL e ADMIN_PASSWORD

# 3) Instalar, criar tabelas e o usuário administrador
npm run setup
npm run seed:demo        # (opcional) catálogo de demonstração com ~14 peças

# 4) Rodar
npm run dev              # http://localhost:3000
```

| Endereço | O que é |
|---|---|
| `http://localhost:3000/` | Loja virtual |
| `http://localhost:3000/admin/pages/login.html` | Painel administrativo |
| `http://localhost:3000/api/v1/health` | Verificação da API |

**Login inicial do painel:** o e-mail/senha definidos em `ADMIN_EMAIL` / `ADMIN_PASSWORD` no `.env` (padrão: `admin@motopecassistem.com.br` / `Trocar@123456`). **Troque a senha no primeiro acesso** (menu *Minha conta*).

Tudo em Docker (banco + API + site): `docker compose up --build` → http://localhost:3000

## Primeiros passos no painel
1. **Configurações** → informe o **WhatsApp da loja** (só dígitos com 55, ex.: `5588999999999`), endereço/coordenadas de origem, horário e tarifas de frete.
2. **Fabricantes**, **Categorias** e **Motocicletas** → cadastre a base; depois **Produtos** (preço, custo, estoque, fotos e modelos compatíveis).
3. Quando chegar um pedido, ele aparece em **Pedidos** (com aviso na tela) → confira → **Confirmar** → *Preparar* → *Saiu para entrega* → *Entregue* (registrando o pagamento).

## Estrutura
```
moto-pecas-sistem/
├── frontend/
│   ├── public/            logo, banner (desktop/mobile), ícones, favicon
│   ├── loja/              pages · components · styles · scripts   (loja pública)
│   ├── admin/             pages · components · styles · scripts   (painel)
│   └── shared/            scripts (api, ui) e styles (tokens de cores, base)
├── backend/
│   ├── src/ config · database · middlewares · routes · modules/* · services · utils · app.js · server.js
│   ├── tests/             19 testes de integração (node:test)
│   └── scripts/           backup.js · restore.js
├── database/              migrations/ (schema + índices) · seeds/ · documentation/
├── docs/                  Documentos 00–04 originais (PDF) + decisões, rastreabilidade, API, deploy
├── docker-compose.yml · .gitignore · package.json
```

## Testes
```bash
# crie um banco DEDICADO a testes (o nome precisa conter "test") — ele é recriado a cada execução!
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/motopecas_test npm test
```
Cobrem: login/CSRF/permissões, reserva atômica de estoque (8 pedidos simultâneos × 3 unidades), expiração de reserva, fluxo completo até a entrega (baixa de estoque, pagamento, lucro), cancelamentos, promoções, avaliações verificadas, acompanhamento por token, relatórios e imutabilidade da auditoria.

## Leia também
- [`docs/DECISOES.md`](docs/DECISOES.md) — como os pontos “pendentes” dos documentos foram resolvidos (e como ajustar)
- [`docs/RASTREABILIDADE.md`](docs/RASTREABILIDADE.md) — requisitos (RF/RN) → onde estão implementados
- [`docs/API.md`](docs/API.md) — rotas da API
- [`docs/DEPLOY.md`](docs/DEPLOY.md) — publicação, WhatsApp oficial, e-mail, mapas, backups e restauração
- [`database/documentation/README.md`](database/documentation/README.md) — extensões feitas à modelagem do Documento 02
