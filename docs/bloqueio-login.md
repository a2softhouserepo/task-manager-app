# Bloqueio de Login

## Visão Geral

O sistema protege contra ataques de força bruta bloqueando temporariamente usuários/IPs após múltiplas tentativas de login falhas.

## Configuração

| Configuração | Tipo | Padrão | Descrição |
|--------------|------|--------|-----------|
| `max_login_attempts` | number | `5` | Tentativas permitidas antes do bloqueio |

### Janela de Tempo

O bloqueio tem uma janela fixa de **15 minutos**. Após esse período, as tentativas são resetadas automaticamente.

## Funcionamento

### Registro de Tentativas

Cada tentativa de login é registrada no MongoDB:

```typescript
// src/models/LoginAttempt.ts
{
  username: String,
  ipAddress: String,
  success: Boolean,
  userAgent: String,
  createdAt: Date  // TTL: 1 hora
}
```

### Verificação de Bloqueio

Antes de cada login, o sistema verifica:

```typescript
const blockCheck = await isLoginBlocked(username, ipAddress, maxAttempts);

if (blockCheck.blocked) {
  throw new Error(`Muitas tentativas de login. Tente novamente em ${blockCheck.minutesUntilReset} minutos.`);
}
```

### Limpeza Após Sucesso

Após login bem-sucedido, todas as tentativas anteriores são limpas:

```typescript
await clearLoginAttempts(username, ipAddress);
await recordLoginAttempt(username, ipAddress, true);
```

## Comportamento

### Mensagens ao Usuário

1. **Tentativa falha com tentativas restantes**:
   ```
   Usuário ou senha incorretos. 3 tentativas restantes.
   ```

2. **Conta bloqueada**:
   ```
   Muitas tentativas de login. Tente novamente em 12 minutos.
   ```

### Critérios de Bloqueio

O bloqueio acontece quando:
- **Username** tem X tentativas falhas em 15 minutos, OU
- **IP** tem X tentativas falhas em 15 minutos

Isso previne:
- Ataques focados em um usuário específico
- Ataques distribuídos de um mesmo IP

## Armazenamento

### MongoDB Collection

Collection: `{DB_PREFIX}login-attempts`

### TTL Automático

Documentos expiram automaticamente após 1 hora:

```typescript
createdAt: { 
  type: Date, 
  default: Date.now, 
  expires: 3600 // 1 hora
}
```

## Logs de Auditoria

Tentativas de login são registradas no AuditLog:

### Login Falho

```json
{
  "action": "LOGIN_FAILED",
  "resource": "USER",
  "details": {
    "reason": "Invalid password",
    "username": "john",
    "remainingAttempts": 2
  }
}
```

### Login Bem-Sucedido

```json
{
  "action": "LOGIN_SUCCESS",
  "resource": "USER",
  "details": {
    "username": "john",
    "role": "admin"
  }
}
```

## Rate Limiting Adicional

Além do bloqueio por tentativas, existe um rate limit em memória como backup:

```typescript
const rateLimitResult = rateLimit(`login:${credentials.username}`, {
  maxAttempts: maxAttempts,
  windowMs: 15 * 60 * 1000 // 15 minutos
});
```

Este funciona mesmo se o banco de dados estiver lento ou indisponível.

## API Helpers

### isLoginBlocked()

```typescript
const { blocked, remainingAttempts, minutesUntilReset } = 
  await isLoginBlocked(username, ipAddress, maxAttempts);
```

### recordLoginAttempt()

```typescript
await recordLoginAttempt(username, ipAddress, success, userAgent);
```

### clearLoginAttempts()

```typescript
await clearLoginAttempts(username, ipAddress);
```

## Configuração via UI

1. Acesse `/settings` como rootAdmin
2. Na seção **Security**, configure:
   - Máximo de Tentativas de Login

## Considerações de Segurança

1. **Informações limitadas**: Não revelamos se o usuário existe ou não
2. **Bloqueio por IP**: Previne ataques distribuídos
3. **TTL automático**: Registros são limpos automaticamente
4. **Dupla proteção**: Rate limit em memória + bloqueio em banco

## Troubleshooting

### Usuário bloqueado

Se um usuário legítimo for bloqueado:

1. Aguarde 15 minutos, ou
2. Um admin pode limpar manualmente:

```javascript
// No MongoDB
db['tasks-login-attempts'].deleteMany({ 
  $or: [{ username: 'usuario' }, { ipAddress: 'ip' }] 
});
```

### Verificar tentativas

```javascript
// No MongoDB
db['tasks-login-attempts'].find({ username: 'usuario' }).sort({ createdAt: -1 });
```

## Veja Também

- [Audit Logs](/audit-logs) - Ver tentativas de login
- [Settings](/settings) - Configurar máximo de tentativas
