# Fluxo de Sincronização Asana ↔ Task Manager (WIP)

Resumo rápido
- Integração bidirecional: TaskManager → Asana via REST API; Asana → TaskManager via Webhooks.
- Objetivo: garantir paridade de título, due date, status/section e remoção.

Visão geral do fluxo
- Outbound (TaskManager → Asana)
  - Criação/edição: formulário → API local (POST/PUT).
  - Capturar plainTitle/plainDescription ANTES do save (evitar enviar campos criptografados).
  - Se `sendToAsana=true` e Asana configurado: chamar API Asana (guardar `asanaTaskGid`).
  - Excluir local: DELETE na API Asana (tarefa removida) e remover local.
  - Alterar status local: mapear status → sectionGid e mover tarefa no Asana.

- Inbound (Asana → TaskManager)
  - Webhook registrado para `/api/asana/webhook`.
  - Handshake inicial: Asana envia `X-Hook-Secret`; servidor responde com mesmo header.
  - Cada evento: validar `X-Hook-Signature` (HMAC-SHA256 com secret).
  - Atualizar DB: `name` → `title`, `due_on` → `deliveryDate`, `completed/section` → `status`, delete → `cancelled`.
  - Registrar audit log para cada evento inbound.

Arquivos principais
- `src/lib/asana.ts` — chamadas REST (create/update/delete/move).
- `src/app/api/tasks/route.ts` e `src/app/api/tasks/[id]/route.ts` — flows POST/PUT/DELETE (captura plain antes do save).
- `src/app/api/asana/webhook/route.ts` — endpoint webhook + validação HMAC.
- `scripts/register-asana-webhook.js` — registrar/listar/remover webhooks.
- `scripts/list-asana-sections.js` — listar sections do projeto.
- `src/components/TaskModal.tsx` — `sendToAsana` default checked.
- `docs/asana-integration.md` — documentação principal (completa).
- Este arquivo: `docs/asana-sync-wip.md` — checklist WIP para desenvolvimento/testes.

Checklist mínimo para continuar (passos essenciais)
1. .env.local (preencher)
   - `ASANA_ACCESS_TOKEN`
   - `ASANA_PROJECT_GID`
   - `ASANA_SECTION_PENDING`, `ASANA_SECTION_IN_PROGRESS`, `ASANA_SECTION_COMPLETED`, `ASANA_SECTION_CANCELLED`
   - (opcional persistir) `ASANA_WEBHOOK_SECRET`, `ASANA_WEBHOOK_GID`
2. Reiniciar servidor: `npm run dev`
3. Expor local (dev): `ngrok http 3000` → copiar URL pública (HTTPS)
4. Registrar webhook (dev):  
   `node scripts/register-asana-webhook.js https://<ngrok-url>/api/asana/webhook`
   - Verificar handshake no logs e secret armazenado
   - Persistir `ASANA_WEBHOOK_SECRET` se desejar
5. Testes Outbound
   - Criar task com `sendToAsana` marcada → verificar Asana e `asanaTaskGid`
   - Editar título/due date/status → verificar atualização no Asana e movimento de seção
   - Deletar no TaskManager → verificar remoção no Asana
6. Testes Inbound (Webhooks)
   - Editar título no Asana → verificar atualização local
   - Mover entre colunas no Asana → verificar status local
   - Alterar due date no Asana → verificar `deliveryDate` local
   - Deletar no Asana → verificar `status = cancelled` ou ação configurada
7. Segurança & logs
   - Confirmar handshake aceito sem auth middleware
   - Validar `X-Hook-Signature` em cada request inbound
   - Conferir audit logs e retries em caso de falha

Comandos úteis
- Registrar webhook: `node scripts/register-asana-webhook.js https://<url>/api/asana/webhook`
- Listar sections: `node scripts/list-asana-sections.js`
- Testar servidor local: `curl -I https://<ngrok-url>/api/asana/webhook` (handshake deve responder `200` ao POST do Asana)

Notas importantes
- Webhook requer URL pública HTTPS. ngrok free pode inserir interstitial; usar tunnel direto sem páginas intermediárias.
- Persistir `ASANA_WEBHOOK_SECRET` evita perder verificação após reinício.
- Ao editar programaticamente título, sempre usar valores plain antes do `save()` para não enviar `enc:v1:...` ao Asana.
- Esta documentação é WIP — manter testes automatizados e backup antes de operações destrutivas em produção.

Próximos passos recomendados
- Implementar testes automatizados (Postman/Newman ou Playwright) para os fluxos inbound/outbound.
- Persistir webhook GID/secret em DB para gerenciamento via UI (listar/desregistrar).
- Implementar fila/retries para eventos inbound quando atualização falhar.
