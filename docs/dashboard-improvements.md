# Dashboard - Melhorias de UI

## Visão Geral

O Dashboard foi aprimorado para oferecer uma visualização mais focada nas tarefas pendentes, com indicadores visuais de sincronização com Asana e ações rápidas de mudança de status.

## Funcionalidades Implementadas

### 1. Filtro de Tarefas Pendentes

O Dashboard agora exibe apenas tarefas com status diferente de `completed`:
- **Pendente** (pending)
- **Em Andamento** (in_progress)
- **Cancelada** (cancelled)

O totalizador mostra a quantidade de tarefas pendentes e, entre parênteses, quantas estão ocultas (concluídas).

```
12 tarefa(s) pendente(s) (3 concluída(s) oculta(s))
```

### 2. Indicadores de Sincronização com Asana

As colunas sincronizadas com Asana possuem indicação visual:

| Coluna | Campo Asana | Indicação |
|--------|-------------|-----------|
| DATA | `start_on` | Fundo azul claro + ícone ℹ️ |
| TÍTULO | `name` | Fundo azul claro + ícone ℹ️ |
| STATUS | `section` | Fundo azul claro + ícone ℹ️ |

Ao passar o mouse sobre o ícone de informação (ℹ️), um tooltip é exibido explicando a sincronização.

### 3. Modal de Visualização

Ao clicar em qualquer linha da tabela, um modal de visualização é aberto com:
- Informações gerais (título, cliente, categoria, status)
- Datas e valores (data de solicitação, entrega, custo, criação)
- Descrição completa
- Observações (se houver)
- Status de sincronização com Asana
- Botão "Editar Tarefa" para abrir o modal de edição

### 4. Dropdown Inline de Status (Cereja do Bolo 🍒)

Ao clicar na badge de status na tabela:
- Um dropdown é exibido com todas as opções de status
- A opção atual é marcada com ✓
- Ao selecionar um novo status, a tarefa é atualizada imediatamente
- A sincronização com Asana ocorre automaticamente (se configurada)
- O dropdown fecha automaticamente ao clicar fora

## Componentes Utilizados

### SyncColumnHeader
```tsx
<SyncColumnHeader isSynced className="...">
  TÍTULO
</SyncColumnHeader>
```

### SyncColumnCell
```tsx
<SyncColumnCell isSynced={task.asanaSynced} className="...">
  {formatDate(task.requestDate)}
</SyncColumnCell>
```

## Fluxo de Dados

```
┌─────────────────────────────────────────────────────────────┐
│                       Dashboard                              │
├─────────────────────────────────────────────────────────────┤
│  loadTasks()                                                 │
│      ↓                                                       │
│  tasks[] → filter(status !== 'completed') → sortedTasks[]    │
│      ↓                                                       │
│  Renderização da tabela                                      │
│      ↓                                                       │
│  [Click linha] → openViewModal() → Modal Visualização        │
│  [Click badge] → Dropdown Status → handleStatusChange()      │
│      ↓                                                       │
│  PUT /api/tasks/{id} → Sync Asana → Refresh UI               │
└─────────────────────────────────────────────────────────────┘
```

## Integração com Asana

Quando o status é alterado via dropdown:
1. A API `PUT /api/tasks/{id}` é chamada
2. Se a tarefa tem `asanaTaskGid`, a sincronização é disparada
3. O status é mapeado para a seção correspondente no Asana:
   - `pending` → "📥 Backlog"
   - `in_progress` → "🚀 Em Progresso"
   - `completed` → "✅ Concluídas"
   - `cancelled` → "❌ Canceladas"

## Notas Técnicas

- O componente usa `useRef` para fechar o dropdown ao clicar fora
- O `useAsanaSyncedData` hook garante atualização automática quando há mudanças vindas do Asana
- O estado `viewingTask` é sincronizado com `tasks` via `useEffect` para refletir atualizações em tempo real

## Changelog

- **v1.0.0** (Data atual)
  - Filtro de tarefas concluídas
  - SyncColumnHeader no header da tabela
  - SyncColumnCell nas células de dados
  - Modal de visualização com detalhes completos
  - Dropdown inline para mudança rápida de status
