'use client';

import { useState, useMemo, useCallback } from 'react';

export type SortDirection = 'asc' | 'desc';

export interface UseTableSortOptions<T> {
  /** Dados a serem ordenados */
  data: T[];
  /** Coluna de ordenação inicial */
  defaultSortColumn?: keyof T | string;
  /** Direção de ordenação inicial */
  defaultSortDirection?: SortDirection;
  /** Função customizada de comparação para uma coluna específica */
  compareFn?: (a: T, b: T, column: keyof T | string, direction: SortDirection) => number;
}

export interface UseTableSortReturn<T> {
  /** Dados ordenados */
  sortedData: T[];
  /** Coluna atual de ordenação */
  sortColumn: keyof T | string | null;
  /** Direção atual de ordenação */
  sortDirection: SortDirection;
  /** Função para mudar ordenação */
  onSort: (column: keyof T | string) => void;
  /** Função para resetar ordenação */
  resetSort: () => void;
}

/**
 * Hook para gerenciar ordenação de tabela
 * 
 * @example
 * ```tsx
 * const { sortedData, sortColumn, sortDirection, onSort } = useTableSort({
 *   data: tasks,
 *   defaultSortColumn: 'requestDate',
 *   defaultSortDirection: 'desc',
 * });
 * ```
 */
export function useTableSort<T extends Record<string, any>>({
  data,
  defaultSortColumn,
  defaultSortDirection = 'desc',
  compareFn,
}: UseTableSortOptions<T>): UseTableSortReturn<T> {
  const [sortColumn, setSortColumn] = useState<keyof T | string | null>(defaultSortColumn ?? null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultSortDirection);

  const onSort = useCallback((column: keyof T | string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  }, [sortColumn]);

  const resetSort = useCallback(() => {
    setSortColumn(defaultSortColumn ?? null);
    setSortDirection(defaultSortDirection);
  }, [defaultSortColumn, defaultSortDirection]);

  const sortedData = useMemo(() => {
    if (!sortColumn) return data;

    return [...data].sort((a, b) => {
      // Se há função customizada, usa ela
      if (compareFn) {
        return compareFn(a, b, sortColumn, sortDirection);
      }

      // Ordenação padrão
      const aValue: unknown = a[sortColumn as keyof T];
      const bValue: unknown = b[sortColumn as keyof T];

      // Tratamento para valores undefined/null
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortDirection === 'asc' ? 1 : -1;
      if (bValue == null) return sortDirection === 'asc' ? -1 : 1;

      // Comparação por tipo
      let comparison = 0;

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        // Verifica se é data ISO
        if (isISODate(aValue) && isISODate(bValue)) {
          comparison = new Date(aValue).getTime() - new Date(bValue).getTime();
        } else {
          comparison = aValue.toLowerCase().localeCompare(bValue.toLowerCase());
        }
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      } else if (aValue instanceof Date && bValue instanceof Date) {
        comparison = aValue.getTime() - bValue.getTime();
      } else {
        comparison = String(aValue).localeCompare(String(bValue));
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [data, sortColumn, sortDirection, compareFn]);

  return {
    sortedData,
    sortColumn,
    sortDirection,
    onSort,
    resetSort,
  };
}

// Helper para detectar strings de data ISO
function isISODate(str: string): boolean {
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;
  return isoDateRegex.test(str);
}

export default useTableSort;
