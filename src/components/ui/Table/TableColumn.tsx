'use client';

import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTableContext } from './TableContext';

export interface TableColumnProps {
  children: React.ReactNode;
  /** Chave para ordenação (se fornecida, coluna é ordenável) */
  sortKey?: string;
  /** Se a coluna é sincronizada com Asana */
  synced?: boolean;
  /** Alinhamento do conteúdo */
  align?: 'left' | 'center' | 'right';
  /** Classes CSS adicionais */
  className?: string;
}

/**
 * Coluna do cabeçalho da tabela
 * 
 * Suporta:
 * - Ordenação via `sortKey`
 * - Indicação de sync com Asana via `synced`
 * - Alinhamento customizado
 */
export function TableColumn({
  children,
  sortKey,
  synced = false,
  align = 'left',
  className = '',
}: TableColumnProps) {
  const { density, sortColumn, sortDirection, onSort } = useTableContext();
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const iconRef = useRef<HTMLSpanElement>(null);
  
  const isCompact = density === 'compact';
  const isSortable = !!sortKey;
  const isActive = sortColumn === sortKey;
  
  const handleMouseEnter = () => {
    if (iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect();
      setTooltipPos({
        top: rect.bottom + 8,
        left: rect.left + rect.width / 2,
      });
    }
    setShowTooltip(true);
  };

  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  const paddingClasses = isCompact ? 'px-3 py-2' : 'px-4 py-3';
  const syncClasses = synced ? 'bg-blue-50/50 dark:bg-blue-950/20' : '';
  
  const renderSortIcon = () => {
    if (!isSortable) return null;
    
    const isAsc = sortDirection === 'asc';
    
    return (
      <div className="flex flex-col ml-1">
        <svg 
          className={`w-3 h-3 ${isActive && isAsc ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'} transition-colors`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
        <svg 
          className={`w-3 h-3 -mt-1 ${isActive && !isAsc ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'} transition-colors`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    );
  };

  const renderSyncIcon = () => {
    if (!synced) return null;
    
    return (
      <>
        <span 
          ref={iconRef}
          className="text-blue-400 dark:text-blue-500 cursor-help ml-1"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <svg 
            className="w-3.5 h-3.5" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
        </span>
        
        {/* Tooltip via Portal */}
        {showTooltip && typeof document !== 'undefined' && createPortal(
          <div 
            className="fixed z-[99999] min-w-[220px] max-w-[280px] p-3 text-xs font-normal normal-case tracking-normal text-left bg-gray-900 dark:bg-gray-700 text-white rounded-lg shadow-2xl border border-gray-700 dark:border-gray-600 pointer-events-none"
            style={{
              top: tooltipPos.top,
              left: tooltipPos.left,
              transform: 'translateX(-50%)',
            }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <svg className="w-4 h-4 text-blue-400 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
              </svg>
              <span className="font-semibold">Sincronizado com Asana</span>
            </div>
            <p className="text-gray-300 whitespace-normal break-words">
              Quando marcada para envio a tarefa é sincronizada com o Asana.
            </p>
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 dark:bg-gray-700 rotate-45 border-l border-t border-gray-700 dark:border-gray-600"></div>
          </div>,
          document.body
        )}
      </>
    );
  };

  const content = (
    <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
      <span>{children}</span>
      {renderSortIcon()}
      {renderSyncIcon()}
    </div>
  );

  return (
    <th 
      className={`whitespace-nowrap ${paddingClasses} ${alignClasses[align]} ${syncClasses} ${className}`}
    >
      {isSortable ? (
        <button
          onClick={() => onSort(sortKey)}
          className="flex items-center gap-1 hover:text-foreground transition-colors"
        >
          {content}
        </button>
      ) : (
        content
      )}
    </th>
  );
}
