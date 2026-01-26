# Sistema de Configurações

## Visão Geral

O sistema de configurações permite que administradores root (`rootAdmin`) gerenciem parâmetros do sistema através de uma interface web, sem necessidade de editar arquivos `.env` ou fazer redeploys.

## Acesso

- **URL**: `/settings`
- **Permissão**: Apenas usuários com role `rootAdmin`
- **Menu**: Ícone de engrenagem no Header (área administrativa)

## Arquitetura

### Armazenamento

As configurações são armazenadas no MongoDB através do model `SystemConfig`:

```javascript
{
  key: String,           // Identificador único (ex: 'backup_frequency')
  value: Schema.Types.Mixed, // Valor da configuração
  type: String,          // 'string' | 'number' | 'boolean' | 'select'
  category: String,      // Categoria para agrupamento
  label: String,         // Label amigável para UI
  description: String,   // Descrição da configuração
  options: [String]      // Opções válidas (para type 'select')
}
```

### Fallback para .env

O sistema implementa um padrão de fallback:

1. **Prioridade 1**: Valor no banco de dados
2. **Prioridade 2**: Variável de ambiente com sufixo `_FALLBACK`
3. **Prioridade 3**: Valor padrão hardcoded

Exemplo no código:
```typescript
const backupFrequency = await getConfig<'daily' | 'every_login' | 'disabled'>(
  'backup_frequency',
  process.env.BACKUP_FREQUENCY_FALLBACK  // Fallback para .env
);
```

### Cache no Cliente

As configurações são cacheadas no `localStorage` do navegador:

- **Chave**: `system_config_cache`
- **TTL**: 1 hora
- **Atualização**: Automática após cada alteração via UI
- **Formato**:
```json
{
  "timestamp": 1234567890,
  "configs": {
    "backup_frequency": "daily",
    "backup_retention_days": 30,
    ...
  }
}
```

## Configurações Disponíveis

### Categoria: Backup

| Chave | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `backup_frequency` | select | `daily` | Frequência de backups automáticos: `daily`, `every_login`, `disabled` |
| `backup_retention_days` | number | `30` | Dias para reter backups antes de expirar |
| `max_backups` | number | `50` | Número máximo de backups a manter |

### Categoria: Security

| Chave | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `audit_log_retention_days` | number | `90` | Dias para reter logs de auditoria |
| `session_timeout_hours` | number | `24` | Timeout de sessão em horas |

### Categoria: General

| Chave | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `app_name` | string | `Task Manager` | Nome da aplicação exibido no sistema |

## Setup Inicial

### 1. Popular configurações padrão

Execute o script de seed para criar as configurações no banco:

```bash
npm run seed:config
```

Este comando está definido no `package.json`:
```json
{
  "scripts": {
    "seed:config": "node scripts/seed-config.js"
  }
}
```

### 2. Configurar variáveis de ambiente (fallback)

No arquivo `.env.local`, configure os fallbacks:

```env
# Fallback para backup_frequency quando não houver valor no DB
BACKUP_FREQUENCY_FALLBACK=daily
```

## Uso da API

### GET /api/settings

Retorna todas as configurações do sistema.

**Headers**:
- Cookie de sessão válida com role `rootAdmin`

**Response**:
```json
[
  {
    "key": "backup_frequency",
    "value": "daily",
    "type": "select",
    "category": "backup",
    "label": "Frequência de Backup",
    "description": "Frequência dos backups automáticos",
    "options": ["daily", "every_login", "disabled"]
  },
  ...
]
```

### PUT /api/settings

Atualiza configurações em lote.

**Headers**:
- Cookie de sessão válida com role `rootAdmin`
- Content-Type: application/json

**Body**:
```json
{
  "backup_frequency": "every_login",
  "backup_retention_days": 60
}
```

**Response**:
```json
{
  "success": true,
  "updatedCount": 2
}
```

## Auditoria

Todas as alterações de configuração são registradas no sistema de Audit Logs:

| Campo | Valor |
|-------|-------|
| `action` | `config_update` |
| `resource` | `system_config` |
| `resourceId` | Chave da configuração |
| `details` | Valores antigo e novo |
| `userId` | ID do usuário que alterou |
| `userEmail` | Email do usuário |

Exemplo de log:
```json
{
  "action": "config_update",
  "resource": "system_config",
  "resourceId": "backup_frequency",
  "details": {
    "key": "backup_frequency",
    "oldValue": "daily",
    "newValue": "every_login"
  }
}
```

## Helpers no Código

### getConfig()

Busca uma configuração com fallback:

```typescript
import { getConfig } from '@/models/SystemConfig';

// Com fallback para .env
const frequency = await getConfig<string>(
  'backup_frequency',
  process.env.BACKUP_FREQUENCY_FALLBACK
);

// Sem fallback (usa default do FALLBACK_VALUES)
const retentionDays = await getConfig<number>('backup_retention_days');
```

### setConfig()

Define uma configuração:

```typescript
import { setConfig } from '@/models/SystemConfig';

await setConfig('backup_frequency', 'disabled');
```

### getAllConfigs()

Busca todas as configurações:

```typescript
import { getAllConfigs } from '@/models/SystemConfig';

const configs = await getAllConfigs();
// { backup_frequency: 'daily', backup_retention_days: 30, ... }
```

## Adicionando Novas Configurações

### 1. Atualizar o script de seed

Em `scripts/seed-config.js`:

```javascript
{
  key: 'minha_nova_config',
  value: 'valor_padrao',
  type: 'string',  // string | number | boolean | select
  category: 'general',  // backup | security | general
  label: 'Minha Nova Configuração',
  description: 'Descrição da configuração',
  options: []  // Para type 'select': ['opcao1', 'opcao2']
}
```

### 2. Executar o seed

```bash
npm run seed:config
```

### 3. Adicionar fallback (opcional)

No `src/models/SystemConfig.ts`, adicione ao `FALLBACK_VALUES`:

```typescript
const FALLBACK_VALUES: Record<string, any> = {
  backup_frequency: process.env.BACKUP_FREQUENCY_FALLBACK || 'daily',
  minha_nova_config: process.env.MINHA_NOVA_CONFIG_FALLBACK || 'valor_padrao',
  // ...
};
```

## Segurança

- Todas as rotas de configuração exigem autenticação
- Apenas usuários `rootAdmin` podem acessar
- Alterações são auditadas com IP e timestamp
- Cache do cliente expira automaticamente

## Troubleshooting

### Configurações não aparecem

1. Execute `npm run seed:config` para popular o banco
2. Verifique se está logado como `rootAdmin`
3. Limpe o cache do navegador

### Alterações não persistem

1. Verifique a conexão com MongoDB
2. Verifique os logs do console para erros de API
3. Confirme que o usuário tem permissão `rootAdmin`

### Cache desatualizado

O cache é atualizado automaticamente após cada alteração. Para forçar atualização:

1. Abra DevTools > Application > Local Storage
2. Delete a chave `system_config_cache`
3. Recarregue a página
