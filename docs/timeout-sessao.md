# Timeout de Sessão

## Visão Geral

O sistema implementa um timeout de sessão configurável que desconecta automaticamente usuários inativos após um período determinado.

## Configuração

| Configuração | Tipo | Padrão | Descrição |
|--------------|------|--------|-----------|
| `session_timeout_hours` | number | `24` | Tempo de sessão em horas |

## Funcionamento

### Registro do Login

No momento do login, o timestamp é salvo no token JWT:

```typescript
// src/lib/auth.ts - callback jwt
async jwt({ token, user }) {
  if (user) {
    token.loginTime = Date.now(); // Momento do login
    // ...
  }
  return token;
}
```

### Verificação de Expiração

A cada requisição de sessão, o timeout é verificado:

```typescript
// src/lib/auth.ts - callback session
async session({ session, token }) {
  const timeoutHours = await getConfig<number>('session_timeout_hours', 24);
  const timeoutMs = timeoutHours * 60 * 60 * 1000;
  const loginTime = token.loginTime || Date.now();
  
  if (Date.now() - loginTime > timeoutMs) {
    session.expired = true;
  }
  
  return session;
}
```

### Ação no Cliente

O componente `SessionExpirationChecker` monitora a sessão:

```typescript
// src/components/Providers.tsx
function SessionExpirationChecker({ children }) {
  const { data: session } = useSession();
  
  useEffect(() => {
    if (session?.expired) {
      signOut({ 
        callbackUrl: '/login?expired=true',
        redirect: true 
      });
    }
  }, [session]);
  
  return <>{children}</>;
}
```

## Fluxo de Expiração

```
1. Usuário faz login
   └─> loginTime salvo no JWT

2. Usuário navega/usa o sistema
   └─> A cada requisição, verifica: (agora - loginTime) > timeout?

3. Tempo excedido
   └─> session.expired = true

4. Cliente detecta expiração
   └─> signOut() automático
   └─> Redireciona para /login?expired=true

5. Página de login
   └─> Mostra mensagem "Sessão expirada"
```

## Página de Login

Quando redirecionado por expiração:

```typescript
// URL: /login?expired=true

// Na página de login, verificar:
const searchParams = useSearchParams();
const expired = searchParams.get('expired');

if (expired) {
  // Mostrar: "Sua sessão expirou. Por favor, faça login novamente."
}
```

## Configuração via UI

1. Acesse `/settings` como rootAdmin
2. Na seção **Security**, configure:
   - **Timeout de Sessão (horas)**
3. Salve as alterações

### Valores Recomendados

| Cenário | Valor | Descrição |
|---------|-------|-----------|
| Alta segurança | 1-4h | Bancos, saúde |
| Uso normal | 8-24h | Escritórios |
| Baixa segurança | 48-168h | Uso interno |

## Diferenças de NextAuth

O NextAuth tem seu próprio `maxAge` para JWT:

```typescript
session: {
  strategy: 'jwt',
  maxAge: 24 * 60 * 60 // 24h
}
```

**Nosso timeout é adicional:**

- `maxAge`: Tempo máximo absoluto do JWT
- `session_timeout_hours`: Tempo desde o login (configurável via UI)

Se `session_timeout_hours < maxAge`, o usuário será deslogado pelo nosso sistema primeiro.

## Comportamento Esperado

### Sessão Ativa

```
Login: 08:00
Timeout: 24h
Agora: 20:00
Status: Sessão válida (12h de uso)
```

### Sessão Expirada

```
Login: 08:00 (ontem)
Timeout: 24h
Agora: 10:00 (hoje)
Status: Sessão expirada (26h desde login)
→ Logout automático
```

## Limitações

1. **Não é "inatividade"**: O timeout conta desde o login, não desde a última atividade
2. **Verificação assíncrona**: Pode haver pequeno delay até detectar expiração
3. **JWT não revogável**: Até o cliente detectar, o JWT ainda é tecnicamente válido

## Implementação Futura

Para timeout por inatividade real, seria necessário:

1. Atualizar `lastActivity` no JWT a cada requisição
2. Verificar `(agora - lastActivity) > inactivityTimeout`
3. Isso aumentaria o tamanho do JWT e requisições

## Auditoria

Alterações no timeout são registradas:

```json
{
  "action": "config_update",
  "resource": "system_config",
  "resourceId": "session_timeout_hours",
  "details": {
    "oldValue": 24,
    "newValue": 8
  }
}
```

## Configuração Programática

```typescript
import { getConfig, setConfig } from '@/models/SystemConfig';

// Verificar timeout atual
const timeout = await getConfig<number>('session_timeout_hours', 24);

// Alterar timeout
await setConfig('session_timeout_hours', 12);
```

## Segurança

1. **Proteção contra sessões abandonadas**: Usuários que esquecem de fazer logout
2. **Redução de janela de ataque**: Tokens comprometidos expiram mais rápido
3. **Conformidade**: Requisito comum em auditorias de segurança

## Troubleshooting

### Usuário deslogado muito cedo

1. Verifique a configuração em `/settings`
2. O valor está em **horas**, não minutos
3. Verifique se o relógio do servidor está correto

### Usuário não é deslogado

1. O cliente precisa fazer uma requisição de sessão
2. Navegação ou atualização da página dispara a verificação
3. Abas inativas podem não verificar automaticamente

### Verificar tempo de sessão

No browser, DevTools > Application > Cookies:
- Procure o cookie de sessão do NextAuth
- O JWT contém `loginTime` (base64 decode do payload)

## Veja Também

- [Bloqueio de Login](bloqueio-login.md) - Proteção contra força bruta
- [Settings](/settings) - Configurar timeout
- [Audit Logs](/audit-logs) - Histórico de alterações
