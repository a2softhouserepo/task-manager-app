# Integração com Asana

Este documento descreve como configurar e utilizar a integração do Task Manager com o Asana.

## Visão Geral

A integração permite:
- ✅ Criar tarefas no Asana automaticamente ao criar no Task Manager
- ✅ Atualizar tarefas existentes (título, descrição, data de entrega)
- ✅ Mover tarefas entre colunas (seções) baseado no status
- ✅ Marcar tarefas como concluídas ao excluir no Task Manager

## Pré-requisitos

- Conta no Asana (plano gratuito funciona)
- Um projeto no Asana configurado como Board (Kanban)

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
2. Se a tarefa tem `asanaTaskGid`, marca como concluída no Asana
3. A tarefa não é deletada do Asana (API não permite exclusão)

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

1. **Exclusão**: A API do Asana não permite deletar tarefas permanentemente. Tarefas excluídas são apenas marcadas como concluídas.

2. **Sincronização unidirecional**: Alterações feitas diretamente no Asana NÃO são refletidas no Task Manager.

3. **Assignees**: Atualmente não sincroniza responsáveis (assignees).

4. **Tags/Labels**: Atualmente não sincroniza tags ou labels.

---

## Scripts Disponíveis

### list-asana-sections.js

Lista as seções (colunas) de um projeto Asana.

```bash
node scripts/list-asana-sections.js
```

**Requisitos:**
- `ASANA_ACCESS_TOKEN` configurado no `.env.local`
- `ASANA_PROJECT_GID` configurado no `.env.local`

---

## Referências

- [Asana API Documentation](https://developers.asana.com/docs)
- [Asana Developer Console](https://app.asana.com/0/developer-console)
- [Tasks API Reference](https://developers.asana.com/docs/tasks)
- [Sections API Reference](https://developers.asana.com/docs/sections)
