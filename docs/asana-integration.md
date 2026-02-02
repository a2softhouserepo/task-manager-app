# Integração com Asana

Este documento descreve como configurar e utilizar a integração bidirecional do Task Manager com o Asana.

## Visão Geral

A integração permite sincronização bidirecional completa:

### Task Manager → Asana
- ✅ Criar tarefas no Asana automaticamente ao criar no Task Manager
- ✅ Atualizar tarefas existentes (título, descrição, data de entrega)
- ✅ Mover tarefas entre colunas (seções) baseado no status
- ✅ Marcar tarefas como concluídas ao excluir no Task Manager
- ✅ Upload de anexos para o Asana

### Asana → Task Manager (via Webhooks)
- ✅ Atualização automática quando título é alterado no Asana
- ✅ Sincronização de status quando tarefa é movida entre colunas
- ✅ Atualização de data de entrega
- ✅ Tarefa marcada como cancelada quando deletada no Asana
- ✅ Atualização em tempo real no frontend (polling a cada 5s)

## Pré-requisitos

- Conta no Asana (plano gratuito funciona)
- Um projeto no Asana configurado como Board (Kanban)
- Para webhooks: URL pública HTTPS (ngrok para desenvolvimento)

---

## Configuração Rápida

### 1. Configurar Variáveis de Ambiente

Adicione ao `.env.local`:

```env
# Token de acesso (obrigatório) - Asana > Configurações > Aplicativos > Criar token
ASANA_ACCESS_TOKEN=seu-token-aqui

# ID do projeto (obrigatório) - Copie da URL: app.asana.com/0/[GID]/board
ASANA_PROJECT_GID=1234567890123456
```

### 2. Obter GIDs das Seções

```bash
npm run asana:sections
```

Copie os GIDs sugeridos para o `.env.local`:

```env
ASANA_SECTION_PENDING=1234567890123456
ASANA_SECTION_IN_PROGRESS=1234567890123457
ASANA_SECTION_COMPLETED=1234567890123458
ASANA_SECTION_CANCELLED=1234567890123459
```

### 3. Configurar Webhooks (Opcional mas Recomendado)

Para receber atualizações do Asana em tempo real:

```bash
# Terminal 1: Servidor de desenvolvimento
npm run dev

# Terminal 2: Expor via ngrok (plano free funciona)
ngrok http 3000

# Terminal 3: Registrar webhook (use a URL HTTPS do ngrok)
npm run asana:webhook:register -- https://abc123.ngrok.io/api/asana/webhook
```

Copie o `ASANA_WEBHOOK_SECRET` dos logs para o `.env.local` para persistência.

---

## Configuração

### 1. Obter o Personal Access Token

O token de acesso pessoal permite que o Task Manager se comunique com a API do Asana.

1. Acesse o [Asana Developer Console](https://app.asana.com/0/developer-console)
2. Ou navegue: **Asana → Configurações → Aplicativos → Tokens de acesso pessoal**
3. Clique em **"Create new token"**
4. Dê um nome descritivo (ex: "Task Manager Integration")
5. Copie o token gerado (ele só será exibido uma vez!)

```env
ASANA_ACCESS_TOKEN=1/1234567890123456:abcdefghijklmnopqrstuvwxyz...
```

> ⚠️ **Importante:** Guarde o token em local seguro. Se perder, será necessário criar um novo.

---

### 2. Obter o Project GID

O Project GID identifica em qual projeto do Asana as tarefas serão criadas.

1. Abra o projeto desejado no Asana
2. Observe a URL do navegador:
   ```
   https://app.asana.com/0/1234567890123456/board
                           └─────────────────┘
                              Este é o GID
   ```
3. Copie o número após `/0/` e antes de `/board` ou `/list`

```env
ASANA_PROJECT_GID=1234567890123456
```

**Alternativa via API:**

```bash
# Listar todos os projetos do workspace
curl -H "Authorization: Bearer SEU_TOKEN" \
  "https://app.asana.com/api/1.0/projects"
```

---

### 3. Obter os Section GIDs (Colunas do Board)

Para que as tarefas mudem de coluna automaticamente ao alterar o status, é necessário configurar os GIDs das seções.

#### Opção A: Usar o script incluído

Execute o script que lista automaticamente as seções:

```bash
node scripts/list-asana-sections.js
```

O script irá:
1. Conectar ao Asana usando seu token
2. Listar todas as seções do projeto
3. Sugerir o mapeamento automático baseado nos nomes

**Exemplo de saída:**

```
🔍 Buscando seções do projeto Asana...

📋 Seções encontradas:

────────────────────────────────────────────────────────────
  1. pending
     GID: 1213041XXXXXXX86

  2. in_progress
     GID: 1213041XXXXXXX88

  3. completed
     GID: 1213041XXXXXXX89

  4. cancelled
     GID: 1213041XXXXXXX90

────────────────────────────────────────────────────────────

📝 Copie os GIDs para o .env.local:

ASANA_SECTION_PENDING=1213041003236886
ASANA_SECTION_IN_PROGRESS=1213041003236888
ASANA_SECTION_COMPLETED=1213041003236889
ASANA_SECTION_CANCELLED=1213041003236890
```

#### Opção B: Via cURL

```bash
curl -H "Authorization: Bearer SEU_TOKEN" \
  "https://app.asana.com/api/1.0/projects/SEU_PROJECT_GID/sections"
```

**Exemplo de resposta:**

```json
{
  "data": [
    { "gid": "1213041003236886", "name": "pending" },
    { "gid": "1213041003236888", "name": "in_progress" },
    { "gid": "1213041003236889", "name": "completed" },
    { "gid": "1213041003236890", "name": "cancelled" }
  ]
}
```

---

## Variáveis de Ambiente

Adicione as seguintes variáveis ao arquivo `.env.local`:

```env
# === ASANA API Integration ===

# Token de acesso pessoal (obrigatório)
ASANA_ACCESS_TOKEN=seu-token-aqui

# ID do projeto onde as tarefas serão criadas (obrigatório)
ASANA_PROJECT_GID=1234567890123456

# IDs das seções para mover tarefas entre colunas (opcional)
# Se não configurado, as tarefas serão criadas mas não mudarão de coluna
ASANA_SECTION_PENDING=1213041003236886
ASANA_SECTION_IN_PROGRESS=1213041003236888
ASANA_SECTION_COMPLETED=1213041003236889
ASANA_SECTION_CANCELLED=1213041003236890
```

---

## Mapeamento de Status → Seção

| Status no Task Manager | Seção no Asana |
|------------------------|----------------|
| `pending` | ASANA_SECTION_PENDING |
| `in_progress` | ASANA_SECTION_IN_PROGRESS |
| `completed` | ASANA_SECTION_COMPLETED |
| `cancelled` | ASANA_SECTION_CANCELLED |

---

## Como Funciona

### Criação de Tarefa

1. Usuário cria tarefa no Task Manager com checkbox "Enviar ao Asana" marcado
2. Sistema salva a tarefa no MongoDB
3. Sistema cria a tarefa no Asana via API
4. Sistema move a tarefa para a seção correspondente ao status
5. O GID da tarefa do Asana é salvo no campo `asanaTaskGid`

### Atualização de Tarefa

1. Usuário edita tarefa e marca "Enviar ao Asana"
2. Sistema atualiza no MongoDB
3. Se a tarefa já tem `asanaTaskGid`, atualiza a tarefa existente no Asana
4. Se não tem GID, cria uma nova tarefa no Asana
5. Move para a seção correspondente ao novo status

### Exclusão de Tarefa

1. Usuário exclui tarefa no Task Manager
2. Se a tarefa tem `asanaTaskGid`, deleta a tarefa no Asana (move para lixeira)
3. A tarefa pode ser recuperada por admins do workspace em até 30 dias

---

## Campos Sincronizados

| Campo Task Manager | Campo Asana |
|--------------------|-------------|
| `title` | `name` |
| `description` + metadados | `notes` |
| `deliveryDate` | `due_on` |
| `status` (completed/cancelled) | `completed` |
| `status` | Seção (coluna) |

### Formato das Notes no Asana

```
Cliente: Nome do Cliente
Categoria: Nome da Categoria
Custo: 5h
Data de Entrega: 30/01/2026

Descrição:
[Descrição da tarefa]

---
Tarefa criada automaticamente pelo Task Manager
```

---

## Troubleshooting

### Tarefa não aparece no Asana

1. Verifique se `ASANA_ACCESS_TOKEN` está correto
2. Verifique se `ASANA_PROJECT_GID` está correto
3. Verifique os logs do servidor para mensagens `[ASANA]`

### Tarefa não muda de coluna

1. Verifique se as variáveis `ASANA_SECTION_*` estão configuradas
2. Execute `node scripts/list-asana-sections.js` para confirmar os GIDs
3. Reinicie o servidor após alterar o `.env.local`

### Erro de autenticação

```
[ASANA] Failed to create task: Not Authorized
```

- O token pode ter expirado ou sido revogado
- Crie um novo token no Developer Console

### Erro "Project not found"

```
[ASANA] Failed to create task: project: Not a recognized ID
```

- Verifique se o `ASANA_PROJECT_GID` está correto
- Confirme que você tem acesso ao projeto

---

## Limitações

1. **Exclusão permanente**: Tarefas excluídas no Task Manager são deletadas no Asana (movidas para a lixeira). Admins do workspace podem recuperá-las dentro de 30 dias.

2. **Assignees**: Atualmente não sincroniza responsáveis (assignees).

3. **Tags/Labels**: Atualmente não sincroniza tags ou labels.

---

## Sincronização Bidirecional (Webhooks)

Por padrão, a integração é unidirecional (Task Manager → Asana). Para receber atualizações do Asana automaticamente, configure os webhooks.

### Pré-requisitos para Webhooks

- URL pública com HTTPS (o Asana não aceita HTTP)
- Para desenvolvimento local, use [ngrok](https://ngrok.com/)

### Configurando Webhooks

#### 1. Expor sua aplicação (desenvolvimento)

```bash
# Instale o ngrok (se não tiver)
npm install -g ngrok

# Exponha a porta 3000
ngrok http 3000
```

Copie a URL HTTPS gerada (ex: `https://abc123.ngrok.io`)

#### 2. Registrar o Webhook

```bash
node scripts/register-asana-webhook.js https://abc123.ngrok.io/api/asana/webhook
```

O script irá:
1. Enviar uma requisição para o Asana
2. O Asana fará um handshake com seu endpoint
3. Salvar o webhook GID para referência

#### 3. Salvar o Secret

Durante o handshake, o Asana envia um `X-Hook-Secret`. Este secret é armazenado automaticamente em memória, mas para persistência, adicione ao `.env.local`:

```env
ASANA_WEBHOOK_SECRET=seu-secret-aqui
ASANA_WEBHOOK_GID=1234567890123456
```

### Gerenciando Webhooks

```bash
# Listar webhooks existentes
node scripts/register-asana-webhook.js --list

# Deletar um webhook
node scripts/register-asana-webhook.js --delete <WEBHOOK_GID>

# Ver ajuda
node scripts/register-asana-webhook.js --help
```

### Eventos Sincronizados

| Evento no Asana | Ação no Task Manager |
|-----------------|----------------------|
| Título alterado | Atualiza title |
| Tarefa movida de seção | Atualiza status |
| Tarefa marcada concluída | Status → completed |
| Due date alterada | Atualiza deliveryDate |
| Tarefa deletada | Status → cancelled |

> 💡 **Nota:** O título é sincronizado automaticamente, facilitando a busca de tarefas solicitadas por clientes.

### Segurança dos Webhooks

Os webhooks são protegidos por:

1. **Handshake inicial**: O Asana envia um `X-Hook-Secret` que deve ser retornado
2. **Assinatura HMAC-SHA256**: Cada evento vem com `X-Hook-Signature` para validação
3. **Verificação em produção**: Requests sem assinatura válida são rejeitados

### Troubleshooting de Webhooks

#### Webhook não registra

```
❌ O Asana não conseguiu completar o handshake
```

- Verifique se a URL está acessível publicamente
- Confirme que o servidor está rodando
- Teste o endpoint: `curl https://sua-url.com/api/asana/webhook`

#### Eventos não chegam

1. Verifique se o webhook está ativo: `node scripts/register-asana-webhook.js --list`
2. Confira os logs do servidor para `[ASANA WEBHOOK]`
3. Verifique se a tarefa tem `asanaTaskGid` no banco de dados

#### Assinatura inválida

```
[ASANA WEBHOOK] Invalid signature
```

- O `ASANA_WEBHOOK_SECRET` pode estar incorreto
- Delete o webhook e registre novamente

---

## Scripts Disponíveis

### list-asana-sections.js

Lista as seções (colunas) de um projeto Asana.

```bash
npm run asana:sections
```

### register-asana-webhook.js

Gerencia webhooks do Asana.

```bash
# Registrar novo webhook
npm run asana:webhook:register -- <URL_HTTPS>

# Listar webhooks ativos
npm run asana:webhook:list

# Deletar webhook (requer GID como argumento)
npm run asana:webhook:delete -- <GID>
```

**Requisitos:**
- `ASANA_ACCESS_TOKEN` configurado no `.env.local`
- `ASANA_PROJECT_GID` configurado no `.env.local`

---

## Testando a Integração

### Teste 1: Task Manager → Asana

1. Abra o Task Manager em `http://localhost:3000/tasks`
2. Crie uma nova tarefa com "Enviar para Asana" marcado
3. Verifique no Asana se a tarefa apareceu na coluna correta
4. Edite o status no Task Manager e veja a tarefa mover de coluna no Asana

### Teste 2: Asana → Task Manager (Requer Webhooks)

1. Certifique-se que o webhook está registrado
2. Edite o título de uma tarefa no Asana
3. Aguarde ~5 segundos e veja a atualização no Task Manager
4. Mova a tarefa entre colunas no Asana e observe a mudança de status

### Verificar Logs

Os logs do servidor mostram toda a atividade de sincronização:

```
[ASANA] Creating task: Minha Tarefa
[ASANA] Task created: 1234567890123456
[ASANA WEBHOOK] Processing changed event for task 1234567890123456
[ASANA WEBHOOK] Updated task abc123: title, status
[POLLING] Updates detected, reloading tasks...
```

---

## Notas sobre ngrok Free

O plano gratuito do ngrok funciona, mas tem algumas limitações:

1. **URL muda a cada reinício** — Será necessário registrar um novo webhook
2. **Pode haver interstitial page** — Use o comando com `--host-header`:
   ```bash
   ngrok http 3000 --host-header=localhost
   ```
3. **Sessões expiram** — O tunnel pode cair após algumas horas de inatividade

**Dica:** Em produção com domínio próprio, o webhook será permanente.

---

## Referências

- [Asana API Documentation](https://developers.asana.com/docs)
- [Asana Developer Console](https://app.asana.com/0/developer-console)
- [Tasks API Reference](https://developers.asana.com/docs/tasks)
- [Sections API Reference](https://developers.asana.com/docs/sections)
- [Webhooks API Reference](https://developers.asana.com/docs/webhooks)
