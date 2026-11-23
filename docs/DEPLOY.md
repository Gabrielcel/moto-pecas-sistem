# Publicação, integrações e backups

## 1. Publicação (produção)
**Opção A — tudo em um serviço (mais simples):** a API já serve o frontend. Qualquer provedor Node + PostgreSQL (Render, Railway, Fly.io, VPS…).
1. Crie o PostgreSQL gerenciado; copie a `DATABASE_URL` (`DATABASE_SSL=true` se exigir SSL).
2. Variáveis de ambiente do serviço Node (ver `backend/.env.example`):
   `NODE_ENV=production`, `FRONTEND_URL=https://www.seudominio.com.br`, `COOKIE_SECURE=true`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DATABASE_URL`…
3. Comando de release: `npm --prefix backend run migrate && npm --prefix backend run seed` · comando de start: `npm --prefix backend start`.
4. Domínio próprio + HTTPS (o provedor emite o certificado). O backend já usa `trust proxy`.
5. **Imagens**: em hospedagens com disco efêmero, monte um volume em `backend/uploads` ou troque `storage.service.js` por S3/R2/Cloudinary.

**Opção B — frontend estático separado** (Netlify/Vercel/Cloudflare Pages) + API em outro domínio:
`API_URL=https://api.seudominio.com.br/api/v1 npm run build:frontend` → publique a pasta `dist/`.
Na API: `CORS_ORIGINS=https://www.seudominio.com.br`, `SERVE_FRONTEND=false`, `COOKIE_SAMESITE=none`, `COOKIE_SECURE=true`.
(Dica: usar subdomínios do mesmo domínio raiz evita problemas de cookies de terceiros.)

Após publicar: entre no painel, **troque a senha do administrador**, ajuste *Configurações* e apague o catálogo demo (se usou `seed:demo`).

## 2. WhatsApp Business (API oficial)
1. Crie o app em *Meta for Developers* → produto WhatsApp → obtenha `Phone Number ID` e um **token permanente** (usuário do sistema).
2. `.env`: `WHATSAPP_PROVIDER=cloud_api`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `ADMIN_NOTIFY_PHONE` (opcional: avisa o responsável de cada novo pedido).
3. **Atenção às regras da Meta:** mensagens iniciadas pela empresa **fora da janela de 24 h** precisam de *templates* aprovados. O código envia texto livre (funciona dentro da janela, ex.: cliente já falou com a loja). Para produção plena, cadastre templates e adapte `whatsapp.service.js` (`type: "template"`).
4. Sem a API configurada o sistema funciona normalmente e usa links `wa.me`.

## 3. E-mail (recuperação de senha)
`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (Brevo, Resend, SES, Gmail com senha de app…).

## 4. Mapas e frete
Padrão: OSRM + Nominatim públicos (gratuitos, **só para baixo volume/testes**; respeite a política de uso e mantenha `MAPS_USER_AGENT` com seu contato). Produção: instância própria ou provedor (OpenRouteService, Google, Mapbox) — basta adaptar `services/maps.service.js`. `MAPS_PROVIDER=haversine` desliga serviços externos.

## 5. Backups (RF098–RF101)
- Requer o cliente PostgreSQL (`pg_dump`/`pg_restore`) no servidor (a imagem Docker já inclui).
- Automático: `BACKUP_ENABLED=true`, `BACKUP_HOUR=3` (diário), `BACKUP_RETENTION_DAYS=14` (7–30 recomendado).
- **Cópia fora do servidor principal (RF099):** `BACKUP_EXTERNAL_DIR` (disco/volume separado) e/ou `BACKUP_UPLOAD_COMMAND`, ex.: `rclone copy {file} gdrive:backups-motopecas`.
- Manual: `npm --prefix backend run backup`.
- Em bancos gerenciados, ative também o backup/PITR do provedor.

### Restauração (teste periodicamente — RN039)
```bash
# 1. Pare a aplicação  2. Restaure (APAGA os dados atuais do banco apontado em DATABASE_URL)
npm --prefix backend run restore -- backups/motopecas-AAAA-MM-DDTHH-MM-SS.dump
# 3. Suba a aplicação e confira pedidos/estoque.   (Fotos: restaure também a pasta uploads/)
```
Teste em um banco **vazio de homologação** antes de depender do procedimento.

## 6. Checklist de lançamento
- [ ] HTTPS ativo, `COOKIE_SECURE=true`, senha do admin trocada
- [ ] WhatsApp da loja, endereço/coordenadas, horário e tarifas configurados
- [ ] Regiões Crato/Juazeiro ativas; fotos e compatibilidades cadastradas
- [ ] Pedido de teste completo (celular) + acompanhamento + entrega + avaliação
- [ ] Backup executado **e restauração testada**
- [ ] Política de privacidade (LGPD) publicada
