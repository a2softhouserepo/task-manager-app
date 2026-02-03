'use client';

// Componentes principais
export { Table } from './Table';
export { TableHeader } from './TableHeader';
export { TableColumn } from './TableColumn';
export { TableBody } from './TableBody';
export { TableRow } from './TableRow';
export { TableCell } from './TableCell';

// Context e tipos
export { TableProvider, useTableContext } from './TableContext';
export type { SortDirection, Density } from './TableContext';

// Props types
export type { TableProps } from './Table';
export type { TableHeaderProps } from './TableHeader';
export type { TableColumnProps } from './TableColumn';
export type { TableBodyProps } from './TableBody';
export type { TableRowProps } from './TableRow';
export type { TableCellProps } from './TableCell';

// Compound Component Pattern - re-export with attached sub-components
import { Table as TableRoot } from './Table';
import { TableHeader } from './TableHeader';
import { TableColumn } from './TableColumn';
import { TableBody } from './TableBody';
import { TableRow } from './TableRow';
import { TableCell } from './TableCell';

/**
 * Componente de Tabela usando Composition Pattern
 * 
 * @example
 * ```tsx
 * import { DataTable } from '@/components/ui/Table';
 * 
 * <DataTable density="compact" defaultSortColumn="date">
 *   <DataTable.Header>
 *     <DataTable.Column sortKey="date" synced>DATA</DataTable.Column>
 *     <DataTable.Column>NOME</DataTable.Column>
 *     <DataTable.Column align="right">AÇÕES</DataTable.Column>
 *   </DataTable.Header>
 *   <DataTable.Body emptyMessage="Nenhum item" colSpan={3}>
 *     {items.map(item => (
 *       <DataTable.Row key={item.id} onClick={() => select(item)}>
 *         <DataTable.Cell synced>{item.date}</DataTable.Cell>
 *         <DataTable.Cell truncate>{item.name}</DataTable.Cell>
 *         <DataTable.Cell align="right">
 *           <button>Editar</button>
 *         </DataTable.Cell>
 *       </DataTable.Row>
 *     ))}
 *   </DataTable.Body>
 * </DataTable>
 * ```
 */
export const DataTable = Object.assign(TableRoot, {
  Header: TableHeader,
  Column: TableColumn,
  Body: TableBody,
  Row: TableRow,
  Cell: TableCell,
});

export default DataTable;
