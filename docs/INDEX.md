# 📚 Índice de Documentação

> Task Manager App - Documentação Técnica Completa

---

## 🚀 Início Rápido

| Documento | Descrição |
|-----------|-----------|
| [README.md](../README.md) | Visão geral, instalação e configuração |
| [CHANGELOG.md](../CHANGELOG.md) | Histórico de versões e mudanças |
| [DEPLOYMENT.md](DEPLOYMENT.md) | 🚀 Guia completo de deployment (Vercel, VPS, Docker) |
| [API_REFERENCE.md](API_REFERENCE.md) | 📡 Documentação completa da API REST |

---

## 📊 Diagramas de Arquitetura

Todos os diagramas estão em formato Mermaid (`.mmd`). Veja [diagrams/README.md](diagrams/README.md) para detalhes.

### Banco de Dados
| Diagrama | Descrição |
|----------|-----------|
| [database-schema.mmd](diagrams/database-schema.mmd) | Schema ER completo (8 entidades) |
| [entity-relationships.mmd](diagrams/entity-relationships.mmd) | Relacionamentos entre entidades |
| [indexes-overview.mmd](diagrams/indexes-overview.mmd) | Índices MongoDB otimizados |
| [data-encryption.mmd](diagrams/data-encryption.mmd) | Fluxo de criptografia AES-256-GCM |
| [client-hierarchy.mmd](diagrams/client-hierarchy.mmd) | Hierarquia de clientes (Materialized Path) |

### Segurança
| Diagrama | Descrição |
|----------|-----------|
| [authentication-flow.mmd](diagrams/authentication-flow.mmd) | Fluxo de autenticação + rate limiting |
| [user-roles.mmd](diagrams/user-roles.mmd) | Permissões por role |
| [security-model.mmd](diagrams/security-model.mmd) | Modelo de segurança e proteções |

### Fluxos de Negócio
| Diagrama | Descrição |
|----------|-----------|
| [application-flow.mmd](diagrams/application-flow.mmd) | Fluxo principal (4 cenários) |
| [task-workflow.mmd](diagrams/task-workflow.mmd) | State machine de status |
| [asana-integration.mmd](diagrams/asana-integration.mmd) | Integração bidirecional Asana |
| [backup-restore.mmd](diagrams/backup-restore.mmd) | Sistema de backup/restore |
| [audit-logging.mmd](diagrams/audit-logging.mmd) | Sistema de auditoria |

### Arquitetura
| Diagrama | Descrição |
|----------|-----------|
| [system-architecture.mmd](diagrams/system-architecture.mmd) | Arquitetura em camadas |
| [api-structure.mmd](diagrams/api-structure.mmd) | Estrutura de rotas da API |
| [deployment.mmd](diagrams/deployment.mmd) | Arquitetura de deployment |

---

## 📖 Documentação Técnica

### Funcionalidades Principais

| Documento | Descrição |
|-----------|-----------|
| [asana-integration.md](asana-integration.md) | Integração completa com Asana (webhooks, sync) |
| [client-hierarchy.md](client-hierarchy.md) | Sistema de hierarquia de clientes |
| [dashboard-improvements.md](dashboard-improvements.md) | Melhorias de UI do Dashboard |
| [table-component.md](table-component.md) | Componente DataTable reutilizável |

### Segurança & Compliance

| Documento | Descrição |
|-----------|-----------|
| [audit-logs.md](audit-logs.md) | Sistema de auditoria (LGPD/GDPR/SOC2) |
| [bloqueio-login.md](bloqueio-login.md) | Proteção contra brute-force |
| [timeout-sessao.md](timeout-sessao.md) | Timeout de sessão configurável |

### Administração

| Documento | Descrição |
|-----------|-----------|
| [settings.md](settings.md) | Sistema de configurações dinâmicas |
| [backup-automatico.md](backup-automatico.md) | Backup automático no login |
| [modo-manutencao.md](modo-manutencao.md) | Modo de manutenção |

### Performance & DevOps

| Documento | Descrição |
|-----------|-----------|
| [performance.md](performance.md) | Otimizações implementadas |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Guia de deployment para produção |
| [AUDIT_REPORT.md](AUDIT_REPORT.md) | Relatório de auditoria da documentação |

### API & Integração

| Documento | Descrição |
|-----------|-----------|
| [API_REFERENCE.md](API_REFERENCE.md) | Referência completa de todos os endpoints |
| [asana-integration.md](asana-integration.md) | Integração bidirecional com Asana |

---

## 🛠️ Scripts de Desenvolvimento

Veja [scripts/README.md](../scripts/README.md) para documentação completa dos scripts.

### Seed (Criar Dados)
```bash
npm run db-seed:all          # Todos os seeds
npm run db-users:seed        # Usuários de teste
npm run db-categories:seed   # Categorias
npm run db-clients:seed      # Clientes
npm run db-tasks:seed        # Tarefas (2 anos de dados)
npm run db-config:seed       # Configurações do sistema
```

### Clear (Limpar Dados)
```bash
npm run db-clear:all         # Limpa tudo (com confirmação)
npm run db-audit:clear       # Limpa logs de auditoria
npm run db-audit:archive     # Arquiva logs antigos
```

### Asana
```bash
npm run asana:sections:list   # Lista seções do projeto
npm run asana:webhook:register # Registra webhook
npm run asana:webhook:list    # Lista webhooks
npm run asana:webhook:delete  # Remove webhooks
```

---

## 🔗 Links Externos

- [Mermaid Live Editor](https://mermaid.live/) - Visualizar/editar diagramas
- [Next.js Documentation](https://nextjs.org/docs) - Documentação Next.js
- [Mongoose Documentation](https://mongoosejs.com/docs/) - Documentação Mongoose
- [NextAuth.js Documentation](https://next-auth.js.org/) - Documentação NextAuth
- [Asana API Reference](https://developers.asana.com/reference) - API Asana

---

## 📊 Métricas de Documentação

| Área | Cobertura |
|------|-----------|
| Models MongoDB | ✅ 100% (8/8) |
| Diagramas | ✅ 100% (17/17) |
| Features | ✅ 85% |
| APIs | ✅ 100% |
| DevOps | ✅ 100% |

---

*Última atualização: Junho 2025*
