# 📜 Scripts de Manutenção e Gerenciamento

Esta pasta contém scripts utilitários para gerenciar o banco de dados, popular dados iniciais (seeds) e executar tarefas de manutenção.

---

## 📋 Índice

- [Seeds (Popular Dados)](#-seeds-popular-dados)
- [Clear (Limpar Dados)](#-clear-limpar-dados)
- [Import (Importação de Dados)](#-import-importação-de-dados)
- [Manutenção](#-manutenção)
- [Comandos NPM Disponíveis](#-comandos-npm-disponíveis)

---

## 🌱 Seeds (Popular Dados)

Scripts para popular o banco de dados com dados de teste ou iniciais.

### `seed-users.js`
Cria usuários padrão do sistema (admin, coordenador, operadores).

```bash
# Desenvolvimento
npm run users:seed

# Produção (com senhas específicas)
npm run users:seed:prod
```

### `seed-clients.js`
Cria clientes de exemplo com diferentes perfis e formas de contato.

```bash
npm run clients:seed
```

### `seed-categories.js`
Cria categorias de serviços (Branding, Sustentação, Eventos, etc.) com ícones e cores.

```bash
npm run categories:seed
```

### `seed-tasks.js`
Cria tarefas de exemplo vinculadas a clientes e categorias existentes.

```bash
npm run tasks:seed
```

### `seed-all.js`
Script completo que executa todos os seeds em sequência com melhor controle de erros e output.

```bash
node scripts/seed-all.js
# ou
npm run seed:all:script
```

**Ordem de execução:** users → categories → clients → tasks

### 🎯 Popular Tudo de Uma Vez (Comandos NPM)
```bash
npm run seed:all         # Usando comandos encadeados
npm run seed:all:script  # Usando script dedicado (recomendado)
```
**Executa na ordem:** users → clients → categories → tasks

---

## 🗑️ Clear (Limpar Dados)

Scripts para remover dados do banco de dados. **⚠️ Use com cuidado!**

### `clear-users.js`
Remove todos os usuários do sistema.

```bash
npm run users:clear
```

### `clear-clients.js`
Remove todos os clientes cadastrados.

```bash
npm run clients:clear
```

### `clear-categories.js`
Remove todas as categorias de serviços.

```bash
npm run categories:clear
```

### `clear-tasks.js`
Remove todas as tarefas cadastradas.

```bash
npm run tasks:clear
```

### `clear-audit-logs.js`
Remove todos os logs de auditoria.

```bash
npm run audit:clear
```

### `archive-audit-logs.js`
Arquiva logs de auditoria antigos (veja seção [Manutenção](#-manutenção)).

```bash
npm run audit:archive         # Modo dry-run
npm run audit:archive:execute # Executar arquivamento
```

### `clear-imported-data.js`
Remove apenas dados importados (mantém seeds).

```bash
npm run import:clear
```

### `clear-all.js`
Script completo que executa todos os clears em sequência com melhor controle de erros e output.

```bash
node scripts/clear-all.js
# ou
npm run clear:all:script
```

**Ordem de execução:** tasks → categories → clients → audit-logs

### 🎯 Limpar Tudo de Uma Vez (Comandos NPM)
```bash
npm run clear:all         # Usando comandos encadeados
npm run clear:all:script  # Usando script dedicado (recomendado)
```
**Executa na ordem:** tasks → categories → clients → audit-logs
**Executa na ordem:** tasks → categories → clients → audit-logs

---

## 📥 Import (Importação de Dados)

Scripts relacionados à importação e limpeza de dados externos. Atualmente o repositório não contém um script ativo de importação automática; mantenha apenas o comando para limpar dados importados.

```bash
npm run import:clear # Limpar dados importados
```

---

## 🔧 Manutenção

Scripts para manutenção e otimização do sistema.

### `archive-audit-logs.js`
Arquiva logs de auditoria antigos para economizar espaço no banco de dados.

**Funcionalidades:**
- Exporta logs > 1 ano para arquivo JSON (cold storage)
- Remove logs arquivados do MongoDB
- Mantém logs recentes para consultas rápidas
- Conformidade com GDPR e SOC2

```bash
# Modo dry-run (apenas visualizar)
npm run audit:archive

# Executar arquivamento
npm run audit:archive:execute
```

**Arquivos gerados:**  
`archive-logs/audit-logs-YYYY-MM-DD.json`

<!-- seção `update-category-icons.js` removida -->

---

## 🚀 Comandos NPM Disponíveis

### Desenvolvimento
```bash
npm run dev          # Iniciar servidor de desenvolvimento
npm run build        # Build de produção
npm run start        # Iniciar servidor de produção
npm run lint         # Executar linter
```

### Seeds
```bash
npm run seed:all         # Popular tudo (comandos encadeados)
npm run seed:all:script  # Popular tudo (script dedicado - recomendado)
npm run users:seed       # Popular usuários
npm run clients:seed # Popular clientes
npm run categories:seed # Popular categorias
npm run tasks:seed   # Popular tarefas
```

### Clear
```bash
npm run clear:all         # Limpar tudo (comandos encadeados)
npm run clear:all:script  # Limpar tudo (script dedicado - recomendado)
npm run users:clear       # Limpar usuários
npm run clients:clear     # Limpar clientes
npm run categories:clear  # Limpar categorias
npm run tasks:clear       # Limpar tarefas
npm run audit:clear       # Limpar logs de auditoria
npm run import:clear      # Limpar dados importados
```

### Import
```bash
npm run import:clear # Limpar dados importados
```

### Manutenção
```bash
npm run audit:archive         # Arquivar logs (dry-run)
npm run audit:archive:execute # Arquivar logs (executar)
npm run categories:update-icons # Atualizar ícones de categorias
```

### Testes
```bash
npm run test:db      # Testar conexão com banco de dados
```

---

## 📦 Variáveis de Ambiente Necessárias

Certifique-se de que o arquivo `.env.local` contém:

```env
MONGODB_URI=mongodb+srv://...
DB_PREFIX=tasks-
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
```

---

## 📂 Scripts Arquivados

Scripts obsoletos ou de uso único foram movidos para [`archive/`](./archive/) para manter a pasta organizada.

Consulte [archive/README.md](./archive/README.md) para mais detalhes.

---

## ⚠️ Avisos Importantes

1. **Ordem de Execução**: Ao popular dados, respeite a ordem de dependências:
   - Users → Clients → Categories → Tasks

2. **Produção**: Tenha muito cuidado ao executar scripts `clear:*` em ambiente de produção. Sempre faça backup antes.

3. **Logs de Auditoria**: O arquivamento automático ajuda a manter o banco otimizado. Configure uma rotina periódica (ex: mensalmente).

4. **Importação**: Verifique se o arquivo Excel está no formato esperado antes de importar.

---

**Última atualização:** 23 de janeiro de 2026
