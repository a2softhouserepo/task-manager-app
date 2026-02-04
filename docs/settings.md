# Sistema de Configurações

## Visão Geral

O Task Manager possui um sistema de configurações dinâmicas que permite aos administradores root gerenciar parâmetros do sistema através de uma interface web, sem necessidade de editar arquivos `.env` ou fazer redeploys.

## Acesso

- **URL**: `/settings`
- **Permissão**: Apenas usuários com role `rootAdmin`
- **Menu**: Ícone de engrenagem (⚙️) no Header (área administrativa)

## Arquitetura

### Armazenamento

As configurações são armazenadas no MongoDB através do model `SystemConfig`:

```javascript
{
  key: String,           // Identificador único (ex: 'backup_frequency')
  value: Schema.Types.Mixed, // Valor da configuração
  type: String,          // 'string' | 'number' | 'boolean'
  category: String,      // Categoria para agrupamento
  label: String,         // Label amigável para UI
  description: String,   // Descrição da configuração
  options: [String]      // Opções válidas (para selects)
}
```

### Fallback para .env

O sistema implementa um padrão de fallback:

1. **Prioridade 1**: Valor no banco de dados
2. **Prioridade 2**: Variável de ambiente com sufixo `_FALLBACK`
3. **Prioridade 3**: Valor padrão hardcoded

### Cache no Cliente

As configurações são cacheadas no `localStorage` do navegador:

- **Chave**: `system_config_cache`
- **TTL**: 1 hora
- **Atualização**: Automática após cada alteração via UI

## Configurações Disponíveis

### Categoria: Backup

| Chave | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `backup_frequency` | select | `daily` | Frequência de backups automáticos |
| `backup_retention_days` | number | `30` | Dias para reter backups (0 = infinito) |
| `max_backups` | number | `50` | Número máximo de backups (0 = sem limite) |

### Categoria: Security

| Chave | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `max_login_attempts` | number | `5` | Tentativas antes de bloquear |
| `session_timeout_hours` | number | `24` | Timeout de sessão em horas |
| `audit_log_retention_days` | number | `90` | Dias para reter logs de auditoria |
| `maintenance_mode` | boolean | `false` | Ativa modo manutenção |

### Categoria: General

| Chave | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `app_name` | string | `Task Manager` | Nome da aplicação |

### Categoria: Asana

| Chave | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `asana_enabled` | boolean | `false` | Habilita integração com Asana |
| `asana_project_gid` | string | - | GID do projeto Asana para sincronização |
| `asana_workspace_gid` | string | - | GID do workspace Asana |
| `asana_default_assignee` | string | - | Email do assignee padrão no Asana |
| `asana_sync_on_create` | boolean | `true` | Sincronizar automaticamente ao criar tarefas |
| `asana_sync_on_update` | boolean | `true` | Sincronizar automaticamente ao atualizar tarefas |

> **Nota:** As configurações do Asana também podem ser definidas via variáveis de ambiente (`ASANA_TOKEN`, `ASANA_PROJECT_GID`, etc). Veja [asana-integration.md](asana-integration.md) para detalhes.

## Setup Inicial

### 1. Popular configurações padrão

```bash
npm run config:seed
```

### 2. Configurar variáveis de ambiente (fallback)

No arquivo `.env.local`:

```env
BACKUP_FREQUENCY_FALLBACK=daily
```

## API

### GET /api/settings

Retorna todas as configurações do sistema.

### PUT /api/settings

Atualiza configurações em lote.

```json
{
  "backup_frequency": "every_login",
  "maintenance_mode": true
}
```

### GET /api/settings/maintenance

Retorna status do modo manutenção (usado pelo middleware).

## Auditoria

Todas as alterações são registradas no AuditLog com:
- Usuário que alterou
- Valor anterior e novo
- Data/hora e IP

## Helpers no Código

```typescript
import { getConfig, setConfig, getAllConfigs } from '@/models/SystemConfig';

// Buscar configuração
const frequency = await getConfig<string>('backup_frequency', 'daily');

// Definir configuração
await setConfig('maintenance_mode', true);

// Buscar todas
const configs = await getAllConfigs();
```

## Adicionando Novas Configurações

1. Adicionar em `scripts/seed-config.js`
2. Executar `npm run config:seed`
3. Opcionalmente, adicionar fallback em `SystemConfig.ts`

## Veja Também

- [Backup Automático](backup-automatico.md)
- [Bloqueio de Login](bloqueio-login.md)
- [Modo Manutenção](modo-manutencao.md)
- [Timeout de Sessão](timeout-sessao.md)
