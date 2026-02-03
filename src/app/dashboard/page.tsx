'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import dynamic from 'next/dynamic';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useUI } from '@/contexts/UIContext';
import { useAsanaSyncedData } from '@/contexts/AsanaSyncContext';
import { getChartColors } from '@/lib/chartColors';
import TaskModal from '@/components/TaskModal';
import Modal from '@/components/Modal';
import { DataTable } from '@/components/ui/Table';
import { StatusBadge } from '@/components/ui/StatusBadge';

// Importação síncrona dos componentes do PieChart (Cell não funciona com lazy load)
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer as PieResponsiveContainer,
  Tooltip as PieTooltip,
} from 'recharts';

/**
 * OTIMIZAÇÃO: Lazy load de Recharts (apenas BarChart)
 * Reduz bundle inicial, carregando apenas quando necessário
 */
const BarChart = dynamic(() => import('recharts').then(m => m.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then(m => m.Bar), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then(m => m.CartesianGrid), { ssr: false });
const RechartsTooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false });
const RechartsLegend = dynamic(() => import('recharts').then(m => m.Legend), { ssr: false });

interface Task {
  _id: string;
  requestDate: string;
  clientId: string;
  clientName: string;
  rootClientName?: string;
  subClientLevels?: string[];
  categoryId: string;
  categoryName: string;
  categoryIcon?: string;
  categoryColor?: string;
  title: string;
  description: string;
  deliveryDate?: string;
  cost: number;
  observations?: string;
  status: string;
  asanaSynced?: boolean;
  asanaTaskGid?: string;
  createdAt: string;
}

interface Client {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  parentId?: string | null;
  path?: string[];
  depth?: number;
  children?: Client[];
}

interface Category {
  _id: string;
  name: string;
  icon: string;
  color: string;
}

interface Stats {
  currentMonth: { total: number; count: number };
  allTime: { total: number; count: number };
  monthlyData: { month: string; monthKey: string; total: number; count: number }[];
  clientStats: { _id: string; clientName: string; total: number; count: number }[];
  categoryStats: { _id: string; categoryName: string; total: number; count: number }[];
  statusStats: { _id: string; count: number; total: number }[];
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { density, resolvedTheme } = useUI();
  const isCompact = density === 'compact';
  const chartColors = getChartColors(resolvedTheme || 'light');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsTree, setClientsTree] = useState<Client[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Filtros
  const [filterClientId, setFilterClientId] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState('');

  // Ordenação
  const [sortColumn, setSortColumn] = useState<'requestDate' | 'deliveryDate' | 'cost'>('requestDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Modal de nova tarefa
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  
  // Modal de visualização
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  
  // Status update loading
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  const userRole = (session?.user as any)?.role || 'user';
  const userId = (session?.user as any)?.id;
  const canDelete = userRole === 'rootAdmin';

  // Função de carregamento de tasks (declarada primeiro para uso em useAsanaSyncedData)
  const loadTasks = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      
      // Buscar TODAS as tarefas sem filtro de data
      params.set('noDateFilter', 'true');
      
      if (filterClientId) params.set('clientId', filterClientId);
      if (filterCategoryId) params.set('categoryId', filterCategoryId);
      
      const res = await fetch(`/api/tasks?${params.toString()}`);
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  }, [filterClientId, filterCategoryId]);

  // Integração com AsanaSyncContext - recarrega tasks automaticamente quando há atualizações do Asana
  useAsanaSyncedData(loadTasks);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      loadData();
    }
  }, [status, router]);

  /**
   * OTIMIZAÇÃO: Debouncing de 300ms para evitar múltiplas requests
   * durante mudanças rápidas de filtros
   */
  const debouncedLoadTasks = useDebouncedCallback(
    () => {
      if (status === 'authenticated') {
        loadTasks();
      }
    },
    300
  );

  useEffect(() => {
    debouncedLoadTasks();
  }, [filterClientId, filterCategoryId]);

  const loadData = async () => {
    try {
      const [clientsRes, clientsTreeRes, categoriesRes, statsRes] = await Promise.all([
        fetch('/api/clients?active=true'),
        fetch('/api/clients?active=true&tree=true'),
        fetch('/api/categories?active=true'),
        fetch('/api/tasks/stats'),
      ]);
      
      const [clientsData, clientsTreeData, categoriesData, statsData] = await Promise.all([
        clientsRes.json(),
        clientsTreeRes.json(),
        categoriesRes.json(),
        statsRes.json(),
      ]);
      
      setClients(clientsData.clients || []);
      setClientsTree(clientsTreeData.clients || []);
      setCategories(categoriesData.categories || []);
      setStats(statsData);
      
      await loadTasks();
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * OTIMIZAÇÃO: useMemo para evitar recálculos desnecessários da ordenação
   * FILTRO: Exclui tarefas concluídas e canceladas para mostrar apenas ativas no Dashboard
   */
  const sortedTasks = useMemo(() => {
    // Filtrar tarefas ativas (não concluídas nem canceladas)
    const activeTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
    
    return [...activeTasks].sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortColumn) {
        case 'requestDate':
          aValue = new Date(a.requestDate).getTime();
          bValue = new Date(b.requestDate).getTime();
          break;
        case 'deliveryDate':
          aValue = a.deliveryDate ? new Date(a.deliveryDate).getTime() : 0;
          bValue = b.deliveryDate ? new Date(b.deliveryDate).getTime() : 0;
          break;
        case 'cost':
          aValue = a.cost;
          bValue = b.cost;
          break;
        default:
          return 0;
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });
  }, [tasks, sortColumn, sortDirection]);

  /**
   * OTIMIZAÇÃO: Memoização dos dados dos charts
   * Evita recálculos em cada re-render
   */
  const barChartData = useMemo(() => {
    return (stats?.monthlyData || []).map(d => ({
      name: d.month,
      total: d.total,
      count: d.count
    }));
  }, [stats?.monthlyData]);

  const pieChartClientData = useMemo(() => {
    return (stats?.clientStats || []).map((c, index) => ({
      name: c.clientName,
      value: c.total,
      color: COLORS[index % COLORS.length]
    }));
  }, [stats?.clientStats]);

  const pieChartCategoryData = useMemo(() => {
    return (stats?.categoryStats || []).map((c, index) => ({
      name: c.categoryName,
      value: c.total,
      color: COLORS[index % COLORS.length]
    }));
  }, [stats?.categoryStats]);

  // Função para construir opções hierárquicas de clientes
  const buildClientOptions = (clientList: Client[], level: number = 0): React.ReactElement[] => {
    const options: React.ReactElement[] = [];
    
    clientList.forEach(client => {
      const prefix = '—'.repeat(level);
      options.push(
        <option key={client._id} value={client._id}>
          {prefix}{prefix ? ' ' : ''}{client.name}
        </option>
      );
      
      if (client.children && client.children.length > 0) {
        options.push(...buildClientOptions(client.children, level + 1));
      }
    });
    
    return options;
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setShowTaskModal(true);
  };

  const openNewModal = () => {
    setEditingTask(null);
    setShowTaskModal(true);
  };

  const openViewModal = (task: Task) => {
    setViewingTask(task);
    setShowViewModal(true);
  };

  // Sync viewingTask with tasks list when it's updated (e.g., via Asana webhook)
  useEffect(() => {
    if (viewingTask && showViewModal) {
      const updatedTask = tasks.find(t => t._id === viewingTask._id);
      if (updatedTask) {
        const hasChanged = 
          updatedTask.title !== viewingTask.title ||
          updatedTask.description !== viewingTask.description ||
          updatedTask.status !== viewingTask.status ||
          updatedTask.deliveryDate !== viewingTask.deliveryDate ||
          updatedTask.cost !== viewingTask.cost;
        
        if (hasChanged) {
          console.log('[DASHBOARD] Task updated, refreshing modal view');
          setViewingTask(updatedTask);
        }
      }
    }
  }, [tasks, viewingTask, showViewModal]);

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    setUpdatingStatus(taskId);
    
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      
      if (res.ok) {
        // Atualizar lista de tasks
        loadTasks();
        // Recarregar stats
        const statsRes = await fetch('/api/tasks/stats');
        const statsData = await statsRes.json();
        setStats(statsData);
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao atualizar status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Erro ao atualizar status');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleTaskModalClose = () => {
    setShowTaskModal(false);
    setEditingTask(null);
  };

  const handleTaskModalSuccess = () => {
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta tarefa?')) return;
    
    setDeleting(id);
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'DELETE',
      });
      
      if (res.ok) {
        loadTasks();
        // Recarregar stats
        const statsRes = await fetch('/api/tasks/stats');
        const statsData = await statsRes.json();
        setStats(statsData);
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao excluir tarefa');
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Erro ao excluir tarefa');
    } finally {
      setDeleting(null);
    }
  };

  const exportPDF = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      
      const doc = new jsPDF();
      
      // Título
      doc.setFontSize(18);
      doc.text('Relatório de Tarefas Pendentes', 14, 22);
      
      // Info
      doc.setFontSize(10);
      doc.text('Todas as tarefas ativas (pendentes e em andamento)', 14, 30);
      
      // Total
      const total = sortedTasks.reduce((sum, t) => sum + t.cost, 0);
      doc.text(`Total: ${formatCurrency(total)} (${sortedTasks.length} tarefas)`, 14, 36);
      
      // Tabela
      const tableData = sortedTasks.map(task => [
        formatDate(task.requestDate),
        task.categoryName,
        task.clientName,
        task.title,
        task.description.substring(0, 50) + (task.description.length > 50 ? '...' : ''),
        task.deliveryDate ? formatDate(task.deliveryDate) : '-',
        formatCurrency(task.cost),
        task.observations?.substring(0, 30) || '-',
      ]);
      
      autoTable(doc, {
        startY: 42,
        head: [['Data Sol.', 'Categoria', 'Cliente', 'Título', 'Descrição', 'Entrega', 'Custo', 'Obs.']],
        body: tableData,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [59, 130, 246] },
      });
      
      doc.save(`relatorio-tarefas-pendentes.pdf`);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Erro ao exportar PDF');
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div id="dashboard-page" className="density-container density-py">
      {/* Header */}
      <header id="dashboard-header" className="flex flex-col sm:flex-row sm:items-center sm:justify-between density-header-mb">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Dashboard
          </h1>
          <p className="text-muted-foreground">
            Visão geral dos serviços
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-2">
          <button
            onClick={openNewModal}
            className="btn-primary flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nova Tarefa
          </button>
        </div>
      </header>

      {/* Cards de Resumo */}
      <section id="dashboard-stats" className="grid grid-cols-1 md:grid-cols-3 density-grid-gap density-mb">
        <div className="card-soft density-card-padding">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-muted-foreground">Total Mês Atual</p>
              <p className="text-2xl font-bold text-foreground">
                {formatCurrency(stats?.currentMonth.total || 0)}
              </p>
            </div>
          </div>
        </div>
        
        <div className="card-soft density-card-padding">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-muted-foreground">Tarefas Mês Atual</p>
              <p className="text-2xl font-bold text-foreground">
                {stats?.currentMonth.count || 0}
              </p>
            </div>
          </div>
        </div>
        
        <div className="card-soft density-card-padding">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/30">
              <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-muted-foreground">Total de Clientes</p>
              <p className="text-2xl font-bold text-foreground">
                {clients.length}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Gráficos */}
      <section id="dashboard-charts" className="grid grid-cols-1 lg:grid-cols-2 density-grid-gap density-mb">
        {/* Gráfico de Barras - Mensal */}
        <div className="card-soft density-card-padding">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Faturamento Mensal
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={(stats?.monthlyData || []).map(d => ({
                  name: d.month,
                  total: d.total,
                }))}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#60a5fa" stopOpacity={1} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={1} />
                  </linearGradient>
                </defs>
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  stroke={chartColors.grid} 
                  vertical={false}
                />
                <XAxis 
                  dataKey="name" 
                  stroke={chartColors.text}
                  tick={{ fill: chartColors.text, fontSize: 11 }}
                  axisLine={{ stroke: chartColors.grid }}
                />
                <YAxis 
                  stroke={chartColors.text}
                  tick={{ fill: chartColors.text }}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                  axisLine={false}
                />
                <RechartsTooltip 
                  contentStyle={{
                    backgroundColor: chartColors.tooltipBg,
                    border: `1px solid ${chartColors.tooltipBorder}`,
                    borderRadius: '6px',
                    color: chartColors.tooltipText,
                  }}
                  labelStyle={{ color: chartColors.tooltipText }}
                  itemStyle={{ color: chartColors.tooltipText }}
                  formatter={(value: any) => [formatCurrency(value), 'Faturamento']}
                  cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                />
                <Bar 
                  dataKey="total" 
                  fill="url(#barGradient)"
                  radius={[8, 8, 0, 0]}
                  maxBarSize={60}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico de Pizza - Por Cliente */}
        <div className={`card-soft ${isCompact ? 'p-4' : 'p-6'}`}>
          <h3 className={`text-lg font-semibold text-foreground ${isCompact ? 'mb-2' : 'mb-4'}`}>
            Top 5 Clientes
          </h3>
          <div className={`h-64 ${isCompact ? 'h-48' : 'h-64'}`}>
            <PieResponsiveContainer width="100%" height="100%">
              <PieChart>
                <defs>
                  {COLORS.map((color, index) => (
                    <linearGradient key={`gradient-${index}`} id={`pieGradient-${index}`} x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={0.9} />
                      <stop offset="100%" stopColor={color} stopOpacity={1} />
                    </linearGradient>
                  ))}
                </defs>
                <Pie
                  data={(stats?.clientStats || []).map((c, index) => ({
                    name: c.clientName,
                    value: c.total,
                    color: COLORS[index % COLORS.length],
                  }))}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => {
                    if (!name || percent === undefined) return '';
                    const displayName = name.length > 12 ? name.substring(0, 12) + '...' : name;
                    return `${displayName} ${(percent * 100).toFixed(0)}%`;
                  }}
                  labelLine={{ stroke: chartColors.text, strokeWidth: 1 }}
                >
                  {(stats?.clientStats || []).map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={`url(#pieGradient-${index % COLORS.length})`}
                      stroke={resolvedTheme === 'dark' ? '#1f2937' : '#ffffff'}
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <PieTooltip 
                  contentStyle={{
                    backgroundColor: chartColors.tooltipBg,
                    border: `1px solid ${chartColors.tooltipBorder}`,
                    borderRadius: '6px',
                    color: chartColors.tooltipText,
                  }}
                  labelStyle={{ color: chartColors.tooltipText }}
                  itemStyle={{ color: chartColors.tooltipText }}
                  formatter={(value: any) => {
                    const total = (stats?.clientStats || []).reduce((sum, c) => sum + c.total, 0);
                    const percent = ((value / total) * 100).toFixed(1);
                    return [`${formatCurrency(value)} (${percent}%)`];
                  }}
                />
              </PieChart>
            </PieResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Filtros e Listagem */}
      <section id="dashboard-tasks" className={`card-soft ${isCompact ? 'p-4' : 'p-6'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              Tarefas Pendentes
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Tarefas pendentes e em andamento (desde sempre)
            </p>
          </div>
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 w-full sm:w-auto justify-start sm:justify-end">
            <select
              value={filterClientId}
              onChange={(e) => setFilterClientId(e.target.value)}
              className="input-soft w-full sm:w-auto"
            >
              <option value="">Todos os clientes</option>
              {buildClientOptions(clientsTree)}
            </select>
            
            <select
              value={filterCategoryId}
              onChange={(e) => setFilterCategoryId(e.target.value)}
              className="input-soft w-full sm:w-auto"
            >
              <option value="">Todas as categorias</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>{c.icon} {c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Totalizador */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30 rounded-lg p-4 my-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-700 dark:text-gray-300">
              {sortedTasks.length} tarefa(s) ativa(s)
              {tasks.length > sortedTasks.length && (
                <span className="text-xs text-muted-foreground ml-2">
                  ({tasks.length - sortedTasks.length} concluída(s)/cancelada(s) oculta(s))
                </span>
              )}
            </span>
            <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
              Total: {formatCurrency(sortedTasks.reduce((sum, t) => sum + t.cost, 0))}
            </span>
          </div>
        </div>

        {/* Tabela */}
        <DataTable 
          density={density} 
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSortChange={(column, direction) => {
            setSortColumn(column as 'requestDate' | 'deliveryDate' | 'cost');
            setSortDirection(direction);
          }}
        >
          <DataTable.Header>
            <DataTable.Column sortKey="requestDate" synced>DATA</DataTable.Column>
            <DataTable.Column>CATEGORIA</DataTable.Column>
            <DataTable.Column>CLIENTE</DataTable.Column>
            <DataTable.Column synced>TÍTULO</DataTable.Column>
            <DataTable.Column synced>STATUS</DataTable.Column>
            <DataTable.Column align="right">AÇÕES</DataTable.Column>
          </DataTable.Header>
          <DataTable.Body emptyMessage="Nenhuma tarefa ativa encontrada" colSpan={6}>
            {sortedTasks.map((task) => (
              <DataTable.Row key={task._id} onClick={() => openViewModal(task)}>
                <DataTable.Cell synced={task.asanaSynced}>
                  {formatDate(task.requestDate)}
                </DataTable.Cell>
                <DataTable.Cell>
                  <div className="flex items-center gap-2 max-w-xs">
                    {task.categoryIcon && (
                      <span className="text-lg" style={{ color: task.categoryColor || '#6B7280' }}>
                        {task.categoryIcon}
                      </span>
                    )}
                    <span className="truncate" title={task.categoryName}>
                      {task.categoryName}
                    </span>
                  </div>
                </DataTable.Cell>
                <DataTable.Cell truncate title={task.rootClientName || task.clientName}>
                  {task.rootClientName || task.clientName}
                </DataTable.Cell>
                <DataTable.Cell synced={task.asanaSynced} truncate title={task.title} className="font-medium">
                  {task.title}
                </DataTable.Cell>
                <DataTable.Cell synced={task.asanaSynced}>
                  <StatusBadge 
                    status={task.status} 
                    editable 
                    loading={updatingStatus === task._id}
                    onChange={(newStatus) => handleStatusChange(task._id, newStatus)}
                  />
                </DataTable.Cell>
                <DataTable.Cell align="right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditModal(task); }}
                      className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors dark:text-gray-400 dark:hover:text-blue-400 dark:hover:bg-blue-950/30"
                      title="Editar"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    {canDelete && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(task._id); }}
                        disabled={deleting === task._id}
                        className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-950/30 disabled:opacity-50"
                        title="Excluir"
                      >
                        {deleting === task._id ? (
                          <div className="w-4 h-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                </DataTable.Cell>
              </DataTable.Row>
            ))}
          </DataTable.Body>
        </DataTable>
      </section>

      {/* Modal de Visualização */}
      <Modal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        title="Detalhes da Tarefa"
        size="lg"
      >
        {viewingTask && (
          <div className="space-y-6">
            {/* Informações Principais */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-4">Informações Gerais</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground">Título</label>
                    <p className="text-sm text-foreground font-medium">{viewingTask.title}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground">Cliente</label>
                    <p className="text-sm text-foreground">{viewingTask.clientName}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground">Categoria</label>
                    <p className="text-sm text-foreground">{viewingTask.categoryName}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground">Status</label>
                    <StatusBadge status={viewingTask.status} />
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-4">Datas e Valores</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground">Data de Solicitação</label>
                    <p className="text-sm text-foreground">{formatDate(viewingTask.requestDate)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground">Data de Entrega</label>
                    <p className="text-sm text-foreground">{viewingTask.deliveryDate ? formatDate(viewingTask.deliveryDate) : 'Não definida'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground">Custo</label>
                    <p className="text-sm text-foreground font-semibold">{formatCurrency(viewingTask.cost)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground">Criado em</label>
                    <p className="text-sm text-foreground">{formatDate(viewingTask.createdAt)}</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Descrição */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Descrição</h3>
              <div className="rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50">
                <p className="text-sm text-foreground whitespace-pre-wrap">{viewingTask.description}</p>
              </div>
            </div>
            
            {/* Observações */}
            {viewingTask.observations && (
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-4">Observações</h3>
                <div className="rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50">
                  <p className="text-sm text-foreground whitespace-pre-wrap">{viewingTask.observations}</p>
                </div>
              </div>
            )}
            
            {/* Status do Asana */}
            <div className="flex items-center gap-2">
              <label className="block text-sm font-medium text-muted-foreground">Status do Asana:</label>
              {viewingTask.asanaSynced ? (
                <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Sincronizado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Não sincronizado
                </span>
              )}
            </div>
            
            {/* Botões de Ação */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  setShowViewModal(false);
                  openEditModal(viewingTask);
                }}
                className="btn-primary"
              >
                Editar Tarefa
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Nova/Editar Tarefa */}
      <TaskModal
        isOpen={showTaskModal}
        onClose={handleTaskModalClose}
        onSuccess={handleTaskModalSuccess}
        editingTask={editingTask}
        clientsTree={clientsTree}
        categories={categories}
      />
    </div>
  );
}
