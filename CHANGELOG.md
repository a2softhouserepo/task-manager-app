# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Não Publicado]

### A Fazer (Nível 2)
- [ ] Correções de bugs identificados
- [ ] Novas funcionalidades planejadas
- [ ] Melhorias de performance

---

## [1.0.0] - 2025-06

### Adicionado
- **Sistema de Tarefas**: CRUD completo com filtros por mês, cliente, categoria e status
- **Dashboard**: Gráficos de faturamento mensal e top clientes usando Recharts
- **Clientes com Hierarquia**: Suporte a subclientes usando padrão Materialized Path
- **Categorias**: CRUD com ícones emoji e cores personalizadas
- **Usuários**: 3 níveis de permissão (user, admin, rootAdmin)
- **Autenticação**: JWT com NextAuth.js, cookies HTTP-only, rate limiting
- **Criptografia**: AES-256-GCM para dados sensíveis com blind indexes
- **Audit Logs**: Registro completo de todas as ações do sistema
- **Integração Asana**: Sincronização bidirecional via webhooks
- **Backups**: Sistema automático com backup no login de rootAdmin
- **Exportação PDF**: Relatórios com filtros aplicados usando jsPDF
- **Modo Manutenção**: Bloqueio de acesso para usuários comuns
- **Timeout de Sessão**: Configurável via interface administrativa
- **Bloqueio de Login**: Proteção contra brute-force attacks

### Segurança
- Senhas hasheadas com bcrypt (10 rounds)
- Rate limiting por IP (5 tentativas/minuto)
- Bloqueio temporário após tentativas falhas
- CSRF protection via NextAuth
- Audit logging de ações críticas

### Performance
- Aggregation Pipeline com $facet para estatísticas
- LRU Cache para contagens de documentos
- Debouncing de 300ms em filtros
- Lazy loading de componentes Recharts
- Índices MongoDB otimizados

### Documentação
- 17 diagramas Mermaid cobrindo arquitetura e fluxos
- Documentação técnica de todos os subsistemas
- Scripts de seed e clear para desenvolvimento

---

## [0.1.0] - 2025-05 (Desenvolvimento Inicial)

### Adicionado
- Setup inicial do projeto Next.js 16
- Estrutura básica de pastas e configurações
- Modelos MongoDB com Mongoose
- Configuração de Tailwind CSS

---

## Tipos de Mudanças

- **Adicionado** para novas funcionalidades.
- **Modificado** para mudanças em funcionalidades existentes.
- **Obsoleto** para funcionalidades que serão removidas em breve.
- **Removido** para funcionalidades removidas.
- **Corrigido** para correções de bugs.
- **Segurança** para vulnerabilidades corrigidas.
- **Performance** para melhorias de performance.
- **Documentação** para mudanças na documentação.
