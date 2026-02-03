'use client';

import React, { useState, useRef, useEffect } from 'react';

interface SyncColumnHeaderProps {
  /** Texto do cabeçalho da coluna */
  children: React.ReactNode;
  /** Se a coluna é sincronizada com Asana */
  isSynced?: boolean;
  /** Elemento adicional (ex: botão de ordenação) */
  sortButton?: React.ReactNode;
  /** Classes CSS adicionais */
  className?: string;
}

/**
 * Componente para cabeçalhos de colunas que indica se o campo é sincronizado com Asana.
 * 
 * Mostra:
 * - Fundo suave azul para colunas sincronizadas
 * - Ícone de informação (ℹ️) que ao passar o mouse mostra tooltip explicativo
 */
export function SyncColumnHeader({
  children,
  isSynced = false,
  sortButton,
  className = '',
}: SyncColumnHeaderProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const iconRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showTooltip && iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect();
      setTooltipPosition({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX + rect.width / 2,
      });
    }
  }, [showTooltip]);

  // Classes base + cor de fundo para colunas sincronizadas
  const headerClasses = `
    ${className}
    ${isSynced ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}
  `.trim();

  return (
    <th className={headerClasses} style={{ position: 'relative', overflow: 'visible' }}>
      <div className="flex items-center gap-1">
        {sortButton || <span>{children}</span>}
        
        {isSynced && (
          <div 
            ref={iconRef}
            className="relative inline-flex"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            {/* Ícone de informação */}
            <span className="text-blue-400 dark:text-blue-500 cursor-help ml-1" title="Sincronizado com Asana">
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
            
            {/* Tooltip com posicionamento dinâmico */}
            {showTooltip && (
              <div 
                className="fixed z-[9999] min-w-[220px] max-w-[280px] p-3 text-xs font-normal normal-case tracking-normal text-left bg-gray-900 dark:bg-gray-700 text-white rounded-lg shadow-2xl border border-gray-700 dark:border-gray-600"
                style={{
                  top: `${tooltipPosition.top}px`,
                  left: `${tooltipPosition.left}px`,
                  transform: 'translateX(-50%)',
                }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <svg className="w-4 h-4 text-blue-400 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                  </svg>
                  <span className="font-semibold">Sincronizado com Asana</span>
                </div>
                <p className="text-gray-300 dark:text-gray-300 whitespace-normal break-words">
                  Quando marcada para envio a tarefa é sincronizada com o Asana.
                </p>
                {/* Seta do tooltip */}
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 dark:bg-gray-700 rotate-45 border-l border-t border-gray-700 dark:border-gray-600"></div>
              </div>
            )}
          </div>
        )}
      </div>
    </th>
  );
}

/**
 * Wrapper para células de dados em colunas sincronizadas.
 * Aplica fundo suave nas células da coluna.
 */
export function SyncColumnCell({
  children,
  isSynced = false,
  className = '',
}: {
  children: React.ReactNode;
  isSynced?: boolean;
  className?: string;
}) {
  return (
    <td className={`${className} ${isSynced ? 'bg-blue-50/30 dark:bg-blue-950/10' : ''}`}>
      {children}
    </td>
  );
}

export default SyncColumnHeader;
