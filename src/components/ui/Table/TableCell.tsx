'use client';

import React from 'react';
import { useTableContext } from './TableContext';

export interface TableCellProps {
  children: React.ReactNode;
  /** Se a célula é de uma coluna sincronizada com Asana */
  synced?: boolean;
  /** Alinhamento do conteúdo */
  align?: 'left' | 'center' | 'right';
  /** Se o conteúdo deve ser truncado */
  truncate?: boolean;
  /** Título para tooltip (usado com truncate) */
  title?: string;
  /** Largura máxima para truncamento */
  maxWidth?: string;
  /** Classes CSS adicionais */
  className?: string;
}

/**
 * Célula da tabela
 * 
 * Suporta:
 * - Background suave para colunas sincronizadas
 * - Truncamento de texto longo
 * - Alinhamento customizado
 */
export function TableCell({
  children,
  synced = false,
  align = 'left',
  truncate = false,
  title,
  maxWidth = 'max-w-xs',
  className = '',
}: TableCellProps) {
  const { density } = useTableContext();
  const isCompact = density === 'compact';
  
  const paddingClasses = isCompact ? 'px-3 py-2.5' : 'px-4 py-4';
  const syncClasses = synced ? 'bg-blue-50/30 dark:bg-blue-950/10' : '';
  
  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  // Usar title fornecido ou inferir do children se for string
  const tooltipTitle = title ?? (typeof children === 'string' ? children : undefined);

  return (
    <td 
      className={`text-sm whitespace-nowrap ${paddingClasses} ${alignClasses[align]} ${syncClasses} ${className}`}
    >
      {truncate ? (
        <div className={`${maxWidth} truncate`} title={tooltipTitle}>
          {children}
        </div>
      ) : (
        children
      )}
    </td>
  );
}
