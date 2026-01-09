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
    setShowModal(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const url = editingTask 
        ? `/api/tasks/${editingTask._id}` 
        : '/api/tasks';
      
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
        loadTasks();
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao salvar tarefa');
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
        head: [['Data Sol.', 'Categoria', 'Cliente', 'Título', 'Descrição', 'Entrega', 'Custo', 'Status', 'Observações']],
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
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
        <div className="card-soft p-4 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={useCustomPeriod}
                onChange={(e) => setUseCustomPeriod(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-muted-foreground">Período customizado</span>
            </label>
            
            {useCustomPeriod ? (
              <>
                <input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  className="input-soft !w-auto"
                  placeholder="Data início"
                />
                <input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  className="input-soft !w-auto"
                  placeholder="Data fim"
                />
              </>
            ) : (
              <input
                type="month"
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="input-soft !w-auto"
              />
            )}
            
            <select
              value={filterClientId}
              onChange={(e) => setFilterClientId(e.target.value)}
              className="input-soft !w-auto"
            >
              <option value="">Todos os clientes</option>
              {clients.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
            
            <select
              value={filterCategoryId}
              onChange={(e) => setFilterCategoryId(e.target.value)}
              className="input-soft !w-auto"
            >
              <option value="">Todas as categorias</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>{c.icon} {c.name}</option>
              ))}
            </select>
            
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="input-soft !w-auto"
            >
              <option value="">Todos os status</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Totalizador */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center">
            <span className="text-foreground">
              {tasks.length} tarefa(s) encontrada(s)
            </span>
            <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
              Total: {formatCurrency(totalFiltered)}
            </span>
          </div>
        </div>

        {/* Lista */}
        <div className="card-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr className="text-left text-sm text-muted-foreground">
                  <th className={`px-4 font-medium ${isCompact ? 'py-2' : 'py-3'}`}>Data Sol.</th>
                  <th className={`px-4 font-medium ${isCompact ? 'py-2' : 'py-3'}`}>Categoria</th>
                  <th className={`px-4 font-medium ${isCompact ? 'py-2' : 'py-3'}`}>Cliente</th>
                  <th className={`px-4 font-medium ${isCompact ? 'py-2' : 'py-3'}`}>Título</th>
                  <th className={`px-4 font-medium ${isCompact ? 'py-2' : 'py-3'}`}>Descrição</th>
                  <th className={`px-4 font-medium ${isCompact ? 'py-2' : 'py-3'}`}>Entrega</th>
                  <th className={`px-4 font-medium text-right ${isCompact ? 'py-2' : 'py-3'}`}>Custo</th>
                  <th className={`px-4 font-medium ${isCompact ? 'py-2' : 'py-3'}`}>Status</th>
                  <th className={`px-4 font-medium text-right ${isCompact ? 'py-2' : 'py-3'}`}>Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {tasks.map((task) => (
                  <tr key={task._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                    <td className={`px-4 text-sm text-foreground whitespace-nowrap ${isCompact ? 'py-2' : 'py-3'}`}>
                      {formatDate(task.requestDate)}
                    </td>
                    <td className={`px-4 text-sm text-muted-foreground ${isCompact ? 'py-2' : 'py-3'}`}>
                      {task.categoryName}
                    </td>
                    <td className={`px-4 text-sm text-muted-foreground ${isCompact ? 'py-2' : 'py-3'}`}>
                      {task.clientName}
                    </td>
                    <td className={`px-4 text-sm font-medium text-foreground ${isCompact ? 'py-2' : 'py-3'}`}>
                      {task.title}
                      {task.asanaEmailSent && (
                        <span className="ml-2 text-xs text-purple-600 dark:text-purple-400" title="Enviado para Asana">
                          📧
                        </span>
                      )}
                    </td>
                    <td className={`px-4 text-sm text-muted-foreground max-w-xs truncate ${isCompact ? 'py-2' : 'py-3'}`}>
                      {task.description}
                    </td>
                    <td className={`px-4 text-sm text-muted-foreground whitespace-nowrap ${isCompact ? 'py-2' : 'py-3'}`}>
                      {task.deliveryDate ? formatDate(task.deliveryDate) : '-'}
                    </td>
                    <td className={`px-4 text-sm font-medium text-foreground text-right whitespace-nowrap ${isCompact ? 'py-2' : 'py-3'}`}>
                      {formatCurrency(task.cost)}
                    </td>
                    <td className={`px-4 ${isCompact ? 'py-2' : 'py-3'}`}>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(task.status).color}`}>
                        {getStatusBadge(task.status).label}
                      </span>
                    </td>
                    <td className={`px-4 ${isCompact ? 'py-2' : 'py-3'}`}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditModal(task)}
                          className="p-2 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors dark:hover:text-blue-400 dark:hover:bg-blue-950/30"
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
                            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-950/30 disabled:opacity-50"
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
                    <td colSpan={9} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                      Nenhuma tarefa encontrada no período selecionado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal */}
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
