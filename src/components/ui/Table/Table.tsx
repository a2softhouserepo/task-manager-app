'use client';

import React from 'react';
import { TableProvider, Density, SortDirection } from './TableContext';

export interface TableProps {
  children: React.ReactNode;
  /** Densidade visual da tabela */
  density?: Density;
  /** Coluna ordenada atual (modo controlado) */
  sortColumn?: string;
  /** Direção de ordenação atual (modo controlado) */
  sortDirection?: SortDirection;
  /** Coluna de ordenação inicial (modo não controlado) */
  defaultSortColumn?: string;
  /** Direção de ordenação inicial (modo não controlado) */
  defaultSortDirection?: SortDirection;
  /** Callback quando ordenação muda */
  onSortChange?: (column: string, direction: SortDirection) => void;
  /** Classes CSS adicionais */
  className?: string;
}

/**
 * Componente Table principal - wrapper que provê contexto para componentes filhos
 * 
 * Suporta dois modos:
 * - Modo não controlado: use defaultSortColumn/defaultSortDirection
 * - Modo controlado: use sortColumn/sortDirection com onSortChange
 * 
 * @example
 * ```tsx
 * // Modo não controlado
 * <Table density="compact" defaultSortColumn="date" defaultSortDirection="desc">
 *   <Table.Header>...</Table.Header>
 *   <Table.Body>...</Table.Body>
 * </Table>
 * 
 * // Modo controlado
 * <Table 
 *   density="compact" 
 *   sortColumn={sortColumn} 
 *   sortDirection={sortDirection}
 *   onSortChange={(col, dir) => { setSortColumn(col); setSortDirection(dir); }}
 * >
 *   ...
 * </Table>
 * ```
 */
export function Table({
  children,
  density = 'comfortable',
  sortColumn,
  sortDirection,
  defaultSortColumn,
  defaultSortDirection = 'desc',
  onSortChange,
  className = '',
}: TableProps) {
  return (
    <TableProvider
      density={density}
      sortColumn={sortColumn}
      sortDirection={sortDirection}
      defaultSortColumn={defaultSortColumn}
      defaultSortDirection={defaultSortDirection}
      onSortChange={onSortChange}
    >
      <div className="overflow-x-auto">
        <table className={`w-full min-w-[800px] ${className}`}>
          {children}
        </table>
      </div>
    </TableProvider>
  );
}
