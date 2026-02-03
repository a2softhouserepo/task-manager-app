# DataTable Component

Componente de tabela reutilizável utilizando **Composition Pattern** para máxima flexibilidade.

## Estrutura de Arquivos

```
src/
├── components/
│   └── ui/
│       ├── Table/
│       │   ├── index.tsx          # Export principal (DataTable)
│       │   ├── TableContext.tsx   # Context para estado compartilhado
│       │   ├── Table.tsx          # Componente raiz
│       │   ├── TableHeader.tsx    # Wrapper do <thead>
│       │   ├── TableColumn.tsx    # Coluna do cabeçalho (com ordenação)
│       │   ├── TableBody.tsx      # Wrapper do <tbody>
│       │   ├── TableRow.tsx       # Linha da tabela
│       │   └── TableCell.tsx      # Célula de dados
│       └── StatusBadge.tsx        # Badge de status editável
└── hooks/
    └── useTableSort.ts            # Hook de ordenação standalone
```

## Uso Básico

```tsx
import { DataTable } from '@/components/ui/Table';
import { StatusBadge } from '@/components/ui/StatusBadge';

function TaskList({ tasks }) {
  return (
    <DataTable density="compact" defaultSortColumn="requestDate" defaultSortDirection="desc">
      <DataTable.Header>
        <DataTable.Column sortKey="requestDate" synced>DATA</DataTable.Column>
        <DataTable.Column>CATEGORIA</DataTable.Column>
        <DataTable.Column>CLIENTE</DataTable.Column>
        <DataTable.Column synced>TÍTULO</DataTable.Column>
        <DataTable.Column synced>STATUS</DataTable.Column>
        <DataTable.Column align="right">AÇÕES</DataTable.Column>
      </DataTable.Header>
      <DataTable.Body emptyMessage="Nenhuma tarefa encontrada" colSpan={6}>
        {tasks.map((task) => (
          <DataTable.Row key={task._id} onClick={() => viewTask(task)}>
            <DataTable.Cell synced={task.asanaSynced}>
              {formatDate(task.requestDate)}
            </DataTable.Cell>
            <DataTable.Cell>{task.categoryName}</DataTable.Cell>
            <DataTable.Cell truncate title={task.clientName}>
              {task.clientName}
            </DataTable.Cell>
            <DataTable.Cell synced={task.asanaSynced} truncate title={task.title}>
              {task.title}
            </DataTable.Cell>
            <DataTable.Cell synced={task.asanaSynced}>
              <StatusBadge 
                status={task.status} 
                editable 
                onChange={(newStatus) => updateStatus(task._id, newStatus)}
              />
            </DataTable.Cell>
            <DataTable.Cell align="right">
              <button onClick={(e) => { e.stopPropagation(); edit(task); }}>
                Editar
              </button>
            </DataTable.Cell>
          </DataTable.Row>
        ))}
      </DataTable.Body>
    </DataTable>
  );
}
```

## Modos de Ordenação

### Modo Não Controlado (Estado Interno)

O componente gerencia seu próprio estado de ordenação:

```tsx
<DataTable 
  defaultSortColumn="requestDate"
  defaultSortDirection="desc"
  onSortChange={(column, direction) => {
    // Opcional: reagir à mudança de ordenação
    console.log('Ordenação mudou:', column, direction);
  }}
>
  ...
</DataTable>
```

### Modo Controlado (Estado Externo)

Você controla o estado de ordenação externamente:

```tsx
const [sortColumn, setSortColumn] = useState('requestDate');
const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

<DataTable 
  sortColumn={sortColumn}
  sortDirection={sortDirection}
  onSortChange={(column, direction) => {
    setSortColumn(column);
    setSortDirection(direction);
  }}
>
  ...
</DataTable>
```

## Props dos Componentes

### DataTable (Table)

| Prop | Tipo | Default | Descrição |
|------|------|---------|-----------|
| `density` | `'compact' \| 'comfortable'` | `'comfortable'` | Densidade visual |
| `sortColumn` | `string` | - | Coluna ordenada (modo controlado) |
| `sortDirection` | `'asc' \| 'desc'` | - | Direção (modo controlado) |
| `defaultSortColumn` | `string` | - | Coluna inicial (modo não controlado) |
| `defaultSortDirection` | `'asc' \| 'desc'` | `'desc'` | Direção inicial |
| `onSortChange` | `(column, direction) => void` | - | Callback de mudança |
| `className` | `string` | - | Classes CSS adicionais |

### DataTable.Column (TableColumn)

| Prop | Tipo | Default | Descrição |
|------|------|---------|-----------|
| `sortKey` | `string` | - | Chave para ordenação (torna coluna clicável) |
| `synced` | `boolean` | `false` | Mostra indicador de sincronização Asana |
| `align` | `'left' \| 'center' \| 'right'` | `'left'` | Alinhamento |
| `className` | `string` | - | Classes CSS adicionais |

### DataTable.Cell (TableCell)

| Prop | Tipo | Default | Descrição |
|------|------|---------|-----------|
| `synced` | `boolean` | `false` | Background azul suave quando sincronizado |
| `truncate` | `boolean` | `false` | Truncar texto longo |
| `title` | `string` | - | Tooltip para texto truncado |
| `maxWidth` | `string` | `'max-w-xs'` | Largura máxima para truncamento |
| `align` | `'left' \| 'center' \| 'right'` | `'left'` | Alinhamento |
| `className` | `string` | - | Classes CSS adicionais |

### DataTable.Row (TableRow)

| Prop | Tipo | Default | Descrição |
|------|------|---------|-----------|
| `onClick` | `() => void` | - | Callback de clique (torna linha clicável) |
| `className` | `string` | - | Classes CSS adicionais |

### DataTable.Body (TableBody)

| Prop | Tipo | Default | Descrição |
|------|------|---------|-----------|
| `emptyMessage` | `string` | `'Nenhum item encontrado'` | Mensagem quando vazio |
| `colSpan` | `number` | `1` | Colspan para mensagem vazia |

## StatusBadge

Badge de status com suporte a edição inline:

```tsx
// Somente visualização
<StatusBadge status="pending" />

// Editável
<StatusBadge 
  status={task.status} 
  editable 
  loading={isUpdating}
  onChange={(newStatus) => updateTask(task.id, newStatus)}
/>

// Opções customizadas
<StatusBadge 
  status={task.status} 
  editable 
  options={[
    { value: 'active', label: 'Ativo', color: 'bg-green-100 text-green-800' },
    { value: 'inactive', label: 'Inativo', color: 'bg-gray-100 text-gray-800' },
  ]}
  onChange={handleChange}
/>
```

### Props StatusBadge

| Prop | Tipo | Default | Descrição |
|------|------|---------|-----------|
| `status` | `string` | - | Status atual (obrigatório) |
| `editable` | `boolean` | `false` | Habilita dropdown de edição |
| `onChange` | `(status) => void` | - | Callback quando status muda |
| `loading` | `boolean` | `false` | Mostra spinner |
| `options` | `StatusOption[]` | `DEFAULT_STATUS_OPTIONS` | Opções de status |
| `className` | `string` | - | Classes CSS adicionais |

## Hook useTableSort

Para casos onde você quer usar a lógica de ordenação sem o componente visual:

```tsx
import { useTableSort } from '@/hooks/useTableSort';

const { sortedData, sortColumn, sortDirection, onSort, resetSort } = useTableSort({
  data: tasks,
  defaultSortColumn: 'requestDate',
  defaultSortDirection: 'desc',
});
```

### Recursos do Hook

- **Auto-detecção de tipos**: Strings, números, datas ISO
- **Tratamento de null/undefined**: Valores nulos vão para o final
- **Função de comparação customizada**: Para ordenação complexa

```tsx
const { sortedData } = useTableSort({
  data: tasks,
  compareFn: (a, b, column, direction) => {
    // Lógica customizada
    return 0;
  },
});
```

## Indicador de Sincronização Asana

Colunas e células podem mostrar um indicador visual de sincronização com Asana:

- **Coluna**: Adicione `synced` para mostrar o ícone de link no header
- **Célula**: Adicione `synced={item.asanaSynced}` para background azul suave

O tooltip do header explica o significado da sincronização.

## Migração de Tabelas Existentes

Para migrar uma tabela existente:

1. Importe os componentes:
```tsx
import { DataTable } from '@/components/ui/Table';
import { StatusBadge } from '@/components/ui/StatusBadge';
```

2. Substitua `<table>` por `<DataTable>`:
```tsx
// Antes
<div className="overflow-x-auto">
  <table className="w-full">
    <thead>...</thead>
    <tbody>...</tbody>
  </table>
</div>

// Depois
<DataTable density={density}>
  <DataTable.Header>...</DataTable.Header>
  <DataTable.Body>...</DataTable.Body>
</DataTable>
```

3. Remova código de ordenação manual - o componente gerencia isso internamente.

4. Use `StatusBadge` para status editáveis - remove a necessidade de dropdown manual.

## Densidade Visual

O componente suporta duas densidades que afetam o padding:

- **`comfortable`** (default): Padding maior para melhor legibilidade
- **`compact`**: Padding reduzido para mais dados visíveis

A densidade é propagada via Context para todos os componentes filhos.
