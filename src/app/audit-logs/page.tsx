'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { formatDateTime } from '@/lib/utils';
import { useUI } from '@/contexts/UIContext';

interface AuditLog {
  _id: string;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  UPDATE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  READ: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  LOGIN_SUCCESS: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  LOGIN_FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  AUTH_FAILURE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  EXPORT: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  BACKUP_DOWNLOAD: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  BACKUP_RESTORE: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  IMPORT: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
};

export default function AuditLogsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { density, isMobile, isTablet } = useUI();
  const isCompact = density === 'compact';
  const showCards = isMobile || isTablet; // Cards em mobile e tablet até 1024px
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterAction, setFilterAction] = useState('');
  const [filterResource, setFilterResource] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  const userRole = (session?.user as any)?.role || 'user';
  const canViewLogs = userRole === 'rootAdmin' || userRole === 'admin';

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      if (!canViewLogs) {
        router.push('/dashboard');
        return;
      }
      loadLogs();
    }
  }, [status, router, canViewLogs, page, filterAction, filterResource]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: showCards ? '20' : '50',
      });
      
      if (filterAction) params.set('action', filterAction);
      if (filterResource) params.set('resource', filterResource);
      
      const res = await fetch(`/api/audit-logs?${params.toString()}`);
      const data = await res.json();
      setLogs(data.logs || []);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      console.error('Error loading logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action: string) => {
    return ACTION_COLORS[action] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
  };

  const toggleRow = (logId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  const isRowExpanded = (logId: string) => expandedRows.has(logId);

  const clearFilters = () => {
    setFilterAction('');
    setFilterResource('');
    setPage(1);
  };

  const hasActiveFilters = filterAction || filterResource;

  if (status === 'loading' || (loading && logs.length === 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div id="audit-logs-page" className="density-container density-py safe-area-x">
      {/* Header */}
      <header id="audit-logs-header" className="flex flex-col gap-4 density-header-mb">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">
              Logs de Auditoria
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Histórico de ações do sistema
            </p>
          </div>
          
          {/* Botão de filtros mobile */}
          {showCards && (
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`btn-secondary flex items-center gap-2 ${hasActiveFilters ? 'ring-2 ring-blue-500' : ''}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              {hasActiveFilters && (
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              )}
            </button>
          )}
        </div>
        
        {/* Filtros - Desktop sempre visível, Mobile colapsável */}
        <div className={`filters-container flex flex-col sm:flex-row gap-3 ${showCards && !showFilters ? 'hidden' : ''}`}>
          <select
            value={filterAction}
            onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
            className="input-soft w-full sm:w-auto min-h-[44px]"
          >
            <option value="">Todas as ações</option>
            <option value="CREATE">Criar</option>
            <option value="UPDATE">Atualizar</option>
            <option value="DELETE">Excluir</option>
            <option value="READ">Ler</option>
            <option value="LOGIN_SUCCESS">Login Sucesso</option>
            <option value="LOGIN_FAILED">Login Falhou</option>
            <option value="AUTH_FAILURE">Falha de Autenticação</option>
            <option value="EXPORT">Exportar</option>
            <option value="BACKUP_DOWNLOAD">Download de Backup</option>
            <option value="BACKUP_RESTORE">Restaurar Backup</option>
            <option value="IMPORT">Importar</option>
          </select>
          
          <select
            value={filterResource}
            onChange={(e) => { setFilterResource(e.target.value); setPage(1); }}
            className="input-soft w-full sm:w-auto min-h-[44px]"
          >
            <option value="">Todos os recursos</option>
            <option value="TASK">Tarefas</option>
            <option value="CLIENT">Clientes</option>
            <option value="CATEGORY">Categorias</option>
            <option value="USER">Usuários</option>
            <option value="BACKUP">Backups</option>
            <option value="SYSTEM_CONFIG">Configurações</option>
            <option value="AUDIT_LOG">Logs de Auditoria</option>
            <option value="SYSTEM">Sistema</option>
          </select>
          
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="btn-secondary text-red-600 dark:text-red-400 min-h-[44px]"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </header>

      {/* Lista - Desktop: Table, Mobile: Cards */}
      <section id="audit-logs-list">
      {showCards ? (
        /* Mobile/Tablet: Cards */
        <div className="responsive-cards">
          {logs.map((log) => {
            const expanded = isRowExpanded(log._id);
            const detailsText = typeof log.details === 'string' ? log.details : 
                               log.details ? JSON.stringify(log.details, null, 2) : '-';
            const shouldTruncate = detailsText.length > 50;
            
            return (
              <div 
                key={log._id} 
                className="data-card"
                onClick={() => shouldTruncate && toggleRow(log._id)}
              >
                {/* Header do card */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>
                      {typeof log.action === 'string' ? log.action : 'UNKNOWN'}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {log.createdAt ? formatDateTime(log.createdAt) : 'Data desconhecida'}
                  </span>
                </div>
                
                {/* Conteúdo do card */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="text-sm text-foreground truncate">
                      {typeof log.userName === 'string' ? log.userName : 'Usuário desconhecido'}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <span className="text-sm text-muted-foreground">
                      {typeof log.resource === 'string' ? log.resource : 'UNKNOWN'}
                      {log.resourceId && typeof log.resourceId === 'string' && (
                        <span className="ml-1 opacity-60">
                          ({log.resourceId.substring(0, 8)}...)
                        </span>
                      )}
                    </span>
                  </div>
                  
                  {log.ipAddress && (
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                      <span className="text-xs text-muted-foreground">
                        {typeof log.ipAddress === 'string' ? log.ipAddress : '-'}
                      </span>
                    </div>
                  )}
                  
                  {/* Detalhes */}
                  {detailsText !== '-' && (
                    <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                      <p className={`text-xs text-muted-foreground ${expanded ? 'whitespace-pre-wrap break-words' : 'line-clamp-2'}`}>
                        {detailsText}
                      </p>
                      {shouldTruncate && (
                        <button 
                          className="text-xs text-blue-600 dark:text-blue-400 mt-1"
                          onClick={(e) => { e.stopPropagation(); toggleRow(log._id); }}
                        >
                          {expanded ? 'Ver menos' : 'Ver mais'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          
          {logs.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p>Nenhum log encontrado</p>
            </div>
          )}
        </div>
      ) : (
        /* Desktop: Table */
        <div className={`card-soft overflow-hidden ${isCompact ? 'p-3' : 'p-6'}`}>
          <div className="overflow-x-auto">
            <table className="w-full responsive-table">
              <thead>
                <tr className="text-left text-sm text-muted-foreground">
                  <th className={`text-left font-semibold mb-4 text-muted-foreground uppercase tracking-wider ${isCompact ? 'px-3 py-2' : 'px-6 py-3'}`}>Data/Hora</th>
                  <th className={`text-left font-semibold mb-4 text-muted-foreground uppercase tracking-wider ${isCompact ? 'px-3 py-2' : 'px-6 py-3'}`}>Usuário</th>
                  <th className={`text-left font-semibold mb-4 text-muted-foreground uppercase tracking-wider ${isCompact ? 'px-3 py-2' : 'px-6 py-3'}`}>Ação</th>
                  <th className={`text-left font-semibold mb-4 text-muted-foreground uppercase tracking-wider ${isCompact ? 'px-3 py-2' : 'px-6 py-3'}`}>Recurso</th>
                  <th className={`text-left font-semibold mb-4 text-muted-foreground uppercase tracking-wider ${isCompact ? 'px-3 py-2' : 'px-6 py-3'}`}>Detalhes</th>
                  <th className={`text-left font-semibold mb-4 text-muted-foreground uppercase tracking-wider ${isCompact ? 'px-3 py-2' : 'px-6 py-3'}`}>IP</th>
                  <th className={`text-left font-semibold mb-4 text-muted-foreground uppercase tracking-wider ${isCompact ? 'px-3 py-2' : 'px-6 py-3'}`}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {logs.map((log) => {
                  const expanded = isRowExpanded(log._id);
                  const detailsText = typeof log.details === 'string' ? log.details : 
                                     log.details ? JSON.stringify(log.details, null, 2) : '-';
                  const shouldTruncate = detailsText.length > 50;
                  
                  return (
                    <tr key={log._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                      <td className={`${isCompact ? 'px-3 py-1.5' : 'px-4 py-3'} text-sm text-foreground whitespace-nowrap`}>
                        {log.createdAt ? formatDateTime(log.createdAt) : 'Data desconhecida'}
                      </td>
                      <td className={`${isCompact ? 'px-3 py-1.5' : 'px-4 py-3'} text-sm text-muted-foreground`}>
                        {typeof log.userName === 'string' ? log.userName : 'Usuário desconhecido'}
                      </td>
                      <td className={`${isCompact ? 'px-3 py-1.5' : 'px-4 py-3'}`}>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>
                          {typeof log.action === 'string' ? log.action : 'UNKNOWN'}
                        </span>
                      </td>
                      <td className={`${isCompact ? 'px-3 py-1.5' : 'px-4 py-3'} text-sm text-muted-foreground`}>
                        {typeof log.resource === 'string' ? log.resource : 'UNKNOWN'}
                        {log.resourceId && typeof log.resourceId === 'string' && (
                          <span className="text-muted-foreground ml-1">
                            ({log.resourceId.substring(0, 8)}...)
                          </span>
                        )}
                      </td>
                      <td className={`${isCompact ? 'px-3 py-1.5' : 'px-4 py-3'} text-sm text-muted-foreground ${expanded ? '' : 'max-w-xs'}`}>
                        <div className={expanded ? 'whitespace-pre-wrap break-words' : 'truncate'}>
                          {detailsText}
                        </div>
                      </td>
                      <td className={`${isCompact ? 'px-3 py-1.5' : 'px-4 py-3'} text-sm text-muted-foreground`}>
                        {typeof log.ipAddress === 'string' ? log.ipAddress : '-'}
                      </td>
                      <td className={`${isCompact ? 'px-3 py-1.5' : 'px-4 py-3'} text-sm`}>
                        {shouldTruncate && (
                          <button
                            onClick={() => toggleRow(log._id)}
                            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                            title={expanded ? 'Recolher' : 'Expandir'}
                          >
                            {expanded ? '▲' : '▼'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={7} className={`${isCompact ? 'px-3 py-8' : 'px-4 py-12'} text-center text-muted-foreground`}>
                      Nenhum log encontrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </section>
      
      {/* Paginação */}
      {totalPages > 1 && (
        <nav id="audit-logs-pagination" className={`flex items-center justify-between mt-4 ${isCompact ? 'px-3 py-2' : 'px-4 py-3'} card-soft`}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-secondary disabled:opacity-50 min-h-[44px] px-4"
          >
            <span className="hidden sm:inline">Anterior</span>
            <span className="sm:hidden">←</span>
          </button>
          <span className="text-sm text-muted-foreground">
            <span className="hidden sm:inline">Página </span>
            {page} de {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="btn-secondary disabled:opacity-50 min-h-[44px] px-4"
          >
            <span className="hidden sm:inline">Próxima</span>
            <span className="sm:hidden">→</span>
          </button>
        </nav>
      )}
    </div>
  );
}
