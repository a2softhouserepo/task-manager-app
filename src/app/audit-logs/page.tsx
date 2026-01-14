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
  LOGIN: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  LOGOUT: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  VIEW: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  EXPORT: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
};

export default function AuditLogsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { isCompact } = useUI();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterAction, setFilterAction] = useState('');
  const [filterResource, setFilterResource] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

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
        limit: '50',
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

  if (status === 'loading' || (loading && logs.length === 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${isCompact ? 'py-4' : 'py-8'}`}>
      {/* Header */}
        <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between ${isCompact ? 'mb-3' : 'mb-8'}`}>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Logs de Auditoria
            </h1>
            <p className="text-muted-foreground">
              Histórico de ações do sistema
            </p>
          </div>
          
          <div className="mt-4 sm:mt-0 flex gap-3">
            <select
              value={filterAction}
              onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
              className="input-soft !w-auto"
            >
              <option value="">Todas as ações</option>
              <option value="CREATE">Criar</option>
              <option value="UPDATE">Atualizar</option>
              <option value="DELETE">Excluir</option>
              <option value="LOGIN">Login</option>
              <option value="LOGOUT">Logout</option>
              <option value="VIEW">Visualizar</option>
              <option value="EXPORT">Exportar</option>
            </select>
            
            <select
              value={filterResource}
              onChange={(e) => { setFilterResource(e.target.value); setPage(1); }}
              className="input-soft !w-auto"
            >
              <option value="">Todos os recursos</option>
              <option value="Task">Tarefas</option>
              <option value="Client">Clientes</option>
              <option value="Category">Categorias</option>
              <option value="User">Usuários</option>
              <option value="Session">Sessões</option>
            </select>
          </div>
        </div>

        {/* Lista */}
        <div className={`card-soft overflow-hidden ${isCompact ? 'p-3' : 'p-6'}`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="">
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
          
          {/* Paginação */}
          {totalPages > 1 && (
            <div className={`flex items-center justify-between ${isCompact ? 'px-3 py-2' : 'px-4 py-3'} border-t border-gray-200 dark:border-gray-700`}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary disabled:opacity-50"
              >
                Anterior
              </button>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Página {page} de {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-secondary disabled:opacity-50"
              >
                Próxima
              </button>
            </div>
          )}
        </div>
      </div>
  );
}
