# Sistema de Audit Logs

Este documento descreve a arquitetura, cobertura, melhores práticas e exemplos de uso do sistema de logs de auditoria implementado no Task Manager App.

---

## Objetivos
- **Segurança:** Detectar e rastrear ações críticas e tentativas de acesso não autorizado.
- **Compliance:** Atender requisitos de LGPD/GDPR, SOC2, OWASP e boas práticas de mercado.
- **Auditoria:** Permitir rastreabilidade completa de operações sensíveis e suporte a investigações.

---

## Estrutura do Audit Log

**Modelo:** `src/models/AuditLog.ts`

| Campo         | Tipo      | Descrição                                               |
|---------------|-----------|--------------------------------------------------------|
| userId        | string    | ID do usuário que realizou a ação                      |
| userName      | string    | Nome do usuário                                        |
| userEmail     | string    | Email do usuário                                       |
| action        | enum      | Tipo de ação (CRUD, LOGIN, READ, AUTH_FAILURE, etc.)   |
| resource      | enum      | Recurso afetado (TASK, USER, CLIENT, BACKUP, etc.)     |
| resourceId    | string    | ID do recurso afetado                                  |
| details       | mixed     | Detalhes da operação (antes/depois, campos, motivo)    |
| ipAddress     | string    | IP de origem da requisição                             |
| userAgent     | string    | User-Agent do cliente                                  |
| severity      | enum      | Severidade (INFO, WARN, CRITICAL)                      |
| status        | enum      | Status (SUCCESS, FAILURE)                              |
| createdAt     | Date      | Data/hora da operação                                  |

---

## Ações Registradas

- **CREATE, UPDATE, DELETE:** Todas operações de escrita em TASK, USER, CLIENT, CATEGORY
- **LOGIN_SUCCESS, LOGIN_FAILED:** Tentativas de login (sucesso e falha)
- **READ:** Visualização de dados sensíveis (detalhes de usuário/cliente)
- **AUTH_FAILURE:** Tentativas de acesso/edição/deleção não autorizadas
- **BACKUP_DOWNLOAD, BACKUP_RESTORE, IMPORT, EXPORT:** Operações críticas de backup/importação

---

## Severidade
- **INFO:** Operações normais (visualização, criação, atualização)
- **WARN:** Operações potencialmente sensíveis (deleção, download de backup)
- **CRITICAL:** Falhas de autenticação/autorização, restauração de backup, tentativas de ataque

---

## Exemplos de Uso

### 1. Registro de leitura sensível (GDPR)
```typescript
void logSensitiveRead({
  resource: 'USER',
  resourceId: userId,
  details: { viewedUserEmail: user.email, accessedFields: ['name', 'email', 'role'] },
});
```

### 2. Registro de falha de autorização
```typescript
void logAuthFailure({
  resource: 'CLIENT',
  resourceId: clientId,
  reason: 'Tentativa de editar cliente de outro usuário',
  attemptedAction: 'UPDATE',
});
```

### 3. Registro de download de backup
```typescript
await logAudit({
  action: 'BACKUP_DOWNLOAD',
  resource: 'BACKUP',
  resourceId: backupId,
  details: { filename: backup.filename },
  severity: 'CRITICAL',
});
```

---

## Política de Retenção
- Logs são mantidos por **1 ano** no banco de dados.
- Logs mais antigos são exportados para arquivo JSON e removidos do MongoDB via script [`archive-audit-logs.js`](../scripts/archive-audit-logs.js).
- Arquivos de log devem ser armazenados em local seguro (S3, Azure Blob, etc).

---

## Conformidade e Boas Práticas
- **LGPD/GDPR:** Registro de acesso a dados pessoais e tentativas de acesso não autorizado.
- **SOC2:** Política de retenção, proteção contra alteração/tampering, rastreabilidade.
- **OWASP:** Cobertura de eventos críticos, falhas de autenticação/autorização, exportação/importação.

---

## Auditoria e Investigação
- Permite responder: "Quem acessou/modificou/deletou tal dado?"
- Permite identificar tentativas de ataque ou exfiltração de dados.
- Suporte a investigações internas e externas.

---

## Referências
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- [GDPR Audit Log Requirements](https://gdpr-info.eu/art-30-gdpr/)
- [SOC2 Controls](https://www.aicpa.org/resources/article/soc-2-report)

---

## Dúvidas?
Consulte o time de segurança ou o responsável técnico pelo sistema.
