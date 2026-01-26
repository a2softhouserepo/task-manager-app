# Modo Manutenção

## Visão Geral

O modo manutenção permite bloquear o acesso ao sistema durante atualizações ou manutenções programadas, permitindo apenas que administradores root acessem.

## Configuração

| Configuração | Tipo | Padrão | Descrição |
|--------------|------|--------|-----------|
| `maintenance_mode` | boolean | `false` | Ativa/desativa modo manutenção |

## Funcionamento

### Ativação

1. Acesse `/settings` como rootAdmin
2. Na seção **Security**, ative **Modo Manutenção**
3. Clique em **Salvar Alterações**

### Comportamento

Quando ativo:

- **rootAdmin**: Acesso normal ao sistema
- **Outros usuários**: Redirecionados para `/maintenance`

### Verificação

O componente `MaintenanceModeChecker` em `Providers.tsx` verifica o status:

```typescript
const res = await fetch('/api/settings/maintenance');
const data = await res.json();

if (data.enabled && userRole !== 'rootAdmin') {
  router.push('/maintenance');
}
```

## Página de Manutenção

URL: `/maintenance`

A página mostra:
- Mensagem informativa sobre a manutenção
- Verificação automática a cada 30 segundos
- Botão para verificar manualmente
- Link para login (administradores)

### Recursos da Página

```typescript
// Verificação automática
useEffect(() => {
  const interval = setInterval(checkMaintenanceStatus, 30000);
  return () => clearInterval(interval);
}, []);

// Quando manutenção é desativada
if (!data.enabled) {
  router.push('/');
}
```

## API

### GET /api/settings/maintenance

Retorna o status do modo manutenção.

**Response:**
```json
{
  "enabled": true,
  "message": "Sistema em modo manutenção"
}
```

### Headers Especiais

Requests internos (do middleware) usam header especial:

```typescript
headers: { 'x-internal-request': 'true' }
```

## Rotas Isentas

As seguintes rotas são sempre acessíveis:

- `/login` - Para administradores fazerem login
- `/maintenance` - Página de manutenção
- `/api/auth/*` - Endpoints de autenticação
- `/api/settings/maintenance` - Verificação de status

## Casos de Uso

### 1. Manutenção Programada

1. Notifique os usuários com antecedência
2. Ative o modo manutenção
3. Realize as atualizações necessárias
4. Desative o modo manutenção

### 2. Emergência

1. Ative imediatamente via `/settings`
2. Investigue o problema
3. Corrija e desative quando estável

### 3. Atualizações de Banco de Dados

1. Ative modo manutenção
2. Execute migrations/scripts
3. Teste como rootAdmin
4. Desative modo manutenção

## Auditoria

Alterações no modo manutenção são registradas:

```json
{
  "action": "config_update",
  "resource": "system_config",
  "resourceId": "maintenance_mode",
  "details": {
    "key": "maintenance_mode",
    "oldValue": false,
    "newValue": true
  }
}
```

## Configuração Programática

### Ativar

```typescript
import { setConfig } from '@/models/SystemConfig';

await setConfig('maintenance_mode', true);
```

### Verificar

```typescript
import { getConfig } from '@/models/SystemConfig';

const isMaintenanceMode = await getConfig<boolean>('maintenance_mode', false);
```

### Via API

```bash
curl -X PUT /api/settings \
  -H "Content-Type: application/json" \
  -d '{"maintenance_mode": true}'
```

## Segurança

1. **Apenas rootAdmin** pode ativar/desativar
2. **rootAdmin sempre acessa** mesmo durante manutenção
3. **Sessões existentes** são verificadas a cada navegação
4. **Auditoria completa** de todas alterações

## Interface Visual

### Página de Manutenção

```
┌─────────────────────────────────────────┐
│                                         │
│            ⚙️ (animado)                 │
│                                         │
│     Sistema em Manutenção               │
│                                         │
│  Estamos realizando melhorias no        │
│  sistema. Por favor, aguarde.           │
│                                         │
│  [🔄 Verificando automaticamente...]    │
│                                         │
│  [      Verificar Agora      ]          │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ Administradores: Faça login →   │    │
│  └─────────────────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

## Troubleshooting

### Sistema não sai do modo manutenção

1. Verifique se está logado como rootAdmin
2. Acesse `/settings` e desative
3. Ou via MongoDB:

```javascript
db['tasks-system-config'].updateOne(
  { key: 'maintenance_mode' },
  { $set: { value: false } }
);
```

### Usuários ainda acessando

1. O cache do cliente pode demorar até 1 minuto
2. Usuários precisam navegar para serem redirecionados
3. Sessões ativas não são encerradas automaticamente

## Veja Também

- [Settings](/settings) - Página de configurações
- [Audit Logs](/audit-logs) - Histórico de alterações
