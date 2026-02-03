'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

export type SortDirection = 'asc' | 'desc';
export type Density = 'compact' | 'comfortable';

interface TableContextValue {
  density: Density;
  sortColumn: string | null;
  sortDirection: SortDirection;
  onSort: (column: string) => void;
}

const TableContext = createContext<TableContextValue | null>(null);

export function useTableContext() {
  const context = useContext(TableContext);
  if (!context) {
    throw new Error('Table components must be used within a Table');
  }
  return context;
}

interface TableProviderProps {
  children: React.ReactNode;
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
}

export function TableProvider({
  children,
  density = 'comfortable',
  sortColumn: controlledSortColumn,
  sortDirection: controlledSortDirection,
  defaultSortColumn,
  defaultSortDirection = 'desc',
  onSortChange,
}: TableProviderProps) {
  // Modo controlado vs não controlado
  const isControlled = controlledSortColumn !== undefined;
  
  const [uncontrolledSortColumn, setUncontrolledSortColumn] = useState<string | null>(defaultSortColumn ?? null);
  const [uncontrolledSortDirection, setUncontrolledSortDirection] = useState<SortDirection>(defaultSortDirection);

  // Usar valores controlados se fornecidos, caso contrário usar estado interno
  const sortColumn = isControlled ? controlledSortColumn : uncontrolledSortColumn;
  const sortDirection = isControlled ? (controlledSortDirection ?? defaultSortDirection) : uncontrolledSortDirection;

  const onSort = useCallback((column: string) => {
    let newDirection: SortDirection = 'asc';
    
    if (sortColumn === column) {
      newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    }
    
    if (!isControlled) {
      setUncontrolledSortColumn(column);
      setUncontrolledSortDirection(newDirection);
    }
    
    onSortChange?.(column, newDirection);
  }, [sortColumn, sortDirection, isControlled, onSortChange]);

  return (
    <TableContext.Provider value={{ density, sortColumn, sortDirection, onSort }}>
      {children}
    </TableContext.Provider>
  );
}
