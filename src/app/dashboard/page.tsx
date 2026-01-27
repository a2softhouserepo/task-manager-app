'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, FormEvent, useMemo, useCallback } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import dynamic from 'next/dynamic';
import { formatCurrency, formatDate, getMonthName } from '@/lib/utils';
import { useUI } from '@/contexts/UIContext';
import { getChartColors } from '@/lib/chartColors';
import Modal from '@/components/Modal';

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
  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterClientId, setFilterClientId] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const [useCustomPeriod, setUseCustomPeriod] = useState(false);

  // Ordenação
  const [sortColumn, setSortColumn] = useState<'requestDate' | 'deliveryDate' | 'cost'>('requestDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Modal de nova tarefa
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskForm, setTaskForm] = useState({
    requestDate: new Date().toISOString().split('T')[0],
    clientId: '',
    categoryId: '',
    title: '',
    description: '',
    deliveryDate: '',
    cost: 0,
    observations: '',
    status: 'pending',
    sendToAsana: true,
  });
  const [taskAttachments, setTaskAttachments] = useState<File[]>([]);
  const [savingTask, setSavingTask] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const userRole = (session?.user as any)?.role || 'user';
  const userId = (session?.user as any)?.id;
  const canDelete = userRole === 'rootAdmin';

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
  }, [filterMonth, filterStartDate, filterEndDate, filterClientId, filterCategoryId, useCustomPeriod]);

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

  const loadTasks = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      
      if (useCustomPeriod) {
        if (filterStartDate) params.set('startDate', filterStartDate);
        if (filterEndDate) params.set('endDate', filterEndDate);
      } else {
        params.set('month', filterMonth);
      }
      
      if (filterClientId) params.set('clientId', filterClientId);
      if (filterCategoryId) params.set('categoryId', filterCategoryId);
      
      const res = await fetch(`/api/tasks?${params.toString()}`);
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  }, [filterMonth, filterStartDate, filterEndDate, filterClientId, filterCategoryId, useCustomPeriod]);

  /**
   * OTIMIZAÇÃO: useMemo para evitar recálculos desnecessários da ordenação
   */
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
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

  // Função para renderizar ícone de ordenação
  const renderSortIcon = (column: 'requestDate' | 'deliveryDate' | 'cost') => {
    const isActive = sortColumn === column;
    const isAsc = sortDirection === 'asc';
    
    return (
      <div className="flex flex-col">
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

  // Função para lidar com clique nos cabeçalhos
  const handleSort = (column: 'requestDate' | 'deliveryDate' | 'cost') => {
    if (sortColumn === column) {
      // Se já está ordenando por esta coluna, alterna a direção
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Nova coluna, começa com ascendente
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

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
    setTaskForm({
      requestDate: task.requestDate.split('T')[0],
      clientId: task.clientId,
      categoryId: task.categoryId,
      title: task.title,
      description: task.description,
      deliveryDate: task.deliveryDate ? task.deliveryDate.split('T')[0] : '',
      cost: task.cost,
      observations: task.observations || '',
      status: task.status,
      sendToAsana: false,
    });
    setTaskAttachments([]);
    setShowTaskModal(true);
  };

  const openNewModal = () => {
    setEditingTask(null);
    setTaskForm({
      requestDate: new Date().toISOString().split('T')[0],
      clientId: '',
      categoryId: '',
      title: '',
      description: '',
      deliveryDate: '',
      cost: 0,
      observations: '',
      status: 'pending',
      sendToAsana: true,
    });
    setTaskAttachments([]);
    setShowTaskModal(true);
  };

  const handleSubmitTask = async (e: FormEvent) => {
    e.preventDefault();
    setSavingTask(true);
    
    try {
      const url = editingTask ? `/api/tasks/${editingTask._id}` : '/api/tasks';
      let res: Response;
      
      // Se não está editando e tem anexos, usa FormData
      if (!editingTask && taskAttachments.length > 0 && taskForm.sendToAsana) {
        const formData = new FormData();
        
        // Adiciona todos os campos do formulário
        Object.entries(taskForm).forEach(([key, value]) => {
          formData.append(key, value.toString());
        });
        formData.append('cost', Number(taskForm.cost).toString());
        
        // Adiciona os arquivos
        taskAttachments.forEach((file) => {
          formData.append('attachments', file);
        });
        
        res = await fetch(url, {
          method: 'POST',
          body: formData,
        });
      } else {
        res = await fetch(url, {
          method: editingTask ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...taskForm,
            cost: Number(taskForm.cost),
          }),
        });
      }
      
      if (res.ok) {
        setShowTaskModal(false);
        setEditingTask(null);
        setTaskAttachments([]);
        setTaskForm({
          requestDate: new Date().toISOString().split('T')[0],
          clientId: '',
          categoryId: '',
          title: '',
          description: '',
          deliveryDate: '',
          cost: 0,
          observations: '',
          status: 'pending',
          sendToAsana: true,
        });
        loadData();
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao salvar tarefa');
      }
    } catch (error) {
      console.error('Error creating task:', error);
      alert('Erro ao criar tarefa');
    } finally {
      setSavingTask(false);
    }
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
      doc.text('Relatório de Serviços', 14, 22);
      
      // Período
      doc.setFontSize(10);
      let periodText = '';
      if (useCustomPeriod && filterStartDate && filterEndDate) {
        periodText = `Período: ${formatDate(filterStartDate)} a ${formatDate(filterEndDate)}`;
      } else {
        const [year, month] = filterMonth.split('-');
        periodText = `Período: ${getMonthName(parseInt(month) - 1)}/${year}`;
      }
      doc.text(periodText, 14, 30);
      
      // Total
      const total = tasks.reduce((sum, t) => sum + t.cost, 0);
      doc.text(`Total: ${formatCurrency(total)}`, 14, 36);
      
      // Tabela
      const tableData = tasks.map(task => [
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
      
      doc.save(`relatorio-servicos-${filterMonth || 'custom'}.pdf`);
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

  const totalFiltered = tasks.reduce((sum, t) => sum + t.cost, 0);

  return (
    <div className="density-container density-py">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between density-header-mb">
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
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 density-grid-gap density-mb">
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
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 density-grid-gap density-mb">
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
      </div>

      {/* Filtros e Listagem */}
      <div className={`card-soft ${isCompact ? 'p-4' : 'p-6'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-lg font-semibold text-foreground whitespace-nowrap">
            Tarefas do Período
          </h3>
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 w-full sm:w-auto justify-start sm:justify-end">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={useCustomPeriod}
                onChange={(e) => setUseCustomPeriod(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">Período customizado</span>
            </label>
            
            {useCustomPeriod ? (
              <>
                <input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  className="input-soft w-full sm:w-auto"
                />
                <input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  className="input-soft w-full sm:w-auto"
                />
              </>
            ) : (
              <input
                type="month"
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="input-soft w-full sm:w-auto"
              />
            )}
            
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
              {tasks.length} tarefa(s) encontrada(s)
            </span>
            <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
              Total: {formatCurrency(totalFiltered)}
            </span>
          </div>
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-200">
            <thead className="">
              <tr className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <th className={`whitespace-nowrap ${isCompact ? 'px-3 py-2' : 'px-6 py-3'}`}>
                  <button
                    onClick={() => handleSort('requestDate')}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    DATA
                    {renderSortIcon('requestDate')}
                  </button>
                </th>
                <th className={`px-4 whitespace-nowrap ${isCompact ? 'py-2' : 'py-3'}`}>CATEGORIA</th>
                <th className={`px-4 whitespace-nowrap ${isCompact ? 'py-2' : 'py-3'}`}>CLIENTE</th>
                <th className={`px-4 whitespace-nowrap ${isCompact ? 'py-2' : 'py-3'}`}>TÍTULO</th>
                <th className={`px-4 whitespace-nowrap ${isCompact ? 'py-2' : 'py-3'}`}>STATUS</th>
                <th className={`px-4 text-right whitespace-nowrap ${isCompact ? 'py-2' : 'py-3'}`}>AÇÕES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {sortedTasks.map((task) => (
                <tr key={task._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                  <td className={`px-4 text-sm text-foreground whitespace-nowrap ${isCompact ? 'py-2.5' : 'py-4'}`}>
                    {formatDate(task.requestDate)}
                  </td>
                  <td className={`px-4 text-sm text-muted-foreground whitespace-nowrap ${isCompact ? 'py-2.5' : 'py-4'}`}>
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
                  </td>
                  <td className={`px-4 text-sm text-muted-foreground whitespace-nowrap ${isCompact ? 'py-2.5' : 'py-4'}`}>
                    <div className="max-w-xs truncate" title={task.rootClientName || task.clientName}>
                      {task.rootClientName || task.clientName}
                    </div>
                  </td>
                  <td className={`px-4 text-sm font-medium text-foreground whitespace-nowrap ${isCompact ? 'py-2.5' : 'py-4'}`}>
                    <div className="max-w-xs truncate" title={task.title}>
                      {task.title}
                    </div>
                  </td>
                  <td className={`px-4 text-sm whitespace-nowrap ${isCompact ? 'py-2.5' : 'py-4'}`}>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      task.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                      task.status === 'in_progress' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                      task.status === 'cancelled' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                    }`}>
                      {task.status === 'completed' ? 'Concluída' :
                       task.status === 'in_progress' ? 'Em Progresso' :
                       task.status === 'cancelled' ? 'Cancelada' :
                       'Pendente'}
                    </span>
                  </td>
                  <td className={`px-4 whitespace-nowrap ${isCompact ? 'py-2.5' : 'py-4'}`}>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(task)}
                        className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors dark:text-gray-400 dark:hover:text-blue-400 dark:hover:bg-blue-950/30"
                        title="Editar"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(task._id)}
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
                  </td>
                </tr>
              ))}
              {tasks.length === 0 && (
                <tr>
                  <td colSpan={5} className={`px-4 text-center text-muted-foreground ${isCompact ? 'py-8' : 'py-12'}`}>
                    Nenhuma tarefa encontrada no período selecionado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nova Tarefa */}
      <Modal
        isOpen={showTaskModal}
        onClose={() => {
          setShowTaskModal(false);
          setEditingTask(null);
        }}
        title={editingTask ? 'Editar Tarefa' : 'Nova Tarefa'}
        size="lg"
      >
        <form onSubmit={handleSubmitTask} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Data de Solicitação
              </label>
              <input
                type="date"
                value={taskForm.requestDate}
                onChange={(e) => setTaskForm({ ...taskForm, requestDate: e.target.value })}
                className="input-soft"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Data de Entrega
              </label>
              <input
                type="date"
                value={taskForm.deliveryDate}
                onChange={(e) => setTaskForm({ ...taskForm, deliveryDate: e.target.value })}
                className="input-soft"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Cliente *
              </label>
              <select
                value={taskForm.clientId}
                onChange={(e) => setTaskForm({ ...taskForm, clientId: e.target.value })}
                className="input-soft"
                required
              >
                <option value="">Selecione...</option>
                {buildClientOptions(clientsTree)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Categoria *
              </label>
              <select
                value={taskForm.categoryId}
                onChange={(e) => setTaskForm({ ...taskForm, categoryId: e.target.value })}
                className="input-soft"
                required
              >
                <option value="">Selecione...</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>{c.icon} {c.name}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Título *
            </label>
            <input
              type="text"
              value={taskForm.title}
              onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
              className="input-soft"
              placeholder="Título da tarefa"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Descrição *
            </label>
            <textarea
              value={taskForm.description}
              onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
              className="input-soft"
              rows={3}
              placeholder="Descreva a tarefa..."
              required
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Custo *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={taskForm.cost}
                onChange={(e) => setTaskForm({ ...taskForm, cost: parseFloat(e.target.value) || 0 })}
                className="input-soft"
                required
              />
            </div>
            {editingTask && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <select
                  value={taskForm.status}
                  onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value })}
                  className="input-soft"
                >
                  <option value="pending">Pendente</option>
                  <option value="in_progress">Em Andamento</option>
                  <option value="completed">Concluída</option>
                  <option value="cancelled">Cancelada</option>
                </select>
              </div>
            )}
          </div>

          {!editingTask && (
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={taskForm.sendToAsana}
                  onChange={(e) => setTaskForm({ ...taskForm, sendToAsana: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">Enviar para Asana</span>
              </label>
            </div>
          )}

          {!editingTask && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Anexos para Asana (máx. 5 arquivos, 10MB cada)
              </label>
              <input
                type="file"
                multiple
                disabled={!taskForm.sendToAsana}
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length > 5) {
                    alert('Máximo de 5 arquivos permitidos');
                    return;
                  }
                  const oversized = files.find(f => f.size > 10 * 1024 * 1024);
                  if (oversized) {
                    alert(`Arquivo ${oversized.name} excede 10MB`);
                    return;
                  }
                  setTaskAttachments(files);
                }}
                className="input-soft file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/30 dark:file:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {!taskForm.sendToAsana && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Marque "Enviar para Asana" para habilitar anexos
                </p>
              )}
              {taskAttachments.length > 0 && (
                <div className="mt-2 space-y-1">
                  {taskAttachments.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                      <span>{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
                      <button
                        type="button"
                        onClick={() => setTaskAttachments(prev => prev.filter((_, i) => i !== idx))}
                        className="text-red-600 hover:text-red-700 dark:text-red-400"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Observações
            </label>
            <textarea
              value={taskForm.observations}
              onChange={(e) => setTaskForm({ ...taskForm, observations: e.target.value })}
              className="input-soft"
              rows={2}
              placeholder="Observações adicionais..."
            />
          </div>
          
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setShowTaskModal(false)}
              className="btn-secondary"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingTask}
              className="btn-primary"
            >
              {savingTask ? 'Salvando...' : 'Salvar Tarefa'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
