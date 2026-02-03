'use client';

import React from 'react';

export interface TableHeaderProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Cabeçalho da tabela - wrapper para as colunas
 */
export function TableHeader({ children, className = '' }: TableHeaderProps) {
  return (
    <thead className={className}>
      <tr className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {children}
      </tr>
    </thead>
  );
}
