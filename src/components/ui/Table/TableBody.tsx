'use client';

import React from 'react';
import { useTableContext } from './TableContext';

export interface TableBodyProps {
  children: React.ReactNode;
  /** Mensagem quando não há dados */
  emptyMessage?: string;
  /** Número de colunas (para colspan da mensagem vazia) */
  colSpan?: number;
  className?: string;
}

/**
 * Corpo da tabela - wrapper para as linhas
 */
export function TableBody({ 
  children, 
  emptyMessage = 'Nenhum registro encontrado',
  colSpan = 6,
  className = '',
}: TableBodyProps) {
  const { density } = useTableContext();
  const isCompact = density === 'compact';
  
  // Verifica se há children válidos
  const hasChildren = React.Children.toArray(children).filter(Boolean).length > 0;

  return (
    <tbody className={`divide-y divide-gray-200 dark:divide-gray-700 ${className}`}>
      {hasChildren ? children : (
        <tr>
          <td 
            colSpan={colSpan} 
            className={`px-4 text-center text-muted-foreground ${isCompact ? 'py-8' : 'py-12'}`}
          >
            {emptyMessage}
          </td>
        </tr>
      )}
    </tbody>
  );
}
