'use client';

import React from 'react';

export interface TableRowProps {
  children: React.ReactNode;
  /** Handler de clique na linha */
  onClick?: () => void;
  /** Se a linha está selecionada/ativa */
  active?: boolean;
  /** Classes CSS adicionais */
  className?: string;
}

/**
 * Linha da tabela
 * 
 * Suporta:
 * - Clique para ações (ex: abrir modal)
 * - Estado ativo/selecionado
 */
export function TableRow({
  children,
  onClick,
  active = false,
  className = '',
}: TableRowProps) {
  const clickableClasses = onClick ? 'cursor-pointer' : '';
  const activeClasses = active ? 'bg-blue-50 dark:bg-blue-950/30' : '';
  
  return (
    <tr 
      className={`hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors ${clickableClasses} ${activeClasses} ${className}`}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}
