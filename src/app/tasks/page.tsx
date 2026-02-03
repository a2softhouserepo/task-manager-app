'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { formatCurrency, formatDate, getMonthName } from '@/lib/utils';
import { useUI } from '@/contexts/UIContext';
import { useAsanaSyncedData } from '@/contexts/AsanaSyncContext';
import Modal from '@/components/Modal';
import TaskModal from '@/components/TaskModal';
import { SyncColumnHeader, SyncColumnCell } from '@/components/SyncColumnHeader';

interface Task {
  _id: string;
  requestDate: string;
  clientId: string;
  clientName: string;
  rootClientName?: string;
  subClientLevels?: string[];
  categoryId: string;
  categoryName: string;
  title: string;
  description: string;
  deliveryDate?: string;
  cost: number;
  observations?: string;
  status: string;
  asanaSynced: boolean;
  asanaTaskGid?: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

interface Client {
  _id: string;
  name: string;
  parentId?: string | null;
  path?: string[];
  depth?: number;
  children?: Client[];
}

interface Category {
  _id: string;
  name: string;
  icon: string;
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pendente', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  { value: 'in_progress', label: 'Em Andamento', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  { value: 'completed', label: 'Concluída', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  { value: 'cancelled', label: 'Cancelada', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
];

export default function TasksPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { density } = useUI();
  const isCompact = density === 'compact';
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsTree, setClientsTree] = useState<Client[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [maxSubClientLevels, setMaxSubClientLevels] = useState(0);
  
  // Ordenação
  const [sortColumn, setSortColumn] = useState<'requestDate' | 'clientName' | 'title' | 'cost'>('requestDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Filtros
  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterClientId, setFilterClientId] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [useCustomPeriod, setUseCustomPeriod] = useState(false);
  
  // PDF Export Modal
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfColumns, setPdfColumns] = useState<{[key: string]: boolean}>({
    requestDate: true,
    categoryName: true,
    rootClientName: true,
    title: true,
    description: true,
    deliveryDate: true,
    cost: true,
    status: true,
    observations: true,
  });
  const [pdfHeaderText, setPdfHeaderText] = useState('');
  const [pdfFooterText, setPdfFooterText] = useState('');
  const [pdfStartDate, setPdfStartDate] = useState('');
  const [pdfEndDate, setPdfEndDate] = useState('');
  const [pdfMonth, setPdfMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [pdfUseCustomPeriod, setPdfUseCustomPeriod] = useState(false);

  const userRole = (session?.user as any)?.role || 'user';
  const userId = (session?.user as any)?.id;
  const canDelete = userRole === 'rootAdmin';

  // Declare loadTasks first so it can be used in useEffects below
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
      if (filterStatus) params.set('status', filterStatus);
      
      const res = await fetch(`/api/tasks?${params.toString()}`);
      const data = await res.json();
      const tasksData = data.tasks || [];
      setTasks(tasksData);
      
      // Calcular número máximo de níveis de subclientes
      const maxLevels = tasksData.reduce((max: number, task: Task) => {
        const levels = task.subClientLevels?.length || 0;
        return Math.max(max, levels);
      }, 0);
      setMaxSubClientLevels(maxLevels);
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  }, [filterMonth, filterStartDate, filterEndDate, filterClientId, filterCategoryId, filterStatus, useCustomPeriod]);

  // Integração com AsanaSyncContext - recarrega tasks automaticamente quando há atualizações
  useAsanaSyncedData(loadTasks);

  const loadData = async () => {
    try {
      const [clientsRes, clientsTreeRes, categoriesRes] = await Promise.all([
        fetch('/api/clients?active=true'),
        fetch('/api/clients?active=true&tree=true'),
        fetch('/api/categories?active=true'),
      ]);
      
      const [clientsData, clientsTreeData, categoriesData] = await Promise.all([
        clientsRes.json(),
        clientsTreeRes.json(),
        categoriesRes.json(),
      ]);
      
      setClients(clientsData.clients || []);
      setClientsTree(clientsTreeData.clients || []);
      setCategories(categoriesData.categories || []);
      
      await loadTasks();
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

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
  }, [filterMonth, filterStartDate, filterEndDate, filterClientId, filterCategoryId, filterStatus, useCustomPeriod]);

  /**
   * OTIMIZAÇÃO: useMemo para evitar recálculos desnecessários da ordenação
   * a cada re-render
   */
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      let aValue: string | number, bValue: string | number;

      switch (sortColumn) {
        case 'requestDate':
          aValue = new Date(a.requestDate).getTime();
          bValue = new Date(b.requestDate).getTime();
          break;
        case 'clientName':
          aValue = a.clientName.toLowerCase();
          bValue = b.clientName.toLowerCase();
          break;
        case 'title':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
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

  // Função para lidar com clique nos cabeçalhos
  const handleSort = (column: 'requestDate' | 'clientName' | 'title' | 'cost') => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
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

  // Função para renderizar ícone de ordenação
  const renderSortIcon = (column: 'requestDate' | 'clientName' | 'title' | 'cost') => {
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

  const openNewModal = () => {
    setEditingTask(null);
    setShowModal(true);
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setShowModal(true);
  };

  // Sync editingTask with tasks list when it's updated (e.g., via Asana webhook)
  useEffect(() => {
    if (editingTask && showModal) {
      const updatedTask = tasks.find(t => t._id === editingTask._id);
      if (updatedTask) {
        const hasChanged = 
          updatedTask.title !== editingTask.title ||
          updatedTask.description !== editingTask.description ||
          updatedTask.status !== editingTask.status ||
          updatedTask.deliveryDate !== editingTask.deliveryDate ||
          updatedTask.cost !== editingTask.cost;
        
        if (hasChanged) {
          console.log('[MODAL] Editing task updated externally, refreshing form');
          setEditingTask(updatedTask);
        }
      }
    }
  }, [tasks, editingTask, showModal]);

  const openViewModal = (task: Task) => {
    setViewingTask(task);
    setShowViewModal(true);
  };

  // Sync viewingTask with tasks list when it's updated (e.g., via Asana webhook)
  useEffect(() => {
    if (viewingTask && showViewModal) {
      const updatedTask = tasks.find(t => t._id === viewingTask._id);
      if (updatedTask) {
        // Check if task was actually updated (compare timestamps or content)
        const hasChanged = 
          updatedTask.title !== viewingTask.title ||
          updatedTask.description !== viewingTask.description ||
          updatedTask.status !== viewingTask.status ||
          updatedTask.deliveryDate !== viewingTask.deliveryDate ||
          updatedTask.cost !== viewingTask.cost;
        
        if (hasChanged) {
          console.log('[MODAL] Task updated, refreshing modal view');
          setViewingTask(updatedTask);
        }
      }
    }
  }, [tasks, viewingTask, showViewModal]);

  const handleTaskModalClose = () => {
    setShowModal(false);
    setEditingTask(null);
  };

  const handleTaskModalSuccess = () => {
    loadTasks();
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

  const getStatusBadge = (status: string) => {
    const option = STATUS_OPTIONS.find(s => s.value === status);
    return option || STATUS_OPTIONS[0];
  };

  const openPdfModal = () => {
    // Preparar colunas base
    const baseColumns: {[key: string]: boolean} = {
      requestDate: true,
      categoryName: true,
      rootClientName: true,
      title: true,
      description: true,
      deliveryDate: true,
      cost: true,
      status: true,
      observations: true,
    };
    
    // Adicionar colunas de subcliente dinamicamente
    for (let i = 0; i < maxSubClientLevels; i++) {
      baseColumns[`subClient${i}`] = true;
    }
    
    setPdfColumns(baseColumns);
    setPdfHeaderText('');
    setPdfFooterText('');
    setPdfStartDate(filterStartDate);
    setPdfEndDate(filterEndDate);
    setPdfMonth(filterMonth);
    setPdfUseCustomPeriod(useCustomPeriod);
    setShowPdfModal(true);
  };

  const exportPDF = async () => {
    try {
      setShowPdfModal(false);
      
      // Filtrar tarefas por período do PDF
      const params = new URLSearchParams();
      if (pdfUseCustomPeriod) {
        if (pdfStartDate) params.set('startDate', pdfStartDate);
        if (pdfEndDate) params.set('endDate', pdfEndDate);
      } else {
        params.set('month', pdfMonth);
      }
      if (filterClientId) params.set('clientId', filterClientId);
      if (filterCategoryId) params.set('categoryId', filterCategoryId);
      if (filterStatus) params.set('status', filterStatus);
      
      const res = await fetch(`/api/tasks?${params.toString()}`);
      const data = await res.json();
      const pdfTasks = data.tasks || [];
      
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      
      const doc = new jsPDF('landscape');
      let currentY = 14;
      
      // Cabeçalho personalizado
      if (pdfHeaderText) {
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(pdfHeaderText, 14, currentY);
        currentY += 8;
      }
      
      // Título
      doc.setFontSize(18);
      doc.setTextColor(0);
      doc.text('Relatório de Serviços', 14, currentY);
      currentY += 8;
      
      // Período
      doc.setFontSize(10);
      let periodText = '';
      if (pdfUseCustomPeriod && pdfStartDate && pdfEndDate) {
        periodText = `Período: ${formatDate(pdfStartDate)} a ${formatDate(pdfEndDate)}`;
      } else {
        const [year, month] = pdfMonth.split('-');
        periodText = `Período: ${getMonthName(parseInt(month) - 1)}/${year}`;
      }
      doc.text(periodText, 14, currentY);
      currentY += 6;
      
      // Filtros aplicados
      let filterText = '';
      if (filterClientId) {
        const client = clients.find(c => c._id === filterClientId);
        filterText += `Cliente: ${client?.name || 'N/A'} | `;
      }
      if (filterCategoryId) {
        const category = categories.find(c => c._id === filterCategoryId);
        filterText += `Categoria: ${category?.name || 'N/A'} | `;
      }
      if (filterStatus) {
        const statusLabel = getStatusBadge(filterStatus).label;
        filterText += `Status: ${statusLabel}`;
      }
      if (filterText) {
        doc.text(filterText.replace(/\| $/, ''), 14, currentY);
        currentY += 6;
      }
      
      // Total
      const total = pdfTasks.reduce((sum: number, t: Task) => sum + t.cost, 0);
      doc.text(`Total: ${formatCurrency(total)} (${pdfTasks.length} tarefas)`, 14, currentY);
      currentY += 6;
      
      // Calcular max níveis de subclientes nos dados filtrados
      const pdfMaxSubClientLevels = pdfTasks.reduce((max: number, task: Task) => {
        return Math.max(max, task.subClientLevels?.length || 0);
      }, 0);
      
      // Montar colunas selecionadas
      const columnMapping: { [key: string]: { label: string; width: number } } = {
        requestDate: { label: 'Data', width: 22 },
        categoryName: { label: 'Categoria', width: 25 },
        rootClientName: { label: 'Cliente', width: 30 },
        title: { label: 'Título', width: 35 },
        description: { label: 'Descrição', width: 50 },
        deliveryDate: { label: 'Entrega', width: 22 },
        cost: { label: 'Custo', width: 22 },
        status: { label: 'Status', width: 22 },
        observations: { label: 'Obs.', width: 40 },
      };
      
      // Adicionar colunas dinâmicas de subcliente sem texto no header
      for (let i = 0; i < pdfMaxSubClientLevels; i++) {
        columnMapping[`subClient${i}`] = { label: '', width: 30 };
      }
      
      const selectedColumns = Object.entries(pdfColumns)
        .filter(([_, selected]) => selected)
        .map(([key]) => key)
        .filter(key => {
          // Filtrar colunas de subcliente que não existem no columnMapping
          if (key.startsWith('subClient')) {
            return columnMapping[key] !== undefined;
          }
          return columnMapping[key] !== undefined;
        });
      
      // Reordenar colunas: data, cliente, subclientes, depois o resto
      let dataColumn: string[] = [];
      const clientColumn: string[] = [];
      const subClientColumns: string[] = [];
      const otherColumns: string[] = [];
      
      selectedColumns.forEach(col => {
        if (col === 'requestDate') {
          dataColumn.push(col);
        } else if (col === 'rootClientName') {
          clientColumn.push(col);
        } else if (col.startsWith('subClient')) {
          subClientColumns.push(col);
        } else {
          otherColumns.push(col);
        }
      });
      
      // Ordenar subclientes por número
      subClientColumns.sort((a, b) => {
        const numA = parseInt(a.replace('subClient', ''));
        const numB = parseInt(b.replace('subClient', ''));
        return numA - numB;
      });
      
      const finalColumns = [...dataColumn, ...clientColumn, ...subClientColumns, ...otherColumns];
      const headers = finalColumns.map(col => columnMapping[col].label);
      
      const tableData = pdfTasks.map((task: Task) => {
        const row: string[] = [];
        finalColumns.forEach(col => {
          if (col.startsWith('subClient')) {
            // Coluna dinâmica de subcliente
            const level = parseInt(col.replace('subClient', ''));
            row.push(task.subClientLevels?.[level] || '-');
          } else {
            switch(col) {
              case 'requestDate':
                row.push(formatDate(task.requestDate));
                break;
              case 'categoryName':
                row.push(task.categoryName);
                break;
              case 'rootClientName':
                row.push(task.rootClientName || task.clientName);
                break;
              case 'title':
                row.push(task.title);
                break;
              case 'description':
                row.push(task.description.substring(0, 60) + (task.description.length > 60 ? '...' : ''));
                break;
              case 'deliveryDate':
                row.push(task.deliveryDate ? formatDate(task.deliveryDate) : '-');
                break;
              case 'cost':
                row.push(formatCurrency(task.cost));
                break;
              case 'status':
                row.push(getStatusBadge(task.status).label);
                break;
              case 'observations':
                row.push(task.observations?.substring(0, 40) || '-');
                break;
            }
          }
        });
        return row;
      });
      
      autoTable(doc, {
        startY: currentY,
        head: [headers],
        body: tableData,
        styles: { 
          fontSize: 6,
          cellPadding: 1.5,
          overflow: 'linebreak'
        },
        headStyles: { 
          fillColor: [59, 130, 246],
          fontSize: 6,
          fontStyle: 'bold'
        },
        theme: 'grid'
      });
      
      // Rodapé personalizado
      if (pdfFooterText) {
        const finalY = (doc as any).lastAutoTable.finalY || currentY + 20;
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(pdfFooterText, 14, finalY + 10);
      }
      
      const fileName = pdfUseCustomPeriod && pdfStartDate && pdfEndDate 
        ? `relatorio-tarefas-${pdfStartDate}-${pdfEndDate}.pdf`
        : `relatorio-tarefas-${pdfMonth}.pdf`;
      
      doc.save(fileName);
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
    <div id="tasks-page" className="min-h-screen">
      <div className="density-container density-py">
        {/* Header */}
        <header id="tasks-header" className="flex flex-col sm:flex-row sm:items-center sm:justify-between density-header-mb">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Tarefas
            </h1>
            <p className="text-muted-foreground">
              Gerencie todos os serviços
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex gap-2">
            <button
              onClick={openPdfModal}
              className="btn-secondary flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Exportar PDF
            </button>
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

        {/* Filtros */}
        <section id="tasks-filters" className={`card-soft ${isCompact ? 'p-3 mb-3' : 'p-6 mb-6'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="text-lg font-semibold text-foreground whitespace-nowrap">
              Tarefas do Período
            </h3>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto sm:flex-1 justify-start sm:justify-end">
              <label className="flex items-center gap-2 whitespace-nowrap">
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
                    placeholder="Data início"
                  />
                  <input
                    type="date"
                    value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                    className="input-soft w-full sm:w-auto"
                    placeholder="Data fim"
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
                className="input-soft w-full sm:w-auto min-w-[150px]"
              >
                <option value="">Todos os clientes</option>
                {buildClientOptions(clientsTree)}
              </select>
              
              <select
                value={filterCategoryId}
                onChange={(e) => setFilterCategoryId(e.target.value)}
                className="input-soft w-full sm:w-auto min-w-[180px]"
              >
                <option value="">Todas as categorias</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>{c.icon} {c.name}</option>
                ))}
              </select>
              
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="input-soft w-full sm:w-auto min-w-[140px]"
              >
                <option value="">Todos os status</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Totalizador */}
        <div id="tasks-summary" className={`bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30 rounded-lg ${isCompact ? 'p-3 mb-3' : 'p-4 mb-4'}`}>
          <div className="flex justify-between items-center">
            <span className="text-gray-700 dark:text-gray-300">
              {tasks.length} tarefa(s) encontrada(s)
            </span>
            <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
              Total: {formatCurrency(totalFiltered)}
            </span>
          </div>
        </div>

        {/* Lista */}
        <section id="tasks-table" className={`card-soft overflow-hidden ${isCompact ? 'p-3' : 'p-6'}`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-200">
              <thead className="">
                <tr className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {/* Colunas sincronizadas: DATA SOL., TÍTULO, ENTREGA, STATUS */}
                  <SyncColumnHeader 
                    isSynced 
                    className={`whitespace-nowrap ${isCompact ? 'px-3 py-2' : 'px-6 py-3'}`}
                    sortButton={
                      <button
                        onClick={() => handleSort('requestDate')}
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        DATA SOL.
                        {renderSortIcon('requestDate')}
                      </button>
                    }
                  >
                    DATA SOL.
                  </SyncColumnHeader>
                  <th className={`whitespace-nowrap ${isCompact ? 'px-3 py-2' : 'px-6 py-3'}`}>Categoria</th>
                  <th className={`whitespace-nowrap ${isCompact ? 'px-3 py-2' : 'px-6 py-3'}`}>
                    <button
                      onClick={() => handleSort('clientName')}
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      CLIENTE
                      {renderSortIcon('clientName')}
                    </button>
                  </th>
                  {maxSubClientLevels > 0 && Array.from({ length: maxSubClientLevels }).map((_, i) => (
                    <th key={`subclient-header-${i}`} className={`whitespace-nowrap ${isCompact ? 'px-3 py-2' : 'px-6 py-3'}`}>
                      SUBCLIENTE {i > 1 && i + 1}
                    </th>
                  ))}
                  <SyncColumnHeader 
                    isSynced 
                    className={`whitespace-nowrap ${isCompact ? 'px-3 py-2' : 'px-6 py-3'}`}
                    sortButton={
                      <button
                        onClick={() => handleSort('title')}
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        TÍTULO
                        {renderSortIcon('title')}
                      </button>
                    }
                  >
                    TÍTULO
                  </SyncColumnHeader>
                  <SyncColumnHeader 
                    isSynced 
                    className={`whitespace-nowrap ${isCompact ? 'px-3 py-2' : 'px-6 py-3'}`}
                  >
                    ENTREGA
                  </SyncColumnHeader>
                  <th className={`text-right whitespace-nowrap ${isCompact ? 'px-3 py-2' : 'px-6 py-3'}`}>
                    <button
                      onClick={() => handleSort('cost')}
                      className="flex items-center gap-1 hover:text-foreground transition-colors ml-auto"
                    >
                      CUSTO
                      {renderSortIcon('cost')}
                    </button>
                  </th>
                  <SyncColumnHeader 
                    isSynced 
                    className={`whitespace-nowrap ${isCompact ? 'px-3 py-2' : 'px-6 py-3'}`}
                  >
                    STATUS
                  </SyncColumnHeader>
                  <th className={`text-right whitespace-nowrap ${isCompact ? 'px-3 py-2' : 'px-6 py-3'}`}>AÇÕES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {sortedTasks.map((task) => (
                  <tr key={task._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors cursor-pointer" onClick={() => openViewModal(task)}>
                    <SyncColumnCell isSynced className={`text-sm whitespace-nowrap ${isCompact ? 'px-3 py-1.5' : 'px-4 py-3'}`}>
                      <span className="font-medium text-foreground">
                        {formatDate(task.requestDate)}
                      </span>
                    </SyncColumnCell>
                    <td className={`text-sm whitespace-nowrap text-muted-foreground ${isCompact ? 'px-3 py-1.5' : 'px-4 py-3'}`}>
                      {task.categoryName}
                    </td>
                    <td className={`text-sm text-muted-foreground ${isCompact ? 'px-3 py-1.5' : 'px-4 py-3'}`}>
                      <div className="max-w-xs truncate" title={task.rootClientName || task.clientName}>
                        {(task.rootClientName || task.clientName).length > 20 ? `${(task.rootClientName || task.clientName).substring(0, 20)}...` : (task.rootClientName || task.clientName)}
                      </div>
                    </td>
                    {maxSubClientLevels > 0 && Array.from({ length: maxSubClientLevels }).map((_, i) => (
                      <td key={`subclient-${task._id}-${i}`} className={`text-sm text-muted-foreground ${isCompact ? 'px-3 py-1.5' : 'px-4 py-3'}`}>
                        <div className="max-w-xs truncate" title={task.subClientLevels?.[i] || ''}>
                          {task.subClientLevels?.[i] || '-'}
                        </div>
                      </td>
                    ))}
                    <SyncColumnCell isSynced className={`text-sm font-medium text-foreground ${isCompact ? 'px-3 py-1.5' : 'px-4 py-3'}`}>
                      <div className="flex items-center gap-2">
                        <span>{task.title}</span>
                        {task.asanaSynced && (
                          <span className="text-xs text-blue-600 dark:text-blue-400" title="Enviado para Asana">
                            📧
                          </span>
                        )}
                      </div>
                    </SyncColumnCell>
                    <SyncColumnCell isSynced className={`text-sm whitespace-nowrap text-muted-foreground ${isCompact ? 'px-3 py-1.5' : 'px-4 py-3'}`}>
                      {task.deliveryDate ? formatDate(task.deliveryDate) : '-'}
                    </SyncColumnCell>
                    <td className={`text-sm font-medium text-foreground text-right whitespace-nowrap ${isCompact ? 'px-3 py-1.5' : 'px-4 py-3'}`}>
                      {formatCurrency(task.cost)}
                    </td>
                    <SyncColumnCell isSynced className={`whitespace-nowrap ${isCompact ? 'px-3 py-1.5' : 'px-4 py-3'}`}>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(task.status).color}`}>
                        {getStatusBadge(task.status).label}
                      </span>
                    </SyncColumnCell>
                    <td className={`whitespace-nowrap ${isCompact ? 'px-3 py-1.5' : 'px-4 py-3'}`}>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); openEditModal(task); }}
                          className="p-2 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors dark:text-muted-foreground dark:hover:text-blue-400 dark:hover:bg-blue-950/30"
                          title="Editar"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        {canDelete && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(task._id); }}
                            disabled={deleting === task._id}
                            className="p-2 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors dark:text-muted-foreground dark:hover:text-red-400 dark:hover:bg-red-950/30 disabled:opacity-50"
                            title="Excluir"
                          >
                            {deleting === task._id ? (
                              <div className="w-5 h-5 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    <td colSpan={8 + maxSubClientLevels} className={`text-center text-muted-foreground ${isCompact ? 'px-3 py-8' : 'px-4 py-12'}`}>
                      Nenhuma tarefa encontrada no período selecionado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(viewingTask.status).color}`}>
                        {getStatusBadge(viewingTask.status).label}
                      </span>
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
                <div className=" rounded-lg p-4">
                  <p className="text-sm text-foreground whitespace-pre-wrap">{viewingTask.description}</p>
                </div>
              </div>
              
              {/* Observações */}
              {viewingTask.observations && (
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-4">Observações</h3>
                  <div className=" rounded-lg p-4">
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
                    Enviado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Não enviado
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

        {/* Modal de Nova/Edição de Tarefa */}
        <TaskModal
          isOpen={showModal}
          onClose={handleTaskModalClose}
          onSuccess={handleTaskModalSuccess}
          editingTask={editingTask}
          clientsTree={clientsTree}
          categories={categories}
        />

        {/* Modal de Exportação PDF */}
        <Modal
          isOpen={showPdfModal}
          onClose={() => setShowPdfModal(false)}
          title="Configurar Exportação PDF"
          size="lg"
        >
          <div className="space-y-6">
            {/* Período */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Período da Exportação</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={pdfUseCustomPeriod}
                    onChange={(e) => setPdfUseCustomPeriod(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-foreground">Usar período customizado</span>
                </label>
                
                {pdfUseCustomPeriod ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        Data Início
                      </label>
                      <input
                        type="date"
                        value={pdfStartDate}
                        onChange={(e) => setPdfStartDate(e.target.value)}
                        className="input-soft"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        Data Fim
                      </label>
                      <input
                        type="date"
                        value={pdfEndDate}
                        onChange={(e) => setPdfEndDate(e.target.value)}
                        className="input-soft"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Mês
                    </label>
                    <input
                      type="month"
                      value={pdfMonth}
                      onChange={(e) => setPdfMonth(e.target.value)}
                      className="input-soft"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Colunas */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Colunas a Incluir</h3>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={pdfColumns.requestDate}
                    onChange={(e) => setPdfColumns({...pdfColumns, requestDate: e.target.checked})}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-foreground">Data Solicitação</span>
                </label>
                
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={pdfColumns.categoryName}
                    onChange={(e) => setPdfColumns({...pdfColumns, categoryName: e.target.checked})}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-foreground">Categoria</span>
                </label>
                
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={pdfColumns.rootClientName}
                    onChange={(e) => setPdfColumns({...pdfColumns, rootClientName: e.target.checked})}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-foreground">Cliente</span>
                </label>
                
                {maxSubClientLevels > 0 && Array.from({ length: maxSubClientLevels }).map((_, i) => (
                  <label key={`pdf-subclient-${i}`} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={pdfColumns[`subClient${i}`] !== false}
                      onChange={(e) => setPdfColumns({...pdfColumns, [`subClient${i}`]: e.target.checked})}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-foreground">Subcliente {i >= 1 && i + 1}</span>
                  </label>
                ))}
                
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={pdfColumns.title}
                    onChange={(e) => setPdfColumns({...pdfColumns, title: e.target.checked})}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-foreground">Título</span>
                </label>
                
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={pdfColumns.description}
                    onChange={(e) => setPdfColumns({...pdfColumns, description: e.target.checked})}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-foreground">Descrição</span>
                </label>
                
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={pdfColumns.deliveryDate}
                    onChange={(e) => setPdfColumns({...pdfColumns, deliveryDate: e.target.checked})}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-foreground">Data Entrega</span>
                </label>
                
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={pdfColumns.cost}
                    onChange={(e) => setPdfColumns({...pdfColumns, cost: e.target.checked})}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-foreground">Custo</span>
                </label>
                
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={pdfColumns.status}
                    onChange={(e) => setPdfColumns({...pdfColumns, status: e.target.checked})}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-foreground">Status</span>
                </label>
                
                <label className="flex items-center gap-2 col-span-2">
                  <input
                    type="checkbox"
                    checked={pdfColumns.observations}
                    onChange={(e) => setPdfColumns({...pdfColumns, observations: e.target.checked})}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-foreground">Observações</span>
                </label>
              </div>
            </div>

            {/* Textos personalizados */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Textos Personalizados</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Cabeçalho (opcional)
                  </label>
                  <input
                    type="text"
                    value={pdfHeaderText}
                    onChange={(e) => setPdfHeaderText(e.target.value)}
                    className="input-soft"
                    placeholder="Ex: Relatório Interno - Confidencial"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Rodapé (opcional)
                  </label>
                  <input
                    type="text"
                    value={pdfFooterText}
                    onChange={(e) => setPdfFooterText(e.target.value)}
                    className="input-soft"
                    placeholder="Ex: Gerado por TaskManager - Confidencial"
                  />
                </div>
              </div>
            </div>

            {/* Botões */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setShowPdfModal(false)}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={exportPDF}
                className="btn-primary flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Gerar PDF
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}
