# Hierarquia de Clientes (Sub-Clientes)

Este documento descreve a arquitetura, funcionamento e uso do sistema de hierarquia de clientes implementado no Task Manager App.

---

## 📋 Visão Geral

O sistema de hierarquia de clientes permite organizar clientes em estrutura de árvore com múltiplos níveis, possibilitando:

- **Clientes Diretos**: Quem contrata e paga pelos serviços (ex: Agências)
- **Sub-Clientes**: Clientes atendidos através do cliente direto (ex: Clientes da Agência)
- **Níveis Ilimitados**: Suporte a hierarquias profundas (Agência > Cliente > Projeto > Divisão...)

### Exemplo Prático

```
📁 Agência Marketing ABC (Cliente Direto - quem paga)
   ├── 📁 Empresa X (Sub-cliente)
   │   ├── 📄 Projeto Website
   │   └── 📄 Projeto App Mobile
   ├── 📁 Empresa Y (Sub-cliente)
   │   └── 📁 Divisão Varejo (Sub-sub-cliente)
   │       ├── 📄 Campanha Black Friday
   │       └── 📄 Campanha Natal
   └── 📁 Empresa Z (Sub-cliente)

📁 Cliente Direto Beta (Cliente Direto)
   └── (sem sub-clientes)
```

---

## 🗃️ Modelo de Dados

### Schema do Cliente

**Arquivo:** `src/models/Client.ts`

| Campo           | Tipo       | Descrição                                                    |
|-----------------|------------|--------------------------------------------------------------|
| `_id`           | ObjectId   | Identificador único                                          |
| `name`          | string     | Nome do cliente (criptografado)                              |
| `parentId`      | string?    | ID do cliente pai (null = cliente raiz/direto)               |
| `path`          | string[]   | Array com IDs de todos os ancestrais (para queries rápidas)  |
| `depth`         | number     | Nível na hierarquia (0 = raiz, 1 = filho direto, etc)        |
| `rootClientId`  | string?    | ID do cliente raiz da árvore (para agregações)               |
| `childrenCount` | number     | Contador de filhos diretos (denormalizado)                   |
| `phone`         | string?    | Telefone (criptografado)                                     |
| `email`         | string?    | Email (criptografado)                                        |
| `address`       | string?    | Endereço (criptografado)                                     |
| `notes`         | string?    | Observações (criptografado)                                  |
| `active`        | boolean    | Status ativo/inativo                                         |
| `createdBy`     | string     | ID do usuário que criou                                      |
| `createdAt`     | Date       | Data de criação                                              |
| `updatedAt`     | Date       | Data de atualização                                          |

### Campos de Hierarquia Explicados

#### `parentId`
- `null` ou ausente: Cliente é raiz (cliente direto)
- Preenchido: Cliente é sub-cliente do `parentId`

#### `path`
Array materializado com todos os ancestrais, do mais antigo ao pai direto:
```javascript
// Agência ABC (raiz)
{ _id: "abc123", path: [], depth: 0 }

// Empresa X (filho da Agência ABC)
{ _id: "xyz456", parentId: "abc123", path: ["abc123"], depth: 1 }

// Divisão Varejo (filho da Empresa X)
{ _id: "div789", parentId: "xyz456", path: ["abc123", "xyz456"], depth: 2 }
```

Isso permite queries eficientes como:
- "Todos os descendentes de X": `{ path: "X" }`
- "Todos os ancestrais de Y": `{ _id: { $in: Y.path } }`

#### `rootClientId`
ID do cliente raiz da árvore. Facilita agregações por "conta principal":
```javascript
// Todos os clientes/sub-clientes da Agência ABC
{ rootClientId: "abc123" }
```

---

## 🔌 API Endpoints

### Listar Clientes

**GET** `/api/clients`

Query params:
| Param          | Tipo    | Descrição                                           |
|----------------|---------|-----------------------------------------------------|
| `parentId`     | string  | Filtrar por pai (use "null" para clientes raiz)     |
| `rootClientId` | string  | Filtrar por cliente raiz (toda a árvore)            |
| `depth`        | number  | Filtrar por nível na hierarquia                     |
| `tree`         | boolean | Se true, retorna estrutura em árvore                |
| `flat`         | boolean | Se true, retorna lista plana com indentação         |

**Exemplos:**
```bash
# Apenas clientes diretos (raiz)
GET /api/clients?parentId=null

# Sub-clientes de um cliente específico
GET /api/clients?parentId=abc123

# Toda a árvore de um cliente direto
GET /api/clients?rootClientId=abc123

# Estrutura em árvore completa
GET /api/clients?tree=true
```

**Resposta (tree=true):**
```json
{
  "clients": [
    {
      "_id": "abc123",
      "name": "Agência ABC",
      "depth": 0,
      "childrenCount": 2,
      "children": [
        {
          "_id": "xyz456",
          "name": "Empresa X",
          "depth": 1,
          "childrenCount": 0,
          "children": []
        },
        {
          "_id": "xyz789",
          "name": "Empresa Y",
          "depth": 1,
          "childrenCount": 1,
          "children": [
            {
              "_id": "div001",
              "name": "Divisão Varejo",
              "depth": 2,
              "children": []
            }
          ]
        }
      ]
    }
  ]
}
```

### Criar Cliente

**POST** `/api/clients`

Body:
```json
{
  "name": "Novo Sub-Cliente",
  "parentId": "abc123",  // opcional - se omitido, é cliente raiz
  "email": "contato@exemplo.com",
  "phone": "(11) 99999-9999"
}
```

O sistema automaticamente:
1. Calcula `path` baseado no pai
2. Define `depth` baseado no pai
3. Define `rootClientId` baseado no ancestral raiz
4. Incrementa `childrenCount` do pai

### Mover Cliente

**PATCH** `/api/clients/:id/move`

Body:
```json
{
  "newParentId": "xyz789"  // null para tornar cliente raiz
}
```

O sistema automaticamente:
1. Recalcula `path` para o cliente e todos os descendentes
2. Recalcula `depth` para toda a sub-árvore
3. Atualiza `rootClientId` se mudou de árvore
4. Atualiza `childrenCount` do pai antigo e novo

### Excluir Cliente

**DELETE** `/api/clients/:id`

Comportamento:
- **Com sub-clientes**: Retorna erro 400 - deve excluir filhos primeiro ou usar `?cascade=true`
- **`?cascade=true`**: Exclui cliente e TODOS os descendentes
- **`?orphan=true`**: Exclui cliente e promove filhos para o nível do pai excluído

---

## 🎨 Interface do Usuário

### Listagem de Clientes

A página de clientes exibe a hierarquia de forma visual:

```
┌─────────────────────────────────────────────────────────────────┐
│ 📁 Agência Marketing ABC                          [Editar] [+]  │
│    ├── 📁 Empresa X                              [Editar] [+]  │
│    │   ├── 📄 Projeto Website                    [Editar]      │
│    │   └── 📄 Projeto App                        [Editar]      │
│    └── 📁 Empresa Y                              [Editar] [+]  │
│        └── 📁 Divisão Varejo                     [Editar] [+]  │
├─────────────────────────────────────────────────────────────────┤
│ 📁 Cliente Direto Beta                            [Editar] [+]  │
└─────────────────────────────────────────────────────────────────┘
```

- **Ícone 📁**: Cliente com sub-clientes
- **Ícone 📄**: Cliente sem sub-clientes (folha)
- **[+]**: Adicionar sub-cliente
- **Indentação**: Visual de níveis

### Formulário de Cliente

Ao criar/editar cliente:

```
┌─────────────────────────────────────────────────────────────────┐
│ Novo Cliente                                                     │
├─────────────────────────────────────────────────────────────────┤
│ Cliente Pai: [▼ Selecione (opcional) ─────────────────────────] │
│              │ (Nenhum - Cliente Direto)                       │
│              │ Agência Marketing ABC                           │
│              │   └── Empresa X                                 │
│              │   └── Empresa Y                                 │
│              │       └── Divisão Varejo                        │
│              │ Cliente Direto Beta                             │
│              └─────────────────────────────────────────────────│
│                                                                  │
│ Nome: [_________________________________________________]       │
│ Email: [________________________________________________]       │
│ Telefone: [_____________________________________________]       │
│                                                                  │
│                                    [Cancelar] [Salvar]          │
└─────────────────────────────────────────────────────────────────┘
```

### Filtros em Tarefas/Dashboard

Filtro de cliente com hierarquia:

```
Cliente: [▼ Todos os clientes ────────────────────────────────────]
         │ Todos os clientes                                      │
         │ ─────────────────────────────────────────────────────  │
         │ 📁 Agência Marketing ABC (e todos sub-clientes)        │
         │     └── Empresa X                                      │
         │     └── Empresa Y                                      │
         │         └── Divisão Varejo                             │
         │ 📁 Cliente Direto Beta                                 │
         └────────────────────────────────────────────────────────┘
```

Opções de filtro:
- **Cliente específico**: Apenas tarefas daquele cliente
- **Cliente + descendentes**: Tarefas do cliente e todos os sub-clientes
- **Apenas sub-clientes**: Exclui tarefas do cliente pai

---

## 📊 Relatórios e Agregações

### Custos por Hierarquia

O dashboard pode agregar custos por cliente raiz (conta principal):

```
┌─────────────────────────────────────────────────────────────────┐
│ Custos por Cliente (Agregado)                                    │
├─────────────────────────────────────────────────────────────────┤
│ Agência Marketing ABC ████████████████████████  R$ 45.000,00    │
│   ├── Empresa X       ████████████              R$ 20.000,00    │
│   ├── Empresa Y       ██████████                R$ 18.000,00    │
│   │   └── Div. Varejo ████████                  R$ 15.000,00    │
│   └── Direto Agência  ███                       R$  7.000,00    │
├─────────────────────────────────────────────────────────────────┤
│ Cliente Direto Beta   ██████████                R$ 18.500,00    │
└─────────────────────────────────────────────────────────────────┘
```

### Exportação de Relatórios

Relatórios podem incluir:
- Coluna "Cliente Direto" (raiz da árvore)
- Coluna "Sub-Cliente" (cliente específico da tarefa)
- Coluna "Caminho Completo" (Agência > Empresa > Divisão)

---

## 🔄 Migração de Dados

### Script de Migração

Para dados existentes, um script de migração adiciona os novos campos:

```javascript
// scripts/migrate-client-hierarchy.js
// Adiciona campos de hierarquia com valores padrão para clientes existentes
// Todos os clientes existentes tornam-se clientes raiz (depth: 0)
```

### Compatibilidade

- Clientes existentes sem `parentId` são tratados como clientes raiz
- Tarefas existentes continuam funcionando normalmente
- Filtros sem hierarquia retornam resultados idênticos aos anteriores

---

## ⚡ Performance

### Índices do MongoDB

```javascript
// Índices para queries eficientes
ClientSchema.index({ parentId: 1 });
ClientSchema.index({ path: 1 });
ClientSchema.index({ rootClientId: 1 });
ClientSchema.index({ depth: 1 });
ClientSchema.index({ parentId: 1, active: 1 });
```

### Estratégias de Otimização

1. **Path Materializado**: Evita joins recursivos
2. **Denormalização**: `childrenCount`, `depth`, `rootClientId` pré-calculados
3. **Lazy Loading**: Árvore carregada por demanda em UIs grandes
4. **Cache**: Estrutura de árvore cacheada em memória

---

## 🔒 Segurança e Auditoria

### Permissões

- Usuários só veem clientes que criaram (exceto admin/rootAdmin)
- Ao criar sub-cliente, herda visibilidade do pai
- Mover cliente entre árvores requer permissão em ambas

### Logs de Auditoria

Todas as operações de hierarquia são registradas:
- `CLIENT_CREATE` com `parentId`
- `CLIENT_MOVE` com `oldParentId` e `newParentId`
- `CLIENT_DELETE_CASCADE` com lista de IDs afetados

---

## 📁 Arquivos Relacionados

| Arquivo                            | Descrição                              |
|------------------------------------|----------------------------------------|
| `src/models/Client.ts`             | Schema do cliente com hierarquia       |
| `src/app/api/clients/route.ts`     | Endpoints de listagem e criação        |
| `src/app/api/clients/[id]/route.ts`| Endpoints de edição e exclusão         |
| `src/app/clients/page.tsx`         | Página de listagem com árvore          |
| `src/components/ClientSelect.tsx`  | Seletor de cliente hierárquico         |
| `scripts/migrate-client-hierarchy.js` | Script de migração                  |

---

## 🚀 Roadmap Futuro

1. **Drag & Drop**: Reorganizar hierarquia arrastando clientes
2. **Templates**: Estruturas de hierarquia pré-definidas
3. **Permissões Granulares**: Acesso por nível da árvore
4. **Herança de Configurações**: Sub-clientes herdam config do pai
5. **Relatórios Consolidados**: Dashboard por conta principal
