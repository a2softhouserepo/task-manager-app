# Backup Automático

## Visão Geral

O sistema realiza backups automáticos quando o rootAdmin faz login, com frequência configurável.

## Configurações

| Configuração | Tipo | Padrão | Descrição |
|--------------|------|--------|-----------|
| `backup_frequency` | select | `daily` | Frequência do backup |
| `backup_retention_days` | number | `30` | Dias para manter backups |
| `max_backups` | number | `50` | Limite máximo de backups |

### Opções de Frequência

- **`daily`**: Backup apenas se passou 24h do último
- **`every_login`**: Backup a cada login de rootAdmin  
- **`disabled`**: Backup automático desativado

## Funcionamento

### Trigger

O backup é disparado automaticamente durante o login do rootAdmin em `src/lib/auth.ts`:

```typescript
if (user.role === 'rootAdmin') {
  const backupFrequency = await getConfig<'daily' | 'every_login' | 'disabled'>(
    'backup_frequency',
    process.env.BACKUP_FREQUENCY_FALLBACK
  );
  await checkAndTriggerAutoBackup(backupFrequency);
}
```

### Limpeza Automática

Após cada backup, o sistema executa:

1. **`cleanupOldBackups()`**: Remove backups AUTO mais antigos que `backup_retention_days`
2. **`enforceMaxBackups()`**: Remove os mais antigos se ultrapassar `max_backups`

```typescript
// Após backup bem-sucedido
await cleanupOldBackups();
await enforceMaxBackups();
```

### Logs

O sistema gera logs detalhados:

```
🔧 Backup automático configurado como: daily
🔄 Disparando backup automático (últimas 24h)...
✅ Backup criado: backup-auto-2026-01-26_14-30-00.json (1.2 MB)
🧹 Executando limpeza de backups antigos...
🗑️ Removido: backup-auto-2025-12-20_10-00-00.json
✅ Limpeza concluída: 3 backups removidos
```

## Conteúdo do Backup

O backup inclui:

- ✅ Tasks
- ✅ Clients
- ✅ Categories
- ❌ Users (excluídos por segurança)
- ❌ SystemConfig
- ❌ AuditLogs

## Estrutura do Arquivo

```json
{
  "timestamp": "2026-01-26T14:30:00.000Z",
  "version": "1.0",
  "stats": {
    "tasks": 150,
    "clients": 45,
    "categories": 12
  },
  "collections": {
    "tasks": [...],
    "clients": [...],
    "categories": [...]
  }
}
```

## Auditoria

Todas as operações de backup são registradas:

| Ação | Descrição |
|------|-----------|
| `CREATE` | Backup criado |
| `DELETE` | Backup removido (limpeza) |
| `UPDATE` | Backup restaurado |

## API

### Criar Backup Manual

```bash
POST /api/backups
```

### Listar Backups

```bash
GET /api/backups
```

### Restaurar Backup

```bash
POST /api/backups/:id/restore
```

### Download Backup

```bash
GET /api/backups/:id/download
```

## Configuração via UI

1. Acesse `/settings` como rootAdmin
2. Na seção **Backup**, configure:
   - Frequência de Backup Automático
   - Dias de Retenção de Backups
   - Máximo de Backups Armazenados

## Fallback

Se a configuração não existir no banco, usa variável de ambiente:

```env
BACKUP_FREQUENCY_FALLBACK=daily
```

## Veja Também

- [Backups - Página de Gerenciamento](/backups)
- [Settings - Configurações](/settings)
