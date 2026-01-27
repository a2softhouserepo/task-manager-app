'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';

interface Backup {
  _id: string;
  filename: string;
  size: number;
  type: 'AUTO' | 'MANUAL';
  stats: {
    tasks: number;
    clients: number;
    categories: number;
    users: number;
  };
  createdAt: string;
}

export default function BackupsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status === 'authenticated') {
      if ((session.user as any).role !== 'rootAdmin') {
        router.push('/dashboard');
        return;
      }
      loadBackups();
    } else if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router, session]);

  const loadBackups = async () => {
    try {
      const res = await fetch('/api/backups');
      const data = await res.json();
      if (data.backups) setBackups(data.backups);
    } catch (error) {
      console.error('Erro ao carregar backups:', error);
    } finally {
      setLoading(false);
    }
  };

  const createBackup = async () => {
    setProcessing(true);
    setProcessingAction('create');
    try {
      const res = await fetch('/api/backups', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        await loadBackups();
        alert('✅ Backup criado com sucesso!');
      } else {
        alert('❌ Erro ao criar backup: ' + (data.error || 'Erro desconhecido'));
      }
    } catch (error) {
      alert('❌ Erro ao criar backup');
    } finally {
      setProcessing(false);
      setProcessingAction(null);
    }
  };

  const restoreBackup = async (id: string, filename: string) => {
    if (!confirm(`⚠️ ATENÇÃO: Isso irá substituir TODOS os dados atuais pelos dados do backup "${filename}".\n\nEssa ação é IRREVERSÍVEL!\n\nDeseja continuar?`)) {
      return;
    }

    const promptText = prompt('Para confirmar a restauração, digite "RESTAURAR":');
    if (promptText !== 'RESTAURAR') {
      alert('Restauração cancelada.');
      return;
    }

    setProcessing(true);
    setProcessingAction(`restore-${id}`);
    try {
      const res = await fetch(`/api/backups/${id}/restore`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        alert(`✅ Sistema restaurado com sucesso!\n\nDados restaurados:\n- Tarefas: ${data.stats?.tasks || 0}\n- Clientes: ${data.stats?.clients || 0}\n- Categorias: ${data.stats?.categories || 0}\n\n⚠️ Usuários não são incluídos no backup\n\nA página será recarregada.`);
        window.location.href = '/dashboard';
      } else {
        alert('❌ Erro ao restaurar: ' + (data.error || 'Erro desconhecido'));
      }
    } catch (error) {
      alert('❌ Erro ao restaurar backup');
    } finally {
      setProcessing(false);
      setProcessingAction(null);
    }
  };

  const downloadBackup = async (id: string, filename: string) => {
    try {
      const res = await fetch(`/api/backups/${id}/download`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('❌ Erro ao baixar backup');
      }
    } catch (error) {
      alert('❌ Erro ao baixar backup');
    }
  };

  const deleteBackup = async (id: string, filename: string) => {
    if (!confirm(`Tem certeza que deseja excluir o backup "${filename}"?`)) return;
    
    try {
      const res = await fetch(`/api/backups/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setBackups(backups.filter(b => b._id !== id));
      } else {
        alert('❌ Erro ao excluir backup');
      }
    } catch (error) {
      alert('❌ Erro ao excluir backup');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      alert('❌ Por favor, selecione um arquivo JSON válido.');
      return;
    }

    setProcessing(true);
    setProcessingAction('upload');

    try {
      const content = await file.text();
      
      // Validar se é um JSON válido
      try {
        JSON.parse(content);
      } catch {
        alert('❌ O arquivo não contém um JSON válido.');
        return;
      }

      const res = await fetch('/api/backups/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          data: content,
          filename: file.name 
        }),
      });

      const data = await res.json();
      if (res.ok) {
        await loadBackups();
        alert(`✅ Backup enviado com sucesso!\n\nEstatísticas:\n- Tarefas: ${data.backup?.stats?.tasks || 0}\n- Clientes: ${data.backup?.stats?.clients || 0}\n- Categorias: ${data.backup?.stats?.categories || 0}`);
      } else {
        alert('❌ Erro ao enviar backup: ' + (data.error || 'Erro desconhecido'));
      }
    } catch (error) {
      alert('❌ Erro ao processar arquivo');
    } finally {
      setProcessing(false);
      setProcessingAction(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const clearAllData = async () => {
    if (!confirm('⚠️ PERIGO: Isso irá APAGAR os seguintes dados do sistema:\n\n- Todas as Tarefas\n- Todos os Clientes\n- Todas as Categorias\n\n⚠️ Os USUÁRIOS serão PRESERVADOS\n\nEssa ação é IRREVERSÍVEL!\n\nDeseja continuar?')) {
      return;
    }

    const promptText = prompt('Para confirmar a exclusão TOTAL, digite "APAGAR TUDO":');
    if (promptText !== 'APAGAR TUDO') {
      alert('Operação cancelada.');
      return;
    }

    setProcessing(true);
    setProcessingAction('clear');
    try {
      const res = await fetch('/api/backups', { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        alert(`✅ Dados removidos com sucesso!\n\nItens excluídos:\n- Tarefas: ${data.deleted?.tasks || 0}\n- Clientes: ${data.deleted?.clients || 0}\n- Categorias: ${data.deleted?.categories || 0}\n\n✅ Usuários foram PRESERVADOS\n\nVocê será redirecionado para o dashboard.`);
        window.location.href = '/dashboard';
      } else {
        alert('❌ Erro ao limpar dados: ' + (data.error || 'Erro desconhecido'));
      }
    } catch (error) {
      alert('❌ Erro ao limpar dados');
    } finally {
      setProcessing(false);
      setProcessingAction(null);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="density-container density-py">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 density-header-mb">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
              <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
            </div>
            Backup & Restauração
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie snapshots do sistema para segurança dos dados
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {/* Botão Upload */}
          <input
            type="file"
            ref={fileInputRef}
            accept=".json"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={processing}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {processingAction === 'upload' ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            )}
            Upload Backup
          </button>

          {/* Botão Criar Backup */}
          <button
            onClick={createBackup}
            disabled={processing}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {processingAction === 'create' ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            )}
            Novo Backup Manual
          </button>
        </div>
      </div>

      {/* Aviso */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="font-medium text-yellow-800 dark:text-yellow-200">📦 O que está incluído no Backup</p>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-2">
              Cada backup contém os dados das seguintes tabelas:
            </p>
            <ul className="text-sm text-yellow-700 dark:text-yellow-300 mt-2 space-y-1 ml-4">
              <li className="flex items-center gap-2">
                <span>📋</span>
                <span><strong>Tarefas</strong> - Todos os registros de tarefas e suas informações</span>
              </li>
              <li className="flex items-center gap-2">
                <span>👥</span>
                <span><strong>Clientes</strong> - Todos os clientes cadastrados</span>
              </li>
              <li className="flex items-center gap-2">
                <span>🏷️</span>
                <span><strong>Categorias</strong> - Todas as categorias de tarefas</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Tabela de Backups */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-zinc-800/50 border-b border-gray-200 dark:border-zinc-700">
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Arquivo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Tamanho</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Estatísticas</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Data</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-zinc-700">
              {backups.map((backup) => (
                <tr key={backup._id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/30 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-100 dark:bg-zinc-800 rounded-lg">
                        <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <span className="text-sm font-medium text-foreground">{backup.filename}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      backup.type === 'AUTO' 
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                    }`}>
                      {backup.type === 'AUTO' ? '🔄 Automático' : '✋ Manual'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    {formatBytes(backup.size)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex gap-2 text-xs">
                      <span className="px-2 py-1 bg-gray-100 dark:bg-zinc-800 rounded" title="Tarefas">
                        📋 {backup.stats?.tasks || 0}
                      </span>
                      <span className="px-2 py-1 bg-gray-100 dark:bg-zinc-800 rounded" title="Clientes">
                        👥 {backup.stats?.clients || 0}
                      </span>
                      <span className="px-2 py-1 bg-gray-100 dark:bg-zinc-800 rounded" title="Categorias">
                        🏷️ {backup.stats?.categories || 0}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    {formatDate(backup.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <div className="flex items-center justify-end gap-2">
                      {/* Download */}
                      <button
                        onClick={() => downloadBackup(backup._id, backup.filename)}
                        className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 dark:text-gray-400 dark:hover:text-blue-400 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        title="Baixar backup"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </button>
                      
                      {/* Restaurar */}
                      <button
                        onClick={() => restoreBackup(backup._id, backup.filename)}
                        disabled={processing}
                        className="p-2 text-gray-600 hover:text-yellow-600 hover:bg-yellow-50 dark:text-gray-400 dark:hover:text-yellow-400 dark:hover:bg-yellow-900/20 rounded-lg transition-colors disabled:opacity-50"
                        title="Restaurar este backup"
                      >
                        {processingAction === `restore-${backup._id}` ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-yellow-600 border-t-transparent"></div>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        )}
                      </button>
                      
                      {/* Excluir */}
                      <button
                        onClick={() => deleteBackup(backup._id, backup.filename)}
                        className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Excluir backup"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {backups.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-4 bg-gray-100 dark:bg-zinc-800 rounded-full">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                        </svg>
                      </div>
                      <p className="text-muted-foreground">Nenhum backup encontrado</p>
                      <p className="text-sm text-muted-foreground">Clique em "Novo Backup Manual" para criar o primeiro backup.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Área de Perigo */}
      <div className="mt-8 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-red-800 dark:text-red-400 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Zona de Perigo
        </h2>
        <p className="text-red-700 dark:text-red-300 text-sm mt-2 mb-4">
          As ações abaixo são irreversíveis. Use apenas para testes ou quando absolutamente necessário.
        </p>
        
        {/* Informações sobre tabelas a serem limpas */}
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 rounded-lg border border-red-300 dark:border-red-800">
          <p className="text-xs font-medium text-red-800 dark:text-red-200 mb-2">📋 Tabelas que serão limpas:</p>
          <ul className="text-xs text-red-700 dark:text-red-300 space-y-1">
            <li className="flex items-center gap-2">
              <span className="text-red-600 dark:text-red-400">•</span>
              <span><strong>Tarefas</strong> - Todos os registros de tarefas serão removidos</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-red-600 dark:text-red-400">•</span>
              <span><strong>Clientes</strong> - Todos os clientes cadastrados serão removidos</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-red-600 dark:text-red-400\">•</span>
              <span><strong>Categorias</strong> - Todas as categorias serão removidas</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-red-600 dark:text-red-400">•</span>
              <span><strong>Usuários são preservados</strong> - Os usuários do sistema não serão afetados</span>
            </li>
          </ul>
        </div>
        
        <button
          onClick={clearAllData}
          disabled={processing}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          {processingAction === 'clear' ? (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          )}
          Limpar Todos os Dados
        </button>
      </div>
    </div>
  );
}
