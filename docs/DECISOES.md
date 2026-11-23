# Decisões de implementação

Os documentos deixaram alguns pontos em aberto (Doc. 00 §10, Doc. 01 §9, Doc. 03 §16) e há pequenas divergências entre o **Documento 00** (fluxo simples via WhatsApp) e os **Documentos 01–03** (WhatsApp Business API, avaliações, relatórios…). Esta é a solução adotada — tudo é configurável ou fácil de trocar.

## Reconciliação Doc. 00 × Docs. 01–03
| Tema | Solução |
|---|---|
| Fluxo do pedido | **Salvo no banco antes** de abrir o WhatsApp (regra central do Doc. 00). Após o envio, a página de confirmação abre `wa.me/<loja>` com a mensagem “Olá! Fiz o pedido #000125…” (o cliente ainda toca em enviar). Mesmo sem enviar, o pedido permanece registrado. |
| WhatsApp Business API | **Também implementado** (Doc. 01/03) para notificações automáticas de status — Cloud API oficial da Meta, ligada por variáveis de ambiente. Sem credenciais, tudo continua funcionando: as tentativas ficam registradas como `nao_configurado` e o painel oferece o botão “abrir conversa” (wa.me). Falha de envio nunca cancela pedido (RN020). |
| Pagamento | **Na entrega** (Pix/dinheiro/cartão). Nenhum gateway. Pagamento recebido é registrado no painel (ao marcar “entregue” ou em “Registrar pagamento”). Nunca se guardam dados de cartão (RF097). |
| Perfis | Os do Doc. 02 (Administrador, Gerente, Estoquista, Atendente) com **permissões granulares editáveis**. Só administradores criam usuários e alteram permissões (RN025). |

## Pontos em aberto → decisão
| Ponto pendente | Decisão |
|---|---|
| **Prazo da reserva** | 30 min (configurável em *Configurações*). Pedido recebido **fora do horário comercial** tem o prazo contado **a partir da próxima abertura** (RN012 × reserva). Ao confirmar, a reserva vale até a entrega. Expirou/recusado/cancelado → estoque volta (job a cada 1 min). |
| **Cálculo do frete** | `máx(frete mínimo, taxa base + R$/km × distância da rota)`. Distância por rota via **OSRM** + geocodificação **Nominatim** (OpenStreetMap, sem chave). Falha → estimativa Haversine×1,3 ou frete mínimo, sinalizado como “estimado”. O responsável ajusta o **frete final** por pedido. Tarifas em *Configurações → Frete*. |
| **Origem do frete** | Latitude/longitude da loja em *Configurações* (padrão: centro do Crato). Mudou de endereço? Altere ali. |
| **Acesso à página de acompanhamento** | Link com **token aleatório de 256 bits** no *fragmento* da URL (`#t=…`, não vai para logs de servidor). No banco fica só o **hash SHA-256**. Comparação em tempo constante, limite de consultas por IP. Sem o link não se vê o pedido. |
| **Cliente cancela** | Pode cancelar pela página de acompanhamento **enquanto o pedido não foi confirmado**; depois, fala com o responsável. |
| **Retirada na loja** | Suportada (RF022): sem frete; fluxo `preparando → entregue` (pula “saiu para entrega”). |
| **Regiões fora da área / não entregáveis** | Cidade fora das regiões ativas é **recusada** no cálculo e no pedido (RN033). Administrador cadastra novas regiões. Pedido que não puder ser entregue: o responsável **cancela com motivo** (estoque volta e o cliente é avisado se autorizou). |
| **Promoções (combinação)** | Sem acúmulo: vale a **melhor promoção ativa** (menor preço). Desconto que zere/negative o preço é recusado (RN031). Encerram sozinhas pela data (job). |
| **Cancelamento/devolução/reembolso** | Cancelamento implementado. Devolução/reembolso **fora do escopo** (pagamento é na entrega; tratar manualmente). |
| **Avaliações** | Só quem tem pedido **entregue** com o produto, uma por item, vinculada à compra. Publicadas na hora por padrão; opção “exigir aprovação” em *Configurações*; admin pode ocultar. |
| **Vendas/relatórios** | “Venda concluída” = pedido **entregue**. Lucro bruto usa o **custo gravado no item** do pedido (mudança de custo não altera histórico). Sem despesas/lucro líquido (fora do escopo). |
| **Estoque** | Disponível = físico − reservado. Reserva por `UPDATE` condicional atômico (sem venda dupla), dentro da transação do pedido. Baixa física só na **entrega**. Alerta de mínimo considera reservas. |
| **Sessão/segurança** | Sessão no servidor (cookie HttpOnly, SameSite, Secure em produção), expiração por inatividade (8 h) e absoluta (7 dias), CSRF por token, bcrypt (custo 12), limite de tentativas de login, Helmet/CSP, validação Zod. |
| **Imagens** | Pasta `uploads/` com redimensionamento (WebP, via *sharp*, se disponível). Interface de `storage.service.js` pronta para trocar por S3/R2/Cloudinary. |
| **E-mail** | SMTP via Nodemailer (recuperação de senha). Sem SMTP, o link aparece no log do servidor (dev). |
| **Filas** | Sem Redis: tarefas leves em processo (reserva, promoções, reenvio, backup). Para várias instâncias, usar fila/cron externo. |
| **2FA, despesas, lucro líquido, contas de cliente** | Fora do escopo da 1ª versão (Doc. 01 §8.1). |

## Itens de atenção
- **Banner**: o arquivo enviado diz “Entrega em Todo o Brasil”, mas a operação inicial é Crato/Juazeiro. Considere ajustar a arte (o site já informa a região correta em todo lugar).
- **Mensagens WhatsApp automáticas** fora da janela de 24 h exigem *templates* aprovados pela Meta; o código envia texto livre (ver `docs/DEPLOY.md`).
- **Servidores públicos** de OSRM/Nominatim servem para testes; em produção use instância própria ou provedor pago (`OSRM_URL`, `NOMINATIM_URL`).
- **LGPD**: coleta mínima (nome, telefone, e-mail opcional, endereço). Publique uma política de privacidade e defina prazo de retenção (Doc. 01 §9 item 11).
