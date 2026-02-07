# 📡 API Reference

Documentação completa de todos os endpoints da API do Task Manager App.

---

## 📋 Índice

- [Autenticação](#autenticação)
- [Tasks (Tarefas)](#tasks-tarefas)
- [Clients (Clientes)](#clients-clientes)
- [Categories (Categorias)](#categories-categorias)
- [Team Members (Membros da Equipe)](#team-members-membros-da-equipe)
- [Users (Usuários)](#users-usuários)
- [Backups](#backups)
- [Audit Logs](#audit-logs)
- [Settings (Configurações)](#settings-configurações)
- [Asana](#asana)
- [Códigos de Status](#códigos-de-status)
- [Rate Limiting](#rate-limiting)

---

## Base URL

```
Desenvolvimento: http://localhost:3000
Produção: https://seu-dominio.com
```

## Headers Comuns

Todas as requisições autenticadas devem incluir:

```http
Cookie: next-auth.session-token=seu-token-aqui
Content-Type: application/json
```

---

## Autenticação

### POST /api/auth/signin

Realiza login no sistema.

**Request:**
```json
{
  "username": "admin",
  "password": "senha123"
}
```

**Response (200):**
```json
{
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "username": "admin",
    "name": "Administrador",
    "email": "admin@example.com",
    "role": "admin"
  },
  "session": {
    "expires": "2026-03-04T12:00:00.000Z"
  }
}
```

**Errors:**
- `401` - Credenciais inválidas
- `403` - Usuário bloqueado (muitas tentativas falhas)
- `429` - Rate limit excedido

---

## Tasks (Tarefas)

### GET /api/tasks

Lista todas as tarefas com filtros opcionais.

**Query Parameters:**
| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `month` | string | Filtrar por mês (formato: YYYY-MM) |
| `clientId` | string | Filtrar por ID do cliente |
| `categoryId` | string | Filtrar por ID da categoria |
| `status` | string | `pending`, `in_progress`, `qa`, `completed`, `cancelled` |
| `search` | string | Buscar em título/descrição |
| `page` | number | Número da página (paginação) |
| `limit` | number | Itens por página (padrão: 50) |

**Example:**
```bash
GET /api/tasks?status=pending&categoryId=507f1f77bcf86cd799439011
```

**Response (200):**
```json
{
  "tasks": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "requestDate": "2026-02-01T00:00:00.000Z",
      "clientId": "507f1f77bcf86cd799439012",
      "clientName": "Cliente ABC",
      "rootClientName": "Grupo ABC",
      "categoryId": "507f1f77bcf86cd799439013",
      "categoryName": "Desenvolvimento",
      "categoryIcon": "💻",
      "categoryColor": "#3B82F6",
      "title": "Implementar nova feature",
      "description": "Descrição detalhada da tarefa",
      "deliveryDate": "2026-02-15T00:00:00.000Z",
      "cost": 1500.00,
      "observations": "Observações adicionais",
      "status": "in_progress",
      "asanaTaskGid": "1234567890",
      "asanaSynced": true,
      "userId": "507f1f77bcf86cd799439014",
      "createdBy": "507f1f77bcf86cd799439014",
      "createdAt": "2026-02-01T10:00:00.000Z",
      "updatedAt": "2026-02-01T10:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 150,
    "page": 1,
    "limit": 50,
    "pages": 3
  }
}
```

**Permissions:**
- `user`: Visualizar próprias tarefas
- `admin`: Visualizar próprias tarefas
- `rootAdmin`: Visualizar todas

---

### POST /api/tasks

Cria uma nova tarefa.

**Request:**
```json
{
  "requestDate": "2026-02-04",
  "clientId": "507f1f77bcf86cd799439012",
  "categoryId": "507f1f77bcf86cd799439013",
  "title": "Nova tarefa",
  "description": "Descrição da tarefa",
  "deliveryDate": "2026-02-20",
  "cost": 2000.00,
  "observations": "Observações opcionais",
  "status": "pending",
  "syncAsana": true
}
```

**Response (201):**
```json
{
  "task": {
    "_id": "507f1f77bcf86cd799439015",
    "requestDate": "2026-02-04T00:00:00.000Z",
    "clientId": "507f1f77bcf86cd799439012",
    "categoryId": "507f1f77bcf86cd799439013",
    "title": "Nova tarefa",
    "description": "Descrição da tarefa",
    "deliveryDate": "2026-02-20T00:00:00.000Z",
    "cost": 2000.00,
    "status": "pending",
    "asanaTaskGid": "1234567891",
    "asanaSynced": true,
    "createdAt": "2026-02-04T12:00:00.000Z"
  }
}
```

**Errors:**
- `400` - Dados inválidos
- `401` - Não autenticado
- `500` - Erro ao criar tarefa ou sincronizar Asana

**Permissions:**
- Todos os roles podem criar tarefas

---

### GET /api/tasks/[id]

Obtém detalhes de uma tarefa específica.

**Response (200):**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "requestDate": "2026-02-01T00:00:00.000Z",
  "clientId": "507f1f77bcf86cd799439012",
  "clientName": "Cliente ABC",
  "categoryId": "507f1f77bcf86cd799439013",
  "categoryName": "Desenvolvimento",
  "title": "Implementar nova feature",
  "description": "Descrição detalhada",
  "cost": 1500.00,
  "status": "in_progress",
  "asanaSynced": true,
  "createdAt": "2026-02-01T10:00:00.000Z"
}
```

**Errors:**
- `401` - Não autenticado
- `403` - Sem permissão para visualizar
- `404` - Tarefa não encontrada

---

### PUT /api/tasks/[id]

Atualiza uma tarefa existente.

**Request:**
```json
{
  "title": "Título atualizado",
  "status": "completed",
  "cost": 1800.00,
  "observations": "Tarefa concluída com sucesso"
}
```

**Response (200):**
```json
{
  "task": {
    "_id": "507f1f77bcf86cd799439011",
    "title": "Título atualizado",
    "status": "completed",
    "cost": 1800.00,
    "updatedAt": "2026-02-04T14:30:00.000Z"
  }
}
```

**Errors:**
- `400` - Dados inválidos
- `401` - Não autenticado
- `403` - Sem permissão (admin/user não podem editar tarefas de outros)
- `404` - Tarefa não encontrada

**Permissions:**
- `user`: Editar próprias tarefas
- `admin`: Editar próprias tarefas
- `rootAdmin`: Editar qualquer tarefa

---

### DELETE /api/tasks/[id]

Remove uma tarefa.

**Response (200):**
```json
{
  "message": "Tarefa deletada com sucesso"
}
```

**Errors:**
- `401` - Não autenticado
- `403` - Sem permissão (user/admin não podem deletar tarefas de outros)
- `404` - Tarefa não encontrada

**Permissions:**
- `user`: Não pode deletar
- `admin`: Deletar apenas próprias tarefas
- `rootAdmin`: Deletar qualquer tarefa

---

### GET /api/tasks/stats

Retorna estatísticas agregadas de tarefas.

**Query Parameters:**
| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `startDate` | string | Data inicial (ISO 8601) |
| `endDate` | string | Data final (ISO 8601) |
| `month` | string | Mês específico (YYYY-MM) |

**Response (200):**
```json
{
  "byStatus": {
    "pending": 25,
    "in_progress": 15,
    "qa": 5,
    "completed": 100,
    "cancelled": 3
  },
  "byClient": [
    {
      "clientId": "507f1f77bcf86cd799439012",
      "clientName": "Cliente ABC",
      "total": 45,
      "totalCost": 67500.00
    }
  ],
  "byCategory": [
    {
      "categoryId": "507f1f77bcf86cd799439013",
      "categoryName": "Desenvolvimento",
      "total": 60,
      "totalCost": 90000.00
    }
  ],
  "totals": {
    "totalTasks": 148,
    "totalCost": 222000.00
  }
}
```

**Permissions:**
- `user`: Estatísticas das próprias tarefas
- `admin`: Estatísticas das próprias tarefas
- `rootAdmin`: Estatísticas globais

---

### GET /api/tasks/updates

Retorna atualizações recentes (para sincronização em tempo real).

**Query Parameters:**
| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `since` | string | Timestamp ISO 8601 |

**Response (200):**
```json
{
  "updates": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "action": "updated",
      "timestamp": "2026-02-04T14:30:00.000Z"
    }
  ]
}
```

---

## Clients (Clientes)

### GET /api/clients

Lista todos os clientes (com suporte a hierarquia).

**Query Parameters:**
| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `active` | boolean | Filtrar por status ativo |
| `parentId` | string | Filtrar por cliente pai |
| `rootOnly` | boolean | Apenas clientes raiz |

**Response (200):**
```json
{
  "clients": [
    {
      "_id": "507f1f77bcf86cd799439012",
      "name": "Cliente ABC",
      "parentId": null,
      "path": [],
      "depth": 0,
      "childrenCount": 3,
      "phone": "+55 11 98765-4321",
      "email": "contato@clienteabc.com",
      "address": "Rua Exemplo, 123",
      "notes": "Cliente premium",
      "active": true,
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "hierarchy": [
    {
      "_id": "507f1f77bcf86cd799439012",
      "name": "Cliente ABC",
      "children": [
        {
          "_id": "507f1f77bcf86cd799439016",
          "name": "Filial São Paulo",
          "children": []
        }
      ]
    }
  ]
}
```

---

### POST /api/clients

Cria um novo cliente.

**Request:**
```json
{
  "name": "Novo Cliente",
  "parentId": null,
  "phone": "+55 11 99999-9999",
  "email": "contato@novocliente.com",
  "address": "Av. Teste, 456",
  "notes": "Cliente novo",
  "active": true
}
```

**Response (201):**
```json
{
  "client": {
    "_id": "507f1f77bcf86cd799439017",
    "name": "Novo Cliente",
    "parentId": null,
    "path": [],
    "depth": 0,
    "childrenCount": 0,
    "createdAt": "2026-02-04T15:00:00.000Z"
  }
}
```

**Errors:**
- `400` - Dados inválidos
- `401` - Não autenticado
- `409` - Cliente com mesmo nome já existe

---

### GET /api/clients/[id]

Obtém detalhes de um cliente.

**Response (200):**
```json
{
  "_id": "507f1f77bcf86cd799439012",
  "name": "Cliente ABC",
  "parentId": null,
  "path": [],
  "depth": 0,
  "childrenCount": 3,
  "phone": "+55 11 98765-4321",
  "email": "contato@clienteabc.com",
  "address": "Rua Exemplo, 123",
  "active": true,
  "children": [
    {
      "_id": "507f1f77bcf86cd799439016",
      "name": "Filial São Paulo"
    }
  ]
}
```

---

### PUT /api/clients/[id]

Atualiza um cliente.

**Request:**
```json
{
  "name": "Cliente ABC Ltda",
  "phone": "+55 11 98765-0000",
  "active": true
}
```

**Response (200):**
```json
{
  "client": {
    "_id": "507f1f77bcf86cd799439012",
    "name": "Cliente ABC Ltda",
    "phone": "+55 11 98765-0000",
    "updatedAt": "2026-02-04T16:00:00.000Z"
  }
}
```

**Permissions:**
- `user`: Não pode editar
- `admin`: Editar apenas próprios clientes
- `rootAdmin`: Editar qualquer cliente

---

### DELETE /api/clients/[id]

Remove um cliente.

**Response (200):**
```json
{
  "message": "Cliente deletado com sucesso"
}
```

**Errors:**
- `400` - Cliente tem tarefas associadas ou subclientes
- `403` - Sem permissão

**Permissions:**
- `user`: Não pode deletar
- `admin`: Deletar apenas próprios clientes sem tarefas
- `rootAdmin`: Deletar qualquer cliente

---

## Categories (Categorias)

### GET /api/categories

Lista todas as categorias.

**Query Parameters:**
| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `active` | boolean | Filtrar por status ativo |

**Response (200):**
```json
{
  "categories": [
    {
      "_id": "507f1f77bcf86cd799439013",
      "name": "Desenvolvimento",
      "description": "Projetos de desenvolvimento de software",
      "icon": "💻",
      "color": "#3B82F6",
      "active": true,
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### POST /api/categories

Cria uma nova categoria.

**Request:**
```json
{
  "name": "Design",
  "description": "Projetos de design gráfico",
  "icon": "🎨",
  "color": "#EC4899",
  "active": true
}
```

**Response (201):**
```json
{
  "category": {
    "_id": "507f1f77bcf86cd799439018",
    "name": "Design",
    "icon": "🎨",
    "color": "#EC4899",
    "active": true
  }
}
```

---

### GET /api/categories/[id]

Obtém detalhes de uma categoria.

---

### PUT /api/categories/[id]

Atualiza uma categoria.

**Permissions:**
- `user`: Não pode editar
- `admin`: Editar apenas próprias categorias
- `rootAdmin`: Editar qualquer categoria

---

### DELETE /api/categories/[id]

Remove uma categoria.

**Errors:**
- `400` - Categoria tem tarefas associadas

**Permissions:**
- Similar às permissões de clientes

---

## Team Members (Membros da Equipe)

### GET /api/team-members

Lista todos os membros da equipe.

**Query params:**
| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| active | boolean | Filtrar por status ativo/inativo |

**Response (200):**
```json
{
  "teamMembers": [
    {
      "_id": "...",
      "name": "Ana Silva",
      "role": "Desenvolvedora",
      "icon": "👩‍💻",
      "color": "#3B82F6",
      "active": true,
      "createdBy": "...",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### POST /api/team-members

Cria um novo membro da equipe.

**Body:**
```json
{
  "name": "Ana Silva",
  "role": "Desenvolvedora",
  "icon": "👩‍💻",
  "color": "#3B82F6"
}
```

### GET /api/team-members/[id]

Retorna um membro específico.

### PUT /api/team-members/[id]

Atualiza um membro. Se o nome for alterado, atualiza o nome denormalizado em todas as tarefas com distribuição de custo.

**Body (todos opcionais):**
```json
{
  "name": "Ana Costa",
  "role": "Tech Lead",
  "icon": "👩‍💼",
  "color": "#8B5CF6",
  "active": false
}
```

### DELETE /api/team-members/[id]

Remove um membro da equipe.

**Errors:**
- `400` - Membro tem tarefas com distribuição de custo associadas

### GET /api/team-members/stats

Retorna estatísticas de distribuição de custo por membro.

**Response (200):**
```json
{
  "currentMonth": [
    { "_id": "member_id", "teamMemberName": "Ana Silva", "total": 25.5, "count": 8 }
  ],
  "allTime": [
    { "_id": "member_id", "teamMemberName": "Ana Silva", "total": 150.0, "count": 42 }
  ]
}
```

---

## Users (Usuários)

### GET /api/users

Lista todos os usuários.

**Response (200):**
```json
{
  "users": [
    {
      "_id": "507f1f77bcf86cd799439014",
      "username": "admin",
      "name": "Administrador",
      "email": "admin@example.com",
      "role": "admin",
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

**Permissions:**
- `rootAdmin` apenas

---

### POST /api/users

Cria um novo usuário.

**Request:**
```json
{
  "username": "novousuario",
  "password": "senha123",
  "name": "Novo Usuário",
  "email": "novo@example.com",
  "role": "user"
}
```

**Response (201):**
```json
{
  "user": {
    "_id": "507f1f77bcf86cd799439019",
    "username": "novousuario",
    "name": "Novo Usuário",
    "email": "novo@example.com",
    "role": "user"
  }
}
```

**Permissions:**
- `rootAdmin` apenas

---

### GET /api/users/[id]

Obtém detalhes de um usuário.

---

### PUT /api/users/[id]

Atualiza um usuário.

**Request:**
```json
{
  "name": "Nome Atualizado",
  "email": "novoemail@example.com",
  "role": "admin",
  "password": "novasenha123"
}
```

**Permissions:**
- `rootAdmin` apenas

---

### DELETE /api/users/[id]

Remove um usuário.

**Errors:**
- `400` - Não pode deletar a si mesmo ou último rootAdmin

**Permissions:**
- `rootAdmin` apenas

---

## Backups

### GET /api/backups

Lista todos os backups.

**Response (200):**
```json
{
  "backups": [
    {
      "_id": "507f1f77bcf86cd79943901a",
      "filename": "backup-2026-02-04-120000.json",
      "size": 15360000,
      "type": "MANUAL",
      "createdBy": "507f1f77bcf86cd799439014",
      "stats": {
        "tasks": 148,
        "clients": 25,
        "categories": 8,
        "users": 5
      },
      "createdAt": "2026-02-04T12:00:00.000Z"
    }
  ]
}
```

**Permissions:**
- `rootAdmin` apenas

---

### POST /api/backups

Cria um backup manual.

**Response (201):**
```json
{
  "backup": {
    "_id": "507f1f77bcf86cd79943901a",
    "filename": "backup-2026-02-04-120000.json",
    "type": "MANUAL",
    "size": 15360000
  }
}
```

**Permissions:**
- `rootAdmin` apenas

---

### GET /api/backups/[id]

Obtém detalhes de um backup.

---

### GET /api/backups/[id]/download

Baixa um arquivo de backup.

**Response:** Arquivo JSON

**Permissions:**
- `rootAdmin` apenas

---

### POST /api/backups/[id]/restore

Restaura um backup.

**Response (200):**
```json
{
  "message": "Backup restaurado com sucesso",
  "stats": {
    "tasksRestored": 148,
    "clientsRestored": 25,
    "categoriesRestored": 8
  }
}
```

**Permissions:**
- `rootAdmin` apenas

---

### DELETE /api/backups/[id]

Remove um backup.

**Permissions:**
- `rootAdmin` apenas

---

### POST /api/backups/upload

Faz upload e restaura um backup.

**Request:** `multipart/form-data`
```
backup: [arquivo.json]
```

**Permissions:**
- `rootAdmin` apenas

---

## Audit Logs

### GET /api/audit-logs

Lista logs de auditoria com filtros.

**Query Parameters:**
| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `action` | string | Filtrar por ação |
| `resource` | string | Filtrar por recurso |
| `userId` | string | Filtrar por usuário |
| `startDate` | string | Data inicial |
| `endDate` | string | Data final |
| `page` | number | Página |
| `limit` | number | Itens por página |

**Response (200):**
```json
{
  "logs": [
    {
      "_id": "507f1f77bcf86cd79943901b",
      "userId": "507f1f77bcf86cd799439014",
      "userName": "Administrador",
      "userEmail": "admin@example.com",
      "action": "UPDATE",
      "resource": "TASK",
      "resourceId": "507f1f77bcf86cd799439011",
      "details": {
        "changes": {
          "status": {
            "from": "pending",
            "to": "completed"
          }
        }
      },
      "ipAddress": "192.168.1.100",
      "severity": "INFO",
      "status": "SUCCESS",
      "createdAt": "2026-02-04T14:30:00.000Z"
    }
  ],
  "pagination": {
    "total": 500,
    "page": 1,
    "limit": 50,
    "pages": 10
  }
}
```

**Permissions:**
- `rootAdmin` apenas

---

## Settings (Configurações)

### GET /api/settings

Retorna todas as configurações do sistema.

**Response (200):**
```json
{
  "settings": [
    {
      "key": "backup_frequency",
      "value": "daily",
      "type": "string",
      "category": "backup",
      "label": "Frequência de Backup",
      "options": ["every_login", "daily", "weekly", "monthly"]
    },
    {
      "key": "max_login_attempts",
      "value": 5,
      "type": "number",
      "category": "security",
      "label": "Tentativas Máximas de Login"
    },
    {
      "key": "maintenance_mode",
      "value": false,
      "type": "boolean",
      "category": "security",
      "label": "Modo Manutenção"
    }
  ]
}
```

**Permissions:**
- `rootAdmin` apenas

---

### PUT /api/settings

Atualiza configurações do sistema.

**Request:**
```json
{
  "backup_frequency": "weekly",
  "max_login_attempts": 3,
  "maintenance_mode": true
}
```

**Response (200):**
```json
{
  "message": "Configurações atualizadas com sucesso",
  "updated": ["backup_frequency", "max_login_attempts", "maintenance_mode"]
}
```

**Permissions:**
- `rootAdmin` apenas

---

### GET /api/settings/maintenance

Verifica status do modo manutenção (público).

**Response (200):**
```json
{
  "enabled": false
}
```

---

### GET /api/settings/asana

Retorna configurações do Asana.

**Response (200):**
```json
{
  "enabled": true,
  "projectGid": "1234567890",
  "workspaceGid": "9876543210",
  "syncOnCreate": true,
  "syncOnUpdate": true
}
```

**Permissions:**
- `rootAdmin` apenas

---

## Asana

### POST /api/asana/webhook

Recebe webhooks do Asana (público com verificação de secret).

**Headers:**
```
X-Hook-Secret: webhook-secret-do-asana
```

**Request:**
```json
{
  "events": [
    {
      "action": "changed",
      "resource": {
        "gid": "1234567890",
        "resource_type": "task"
      },
      "parent": {
        "gid": "1234567891",
        "resource_type": "section"
      }
    }
  ]
}
```

**Response (200):**
```json
{
  "received": true,
  "processed": 1
}
```

---

### GET /api/asana/webhook

Handshake de verificação do webhook (Asana).

**Headers:**
```
X-Hook-Secret: novo-secret-gerado
```

**Response (200):**
```
X-Hook-Secret: novo-secret-gerado
```

---

## Códigos de Status

| Código | Significado |
|--------|-------------|
| `200` | OK - Requisição bem-sucedida |
| `201` | Created - Recurso criado com sucesso |
| `400` | Bad Request - Dados inválidos ou faltando |
| `401` | Unauthorized - Não autenticado |
| `403` | Forbidden - Sem permissão |
| `404` | Not Found - Recurso não encontrado |
| `409` | Conflict - Conflito (ex: duplicado) |
| `429` | Too Many Requests - Rate limit excedido |
| `500` | Internal Server Error - Erro no servidor |

---

## Rate Limiting

A API implementa rate limiting para prevenir abuso:

| Endpoint | Limite |
|----------|--------|
| `/api/auth/*` | 5 requisições/minuto por IP |
| Outros endpoints | 100 requisições/minuto por usuário |

**Response quando excedido (429):**
```json
{
  "error": "Too many requests. Please try again later.",
  "retryAfter": 60
}
```

---

## Auditoria

Todas as operações de escrita (CREATE, UPDATE, DELETE) são automaticamente registradas no Audit Log com:
- Usuário que realizou a ação
- Timestamp
- IP de origem
- Detalhes da operação (campos alterados)

---

## Formato de Datas

Todas as datas seguem o padrão **ISO 8601**:
```
2026-02-04T12:00:00.000Z
```

---

## Criptografia de Campos

Os seguintes campos são criptografados em repouso (AES-256-GCM):

**Task:**
- `title`
- `description`
- `observations`

**Client:**
- `name`
- `phone`
- `address`
- `email`
- `notes`

**User:**
- `email`

---

## Paginação

Endpoints que retornam listas suportam paginação:

**Query Parameters:**
```
?page=1&limit=50
```

**Response:**
```json
{
  "data": [...],
  "pagination": {
    "total": 150,
    "page": 1,
    "limit": 50,
    "pages": 3
  }
}
```

---

## Exemplo de Integração (cURL)

### Login e obter session token

```bash
# Login
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  -c cookies.txt

# Usar session em próximas requisições
curl http://localhost:3000/api/tasks \
  -b cookies.txt
```

### Criar tarefa com Asana sync

```bash
curl -X POST http://localhost:3000/api/tasks \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{
    "requestDate": "2026-02-04",
    "clientId": "507f1f77bcf86cd799439012",
    "categoryId": "507f1f77bcf86cd799439013",
    "title": "Nova tarefa via API",
    "description": "Descrição da tarefa",
    "cost": 1500,
    "status": "pending",
    "syncAsana": true
  }'
```

---

## SDKs e Ferramentas

### Postman Collection

Importe a collection para Postman: [task-manager.postman_collection.json](../postman/task-manager.postman_collection.json) *(a ser criado)*

---

## Suporte

Para dúvidas ou problemas com a API:
- 📚 Documentação: [docs/INDEX.md](INDEX.md)
- 🐛 Issues: GitHub Issues
- 📧 Email: api@seu-dominio.com

---

*Última atualização: Fevereiro 2026*
