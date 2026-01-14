'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, FormEvent } from 'react';
import { formatCurrency, formatDate, getMonthName } from '@/lib/utils';
import { useUI } from '@/contexts/UIContext';
import Modal from '@/components/Modal';

interface Task {
  _id: string;
  requestDate: string;
  clientId: string;
  clientName: string;
  categoryId: string;
  categoryName: string;
  title: string;
  description: string;
  deliveryDate?: string;
  cost: number;
  observations?: string;
  status: string;
  asanaEmailSent: boolean;
  createdBy: string;
  createdAt: string;
}

interface Client {
  _id: string;
  name: string;
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
  const { isCompact } = useUI();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  
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
  
  // Form
  const [form, setForm] = useState({
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
  const [attachments, setAttachments] = useState<File[]>([]);

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

  useEffect(() => {
    if (status === 'authenticated') {
      loadTasks();
    }
  }, [filterMonth, filterStartDate, filterEndDate, filterClientId, filterCategoryId, filterStatus, useCustomPeriod]);

  const loadData = async () => {
    try {
      const [clientsRes, categoriesRes] = await Promise.all([
        fetch('/api/clients?active=true'),
        fetch('/api/categories?active=true'),
      ]);
      
      const [clientsData, categoriesData] = await Promise.all([
        clientsRes.json(),
        categoriesRes.json(),
      ]);
      
      setClients(clientsData.clients || []);
      setCategories(categoriesData.categories || []);
      
      await loadTasks();
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTasks = async () => {
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
      setTasks(data.tasks || []);
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  };

  // Função para ordenar tarefas
  const getSortedTasks = () => {
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
  };

  // Função para lidar com clique nos cabeçalhos
  const handleSort = (column: 'requestDate' | 'clientName' | 'title' | 'cost') => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
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
    setForm({
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
    setAttachments([]);
    setShowModal(true);
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setForm({
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
    setAttachments([]);
    setShowModal(true);
  };

  const openViewModal = (task: Task) => {
    setViewingTask(task);
    setShowViewModal(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const url = editingTask 
        ? `/api/tasks/${editingTask._id}` 
        : '/api/tasks';
      
      // Se não está editando e tem anexos, usa FormData
      if (!editingTask && attachments.length > 0 && form.sendToAsana) {
        const formData = new FormData();
        
        // Adiciona todos os campos do formulário
        Object.entries(form).forEach(([key, value]) => {
          formData.append(key, value.toString());
        });
        formData.append('cost', Number(form.cost).toString());
        
        // Adiciona os arquivos
        attachments.forEach((file) => {
          formData.append('attachments', file);
        });
        
        const res = await fetch(url, {
          method: 'POST',
          body: formData,
        });
        
        if (res.ok) {
          setShowModal(false);
          setAttachments([]);
          loadTasks();
        } else {
          const data = await res.json();
          alert(data.error || 'Erro ao salvar tarefa');
        }
      } else {
        // Usa JSON normal para edição ou quando não há anexos
        const res = await fetch(url, {
          method: editingTask ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...form,
            cost: Number(form.cost),
          }),
        });
        
        if (res.ok) {
          setShowModal(false);
          setAttachments([]);
          loadTasks();
        } else {
          const data = await res.json();
          alert(data.error || 'Erro ao salvar tarefa');
        }
      }
    } catch (error) {
      console.error('Error saving task:', error);
      alert('Erro ao salvar tarefa');
    } finally {
      setSaving(false);
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

  const exportPDF = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      
      const doc = new jsPDF('landscape');
      
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
        doc.text(filterText.replace(/\| $/, ''), 14, 36);
      }
      
      // Total
      const total = tasks.reduce((sum, t) => sum + t.cost, 0);
      doc.text(`Total: ${formatCurrency(total)} (${tasks.length} tarefas)`, 14, filterText ? 42 : 36);
      
      // Tabela
      const tableData = tasks.map(task => [
        formatDate(task.requestDate),
        task.categoryName,
        task.clientName,
        task.title,
        task.description.substring(0, 60) + (task.description.length > 60 ? '...' : ''),
        task.deliveryDate ? formatDate(task.deliveryDate) : '-',
        formatCurrency(task.cost),
        getStatusBadge(task.status).label,
        task.observations?.substring(0, 40) || '-',
      ]);
      
      autoTable(doc, {
        startY: filterText ? 48 : 42,
        head: [['Data Sol.', 'Categoria', 'Cliente', 'Título', 'Entrega', 'Custo', 'Status', 'Observações']],
        body: tableData,
        styles: { fontSize: 7 },
        headStyles: { fillColor: [59, 130, 246] },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 25 },
          2: { cellWidth: 30 },
          3: { cellWidth: 30 },
          4: { cellWidth: 50 },
          5: { cellWidth: 22 },
          6: { cellWidth: 22 },
          7: { cellWidth: 22 },
          8: { cellWidth: 40 },
        },
      });
      
      doc.save(`relatorio-tarefas-${filterMonth || 'custom'}.pdf`);
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
    <div className="min-h-screen">
      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${isCompact ? 'py-4' : 'py-8'}`}>
        {/* Header */}
        <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between ${isCompact ? 'mb-3' : 'mb-6'}`}>
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
              onClick={exportPDF}
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
        </div>

        {/* Filtros */}
        <div className={`card-soft ${isCompact ? 'p-3 mb-3' : 'p-6 mb-6'}`}>
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-lg font-semibold text-foreground whitespace-nowrap">
              Tarefas do Período
            </h3>
            <div className="flex items-center gap-3 flex-1 justify-end overflow-x-auto">
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
                    className="input-soft w-auto"
                    placeholder="Data início"
                  />
                  <input
                    type="date"
                    value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                    className="input-soft w-auto"
                    placeholder="Data fim"
                  />
                </>
              ) : (
                <input
                  type="month"
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="input-soft w-auto"
                />
              )}
              
              <select
                value={filterClientId}
                onChange={(e) => setFilterClientId(e.target.value)}
                className="input-soft w-auto min-w-[150px]"
              >
                <option value="">Todos os clientes</option>
                {clients.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
              
              <select
                value={filterCategoryId}
                onChange={(e) => setFilterCategoryId(e.target.value)}
                className="input-soft w-auto min-w-[180px]"
              >
                <option value="">Todas as categorias</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>{c.icon} {c.name}</option>
                ))}
              </select>
              
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="input-soft w-auto min-w-[140px]"
              >
                <option value="">Todos os status</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Totalizador */}
        <div className={`bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30 rounded-lg ${isCompact ? 'p-3 mb-3' : 'p-4 mb-4'}`}>
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
        <div className={`card-soft overflow-hidden ${isCompact ? 'p-3' : 'p-6'}`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-200">
              <thead className="">
                <tr className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <th className={`whitespace-nowrap ${isCompact ? 'px-3 py-2' : 'px-6 py-3'}`}>
                    <button
                      onClick={() => handleSort('requestDate')}
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      DATA SOL.
                      {renderSortIcon('requestDate')}
                    </button>
                  </th>
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
                  <th className={`whitespace-nowrap ${isCompact ? 'px-3 py-2' : 'px-6 py-3'}`}>
                    <button
                      onClick={() => handleSort('title')}
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      TÍTULO
                      {renderSortIcon('title')}
                    </button>
                  </th>
                  <th className={`whitespace-nowrap ${isCompact ? 'px-3 py-2' : 'px-6 py-3'}`}>ENTREGA</th>
                  <th className={`text-right whitespace-nowrap ${isCompact ? 'px-3 py-2' : 'px-6 py-3'}`}>
                    <button
                      onClick={() => handleSort('cost')}
                      className="flex items-center gap-1 hover:text-foreground transition-colors ml-auto"
                    >
                      CUSTO
                      {renderSortIcon('cost')}
                    </button>
                  </th>
                  <th className={`whitespace-nowrap ${isCompact ? 'px-3 py-2' : 'px-6 py-3'}`}>STATUS</th>
                  <th className={`text-right whitespace-nowrap ${isCompact ? 'px-3 py-2' : 'px-6 py-3'}`}>AÇÕES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {getSortedTasks().map((task) => (
                  <tr key={task._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors cursor-pointer" onClick={() => openViewModal(task)}>
                    <td className={`text-sm whitespace-nowrap ${isCompact ? 'px-3 py-1.5' : 'px-4 py-3'}`}>
                      <span className="font-medium text-foreground">
                        {formatDate(task.requestDate)}
                      </span>
                    </td>
                    <td className={`text-sm whitespace-nowrap text-muted-foreground ${isCompact ? 'px-3 py-1.5' : 'px-4 py-3'}`}>
                      {task.categoryName}
                    </td>
                    <td className={`text-sm whitespace-nowrap text-muted-foreground ${isCompact ? 'px-3 py-1.5' : 'px-4 py-3'}`}>
                      <div className="max-w-xs truncate" title={task.clientName}>
                        {task.clientName.length > 15 ? `${task.clientName.substring(0, 15)}...` : task.clientName}
                      </div>
                    </td>
                    <td className={`text-sm whitespace-nowrap font-medium text-foreground ${isCompact ? 'px-3 py-1.5' : 'px-4 py-3'}`}>
                      <div className="max-w-xs truncate" title={task.title}>
                        {task.title.length > 35 ? `${task.title.substring(0, 35)}...` : task.title}
                        {task.asanaEmailSent && (
                          <span className="ml-2 text-xs text-blue-600 dark:text-blue-400" title="Enviado para Asana">
                            📧
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={`text-sm whitespace-nowrap text-muted-foreground ${isCompact ? 'px-3 py-1.5' : 'px-4 py-3'}`}>
                      {task.deliveryDate ? formatDate(task.deliveryDate) : '-'}
                    </td>
                    <td className={`text-sm font-medium text-foreground text-right whitespace-nowrap ${isCompact ? 'px-3 py-1.5' : 'px-4 py-3'}`}>
                      {formatCurrency(task.cost)}
                    </td>
                    <td className={`whitespace-nowrap ${isCompact ? 'px-3 py-1.5' : 'px-4 py-3'}`}>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(task.status).color}`}>
                        {getStatusBadge(task.status).label}
                      </span>
                    </td>
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
                    <td colSpan={8} className={`text-center text-muted-foreground ${isCompact ? 'px-3 py-8' : 'px-4 py-12'}`}>
                      Nenhuma tarefa encontrada no período selecionado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

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
                {viewingTask.asanaEmailSent ? (
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

        {/* Modal de Edição */}
        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title={editingTask ? 'Editar Tarefa' : 'Nova Tarefa'}
          size="lg"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Data de Solicitação *
                </label>
                <input
                  type="date"
                  value={form.requestDate}
                  onChange={(e) => setForm({ ...form, requestDate: e.target.value })}
                  className="input-soft"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Data de Entrega
                </label>
                <input
                  type="date"
                  value={form.deliveryDate}
                  onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })}
                  className="input-soft"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Cliente *
                </label>
                <select
                  value={form.clientId}
                  onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                  className="input-soft"
                  required
                >
                  <option value="">Selecione...</option>
                  {clients.map((c) => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Categoria *
                </label>
                <select
                  value={form.categoryId}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
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
              <label className="block text-sm font-medium text-foreground mb-1">
                Título *
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="input-soft"
                placeholder="Título da tarefa"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Descrição *
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="input-soft"
                rows={3}
                placeholder="Descreva a tarefa..."
                required
              />
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Custo (R$) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.cost}
                  onChange={(e) => setForm({ ...form, cost: parseFloat(e.target.value) || 0 })}
                  className="input-soft"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Status
                </label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="input-soft"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.sendToAsana}
                    onChange={(e) => setForm({ ...form, sendToAsana: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-muted-foreground">Enviar Asana</span>
                </label>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Anexos para Asana (máx. 5 arquivos, 10MB cada)
              </label>
              <input
                type="file"
                multiple
                disabled={!form.sendToAsana}
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
                  setAttachments(files);
                }}
                className="input-soft file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/30 dark:file:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {!form.sendToAsana && (
                <p className="text-xs text-muted-foreground mt-1">
                  Marque "Enviar Asana" para habilitar anexos
                </p>
              )}
              {attachments.length > 0 && (
                <div className="mt-2 space-y-1">
                  {attachments.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
                      <button
                        type="button"
                        onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                        className="text-red-600 hover:text-red-700 dark:text-red-400"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Observações
              </label>
              <textarea
                value={form.observations}
                onChange={(e) => setForm({ ...form, observations: e.target.value })}
                className="input-soft"
                rows={2}
                placeholder="Observações adicionais..."
              />
            </div>
            
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="btn-primary"
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </div>
  );
}
