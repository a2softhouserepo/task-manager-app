# Task Manager App

Sistema de gerenciamento de tarefas e serviços prestados a clientes, com faturamento mensal e exportação de PDF.

## Funcionalidades

- ✅ **Dashboard** com gráficos de faturamento mensal e top clientes
- ✅ **CRUD de Tarefas** com filtros por mês, cliente, categoria e status
- ✅ **CRUD de Clientes** (modal style)
- ✅ **CRUD de Categorias** com ícones e cores
- ✅ **CRUD de Usuários** com 3 níveis de permissão
- ✅ **Exportação PDF** da listagem de serviços
- ✅ **Integração Asana** via e-mail (nodemailer)
- ✅ **Autenticação JWT** com cookies HTTP-only e refresh token
- ✅ **Criptografia AES-256-GCM** para dados sensíveis
- ✅ **Audit Logs** de todas as ações do sistema
- ✅ **Rate Limiting** para proteção contra ataques

## Requisitos

- Node.js 18+
- MongoDB 6+
- npm ou yarn

## Instalação

1. Clone o repositório e instale as dependências:

```bash
cd task-manager-app
npm install
```

2. Copie o arquivo de exemplo e configure as variáveis de ambiente:

```bash
cp .env.local.example .env.local
```

3. Edite o `.env.local` com suas configurações:

```env
MONGODB_URI=mongodb://localhost:27017/task-manager
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=sua-chave-secreta-aqui-minimo-32-caracteres
ENCRYPTION_KEY=chave-hex-64-caracteres
```

Para gerar uma chave de criptografia:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

4. Execute os scripts de seed para popular o banco:

```bash
# Todos os seeds de uma vez
node scripts/seed-all.js

# Ou individualmente:
node scripts/seed-users.js      # Cria usuários de teste
node scripts/seed-categories.js  # Cria categorias
node scripts/seed-clients.js     # Cria clientes de teste
node scripts/seed-tasks.js       # Cria 2 anos de tarefas
```

5. Inicie o servidor de desenvolvimento:

```bash
npm run dev
```

6. Acesse http://localhost:3000

## Usuários de Teste

| Usuário | Senha     | Papel      | Permissões                    |
|---------|-----------|------------|-------------------------------|
| root    | root123   | rootAdmin  | Acesso total ao sistema       |
| admin   | admin123  | admin      | Gerencia próprios registros   |
| user    | user123   | user       | Apenas visualização e criação |

## Estrutura de Permissões

- **rootAdmin**: Pode criar, editar e excluir qualquer registro
- **admin**: Pode criar e editar, mas só exclui próprios registros
- **user**: Pode criar e visualizar, não pode excluir

## Exportação PDF

A exportação de PDF reflete exatamente os filtros aplicados na tela:
- Período (mês ou intervalo customizado)
- Cliente
- Categoria
- Status

O PDF inclui:
- Cabeçalho com período e filtros
- Tabela com todas as tarefas
- Total acumulado

## Integração Asana

Ao criar uma tarefa, pode-se optar por enviá-la para o Asana via e-mail.

Configure as variáveis SMTP no `.env.local`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu-email@gmail.com
SMTP_PASS=sua-senha-de-app
ASANA_EMAIL=x@mail.asana.com
```

## Scripts Disponíveis

### Seed (Criar dados)

```bash
node scripts/seed-all.js        # Executa todos os seeds
node scripts/seed-users.js      # Cria usuários
node scripts/seed-categories.js # Cria categorias
node scripts/seed-clients.js    # Cria clientes
node scripts/seed-tasks.js      # Cria 2 anos de tarefas (3-5/semana)
```

### Clear (Limpar dados)

```bash
node scripts/clear-all.js       # Limpa TUDO (pede confirmação)
node scripts/clear-users.js     # Limpa usuários
node scripts/clear-categories.js# Limpa categorias
node scripts/clear-clients.js   # Limpa clientes
node scripts/clear-tasks.js     # Limpa tarefas
node scripts/clear-audit-logs.js# Limpa logs de auditoria
```

## Tecnologias

- **Next.js 16** - Framework React com App Router
- **React 19** - Biblioteca de UI
- **MongoDB/Mongoose** - Banco de dados NoSQL
- **NextAuth.js** - Autenticação JWT + Sessions
- **Tailwind CSS 4** - Estilização utility-first
- **Recharts** - Gráficos interativos
- **jsPDF + AutoTable** - Geração de PDF
- **Nodemailer** - Envio de e-mails SMTP
- **Zod** - Validação de schemas
- **bcryptjs** - Hash de senhas
- **lru-cache** - Cache LRU para otimização
- **use-debounce** - Debouncing de inputs
- **AES-256-GCM** - Criptografia de dados sensíveis

## Segurança

- Senhas hasheadas com bcrypt (10 rounds)
- Dados sensíveis criptografados com AES-256-GCM
- Blind indexes para busca em campos criptografados
- JWT com cookies HTTP-only
- Rate limiting por IP
- Audit logs de todas as ações
- CSRF protection via NextAuth

## Coleções MongoDB

Todas as coleções usam o prefixo `tasks-`:

- `tasks-users` - Usuários do sistema
- `tasks-clients` - Clientes (com suporte a hierarquia)
- `tasks-categories` - Categorias de serviços
- `tasks-tasks` - Tarefas/serviços
- `tasks-audit-logs` - Logs de auditoria
- `tasks-backups` - Backups do sistema
- `tasks-system-config` - Configurações dinâmicas
- `tasks-login-attempts` - Tentativas de login (TTL: 1h)

## Licença

MIT
