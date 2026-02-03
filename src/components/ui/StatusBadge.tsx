'use client';

import React, { useState, useRef, useEffect } from 'react';

export interface StatusOption {
  value: string;
  label: string;
  color: string;
}

export const DEFAULT_STATUS_OPTIONS: StatusOption[] = [
  { value: 'pending', label: 'Pendente', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  { value: 'in_progress', label: 'Em Andamento', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  { value: 'completed', label: 'Concluída', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  { value: 'cancelled', label: 'Cancelada', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
];

export interface StatusBadgeProps {
  /** Status atual */
  status: string;
  /** Se permite edição inline (mostra dropdown) */
  editable?: boolean;
  /** Callback quando status muda */
  onChange?: (newStatus: string) => void;
  /** Se está carregando (mostra spinner) */
  loading?: boolean;
  /** Opções de status customizadas */
  options?: StatusOption[];
  /** Classes CSS adicionais */
  className?: string;
}

/**
 * Badge de Status com suporte a edição inline via dropdown
 * 
 * @example
 * ```tsx
 * // Somente visualização
 * <StatusBadge status="pending" />
 * 
 * // Editável
 * <StatusBadge 
 *   status={task.status} 
 *   editable 
 *   onChange={(newStatus) => updateTask(task.id, newStatus)}
 *   loading={isUpdating}
 * />
 * ```
 */
export function StatusBadge({
  status,
  editable = false,
  onChange,
  loading = false,
  options = DEFAULT_STATUS_OPTIONS,
  className = '',
}: StatusBadgeProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  const currentOption = options.find(o => o.value === status) || options[0];

  const handleSelect = (value: string) => {
    setShowDropdown(false);
    if (value !== status) {
      onChange?.(value);
    }
  };

  // Badge simples (não editável)
  if (!editable) {
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${currentOption.color} ${className}`}>
        {currentOption.label}
      </span>
    );
  }

  // Badge editável com dropdown
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowDropdown(!showDropdown);
        }}
        disabled={loading}
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium transition-all hover:ring-2 hover:ring-offset-1 hover:ring-gray-300 dark:hover:ring-gray-600 ${currentOption.color} ${className}`}
      >
        {loading ? (
          <div className="w-3 h-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <>
            {currentOption.label}
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </>
        )}
      </button>
      
      {/* Dropdown */}
      {showDropdown && (
        <div 
          className="absolute z-50 mt-1 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1"
          onClick={(e) => e.stopPropagation()}
        >
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 ${
                status === option.value ? 'bg-gray-50 dark:bg-gray-700/50' : ''
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${option.color.split(' ')[0]}`}></span>
              {option.label}
              {status === option.value && (
                <svg className="w-4 h-4 ml-auto text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Helper para obter dados do status
export function getStatusOption(status: string, options: StatusOption[] = DEFAULT_STATUS_OPTIONS): StatusOption {
  return options.find(o => o.value === status) || options[0];
}

export default StatusBadge;
