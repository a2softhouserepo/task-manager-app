# Task Manager - Diagrams

Esta pasta contém todos os diagramas de arquitetura e fluxos do sistema em formato **Mermaid**.

## 📁 Arquivos

Todos os arquivos `.mmd` podem ser visualizados com a extensão "Mermaid Preview" no VS Code.

### 🗄️ Database & Data Model

| Arquivo | Descrição |
|---------|-----------|
| [database-schema.mmd](database-schema.mmd) | Schema completo do banco (ER Diagram) |
| [entity-relationships.mmd](entity-relationships.mmd) | Visão geral dos relacionamentos entre entidades |
| [client-hierarchy.mmd](client-hierarchy.mmd) | Sistema de hierarquia de clientes (Materialized Path) |
| [indexes-overview.mmd](indexes-overview.mmd) | Índices MongoDB otimizados |
| [data-encryption.mmd](data-encryption.mmd) | Fluxo de criptografia de dados sensíveis |

### 🔐 Security & Authentication

| Arquivo | Descrição |
|---------|-----------|
| [authentication-flow.mmd](authentication-flow.mmd) | Fluxo completo de autenticação com rate limiting |
| [user-roles.mmd](user-roles.mmd) | Sistema de permissões (user, admin, rootAdmin) |
| [security-model.mmd](security-model.mmd) | Modelo de segurança e campos protegidos |

### 🔄 Business Flows

| Arquivo | Descrição |
|---------|-----------|
| [application-flow.mmd](application-flow.mmd) | Fluxo principal da aplicação (4 cenários) |
| [task-workflow.mmd](task-workflow.mmd) | State machine de status de tarefas |
| [asana-integration.mmd](asana-integration.mmd) | Integração bidirecional com Asana + Webhooks |
| [backup-restore.mmd](backup-restore.mmd) | Sistema de backup automático e restauração |
| [audit-logging.mmd](audit-logging.mmd) | Sistema de auditoria e logs |
| [team-members.mmd](team-members.mmd) | Fluxo de membros da equipe |
| [cost-distribution.mmd](cost-distribution.mmd) | Distribuição de custos por membro |

### 🏗️ Architecture & Deployment

| Arquivo | Descrição |
|---------|-----------|
| [system-architecture.mmd](system-architecture.mmd) | Arquitetura geral do sistema (camadas) |
| [api-structure.mmd](api-structure.mmd) | Estrutura de rotas da API |
| [deployment.mmd](deployment.mmd) | Arquitetura de deployment e ambientes |

## 🛠️ Como Visualizar

### VS Code

1. Instale a extensão "Mermaid Preview" no VS Code
2. Abra qualquer arquivo `.mmd`
3. Clique no ícone de preview ou use `Ctrl+Shift+V` (Windows/Linux) ou `Cmd+Shift+V` (Mac)

### Online

Visualize ou edite os diagramas em:
- [Mermaid Live Editor](https://mermaid.live/)
- Ou diretamente no GitHub (renderiza automaticamente)

### Exportar para Imagem

1. Use o [Mermaid Live Editor](https://mermaid.live/)
2. Cole o conteúdo do arquivo `.mmd`
3. Exporte para PNG, SVG ou PDF

## 📊 Resumo das Entidades

```
┌─────────────────┬──────────────────────────────────────┐
│ Collection      │ Descrição                            │
├─────────────────┼──────────────────────────────────────┤
│ User            │ Usuários do sistema                  │
│ Task            │ Tarefas (entidade principal)         │
│ Client          │ Clientes (suporta hierarquia)        │
│ Category        │ Categorias de tarefas                │
│ AuditLog        │ Logs de auditoria                    │
│ Backup          │ Backups do sistema                   │
│ SystemConfig    │ Configurações do sistema             │
│ LoginAttempt    │ Tentativas de login (TTL: 1h)        │
└─────────────────┴──────────────────────────────────────┘
```

## 🔒 Campos Criptografados

Os seguintes campos utilizam criptografia AES-256-GCM:

- **User**: email
- **Task**: title, description, observations
- **Client**: name, phone, address, email, notes

## 🔗 Relacionamentos Principais

```
User ─────┬───> Task (cria/gerencia)
          ├───> Client (cria)
          ├───> Category (cria)
          ├───> AuditLog (gera)
          ├───> Backup (cria)
          └───> SystemConfig (atualiza)

Client ───┬───> Task (associado)
          └───> Client (hierarquia pai/filho)

Category ─────> Task (classifica)
```

## 📈 Índices Importantes

### Task (mais indexada)
- Índices compostos para queries de listagem
- Suporte a filtros por status, cliente, categoria
- Otimizado para dashboard e relatórios

### Client
- Índices para navegação hierárquica
- Materialized Path Pattern para queries eficientes

### LoginAttempt
- TTL index para auto-limpeza após 1 hora
- Proteção contra brute-force
