'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, FormEvent } from 'react';import { useUI } from '@/contexts/UIContext';import Modal from '@/components/Modal';
import { z } from 'zod';

interface Client {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  active: boolean;
  // Campos de hierarquia
  parentId?: string | null;
  path?: string[];
  depth?: number;
  rootClientId?: string | null;
  childrenCount?: number;
  children?: Client[]; // Para estrutura em árvore
  createdAt: string;
}

// Schema de validação com Zod
const clientSchema = z.object({
  name: z.string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres'),
  parentId: z.string().nullable().optional(),
  phone: z.string()
    .optional()
    .refine((val) => !val || /^\(\d{2}\)\s\d{4,5}-\d{4}$/.test(val), {
      message: 'Telefone deve estar no formato (00) 00000-0000'
    }),
  email: z.string()
    .optional()
    .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
      message: 'E-mail deve ser válido'
    }),
  address: z.string()
    .max(255, 'Endereço deve ter no máximo 255 caracteres')
    .optional(),
  active: z.boolean(),
});

type ClientFormData = z.infer<typeof clientSchema>;

export default function ClientsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { density } = useUI();
  const isCompact = density === 'compact';
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsTree, setClientsTree] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  
  // Ordenação
  const [sortColumn, setSortColumn] = useState<'name' | 'email'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  const [form, setForm] = useState({
    name: '',
    parentId: null as string | null,
    phone: '',
    email: '',
    address: '',
    active: true,
  });

  const [validationErrors, setValidationErrors] = useState<Partial<Record<keyof ClientFormData, string>>>({});

  const userRole = (session?.user as any)?.role || 'user';
  const canDelete = userRole === 'rootAdmin';

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      loadClients();
    }
  }, [status, router]);

  // Função para ordenar clientes
  const getSortedClients = () => {
    return [...clients].sort((a, b) => {
      let aValue: string, bValue: string;

      switch (sortColumn) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'email':
          aValue = (a.email || '').toLowerCase();
          bValue = (b.email || '').toLowerCase();
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
  const handleSort = (column: 'name' | 'email') => {
    if (sortColumn === column) {
      // Se já está ordenando por esta coluna, alterna a direção
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Nova coluna, começa com ascendente
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Função para renderizar ícone de ordenação
  const renderSortIcon = (column: 'name' | 'email') => {
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

  const loadClients = async () => {
    try {
      // Carregar lista plana e em árvore
      const [resFlat, resTree] = await Promise.all([
        fetch('/api/clients'),
        fetch('/api/clients?tree=true')
      ]);
      const dataFlat = await resFlat.json();
      const dataTree = await resTree.json();
      setClients(dataFlat.clients || []);
      setClientsTree(dataTree.clients || []);
      
      // Expandir todos os clientes raiz por padrão
      const rootIds = (dataTree.clients || []).map((c: Client) => c._id);
      setExpandedClients(new Set(rootIds));
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setLoading(false);
    }
  };

  // Toggle expandir/colapsar cliente
  const toggleExpand = (clientId: string) => {
    setExpandedClients(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clientId)) {
        newSet.delete(clientId);
      } else {
        newSet.add(clientId);
      }
      return newSet;
    });
  };

  const openNewModal = (parentId?: string | null) => {
    setEditingClient(null);
    setForm({
      name: '',
      parentId: parentId || null,
      phone: '',
      email: '',
      address: '',
      active: true,
    });
    setValidationErrors({});
    setShowModal(true);
  };

  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setForm({
      name: client.name,
      parentId: client.parentId || null,
      phone: client.phone || '',
      email: client.email || '',
      address: client.address || '',
      active: client.active,
    });
    setValidationErrors({});
    setShowModal(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    // Validar dados com Zod
    const validationResult = clientSchema.safeParse(form);
    
    if (!validationResult.success) {
      // Extrair erros de validação
      const errors: Partial<Record<keyof ClientFormData, string>> = {};
      validationResult.error.issues.forEach((error) => {
        const field = error.path[0] as keyof ClientFormData;
        errors[field] = error.message;
      });
      setValidationErrors(errors);
      return;
    }
    
    // Limpar erros se validação passou
    setValidationErrors({});
    setSaving(true);
    
    try {
      const url = editingClient 
        ? `/api/clients/${editingClient._id}` 
        : '/api/clients';
      
      // Preparar dados para envio (incluir parentId se for novo cliente)
      const dataToSend = editingClient 
        ? { name: form.name, phone: form.phone, email: form.email, address: form.address, active: form.active }
        : { ...form, parentId: form.parentId || null };
      
      const res = await fetch(url, {
        method: editingClient ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend),
      });
      
      if (res.ok) {
        setShowModal(false);
        loadClients();
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao salvar cliente');
      }
    } catch (error) {
      console.error('Error saving client:', error);
      alert('Erro ao salvar cliente');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, hasChildren: boolean = false) => {
    const client = clients.find(c => c._id === id);
    const childrenCount = client?.childrenCount || 0;
    
    if (childrenCount > 0) {
      const confirmCascade = confirm(
        `Este cliente possui ${childrenCount} sub-cliente(s).\n\n` +
        `Deseja excluir o cliente E todos os sub-clientes?\n\n` +
        `Clique em OK para excluir tudo ou Cancelar para abortar.`
      );
      if (!confirmCascade) return;
      
      setDeleting(id);
      try {
        const res = await fetch(`/api/clients/${id}?cascade=true`, {
          method: 'DELETE',
        });
        
        if (res.ok) {
          loadClients();
        } else {
          const data = await res.json();
          alert(data.error || 'Erro ao excluir cliente');
        }
      } catch (error) {
        console.error('Error deleting client:', error);
        alert('Erro ao excluir cliente');
      } finally {
        setDeleting(null);
      }
      return;
    }
    
    if (!confirm('Tem certeza que deseja excluir este cliente?')) return;
    
    setDeleting(id);
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: 'DELETE',
      });
      
      if (res.ok) {
        loadClients();
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao excluir cliente');
      }
    } catch (error) {
      console.error('Error deleting client:', error);
      alert('Erro ao excluir cliente');
    } finally {
      setDeleting(null);
    }
  };

  // Função para formatar telefone automaticamente
  const formatPhone = (value: string) => {
    // Remove tudo que não é dígito
    const digits = value.replace(/\D/g, '');
    
    // Aplica a máscara
    if (digits.length <= 11) {
      if (digits.length <= 2) {
        return digits;
      } else if (digits.length <= 6) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
      } else if (digits.length <= 10) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
      } else {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
      }
    }
    
    return value;
  };

  // Função para lidar com mudança nos campos
  const handleFieldChange = (field: keyof typeof form, value: string | boolean | null) => {
    let processedValue = value;
    
    // Formatar telefone automaticamente
    if (field === 'phone' && typeof value === 'string') {
      processedValue = formatPhone(value);
    }
    
    setForm({ ...form, [field]: processedValue });
    
    // Limpar erro do campo quando usuário começa a digitar
    if (validationErrors[field as keyof ClientFormData]) {
      setValidationErrors({ ...validationErrors, [field]: undefined });
    }
  };

  // Função para renderizar linha do cliente com hierarquia
  const renderClientRow = (client: Client, level: number): React.ReactElement => {
    const hasChildren = (client.children && client.children.length > 0) || (client.childrenCount && client.childrenCount > 0);
    const isExpanded = expandedClients.has(client._id);
    const paddingLeft = level * 24;
    
    return (
      <div key={client._id}>
        <div 
          className={`flex items-center gap-3 ${isCompact ? 'py-2 px-3' : 'py-3 px-4'} hover:bg-gray-50 dark:hover:bg-gray-800/30 rounded-lg transition-colors group`}
          style={{ paddingLeft: `${paddingLeft + 12}px` }}
        >
          {/* Expand/Collapse button */}
          <button
            onClick={() => hasChildren && toggleExpand(client._id)}
            className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${
              hasChildren 
                ? 'hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer' 
                : 'cursor-default'
            }`}
          >
            {hasChildren ? (
              <svg 
                className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            ) : (
              <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" />
            )}
          </button>
          
          {/* Ícone de pasta/documento */}
          <div className={`p-1.5 rounded-lg ${hasChildren ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-gray-100 dark:bg-gray-800'}`}>
            {hasChildren ? (
              <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            )}
          </div>
          
          {/* Info do cliente */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground truncate">{client.name}</span>
              {level > 0 && (
                <span className="text-xs text-muted-foreground bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                  Sub-cliente
                </span>
              )}
              {!client.active && (
                <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                  Inativo
                </span>
              )}
            </div>
            {(client.email || client.phone) && (
              <div className="text-xs text-muted-foreground mt-0.5 truncate">
                {client.email}{client.email && client.phone ? ' • ' : ''}{client.phone}
              </div>
            )}
          </div>
          
          {/* Ações */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Adicionar sub-cliente */}
            <button
              onClick={() => openNewModal(client._id)}
              className="p-1.5 text-muted-foreground hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors dark:hover:text-green-400 dark:hover:bg-green-950/30"
              title="Adicionar sub-cliente"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            
            {/* Editar */}
            <button
              onClick={() => openEditModal(client)}
              className="p-1.5 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors dark:hover:text-blue-400 dark:hover:bg-blue-950/30"
              title="Editar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            
            {/* Excluir */}
            {canDelete && (
              <button
                onClick={() => handleDelete(client._id)}
                disabled={deleting === client._id}
                className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors dark:hover:text-red-400 dark:hover:bg-red-950/30 disabled:opacity-50"
                title="Excluir"
              >
                {deleting === client._id ? (
                  <div className="w-4 h-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                )}
              </button>
            )}
          </div>
        </div>
        
        {/* Filhos recursivamente */}
        {isExpanded && client.children && client.children.length > 0 && (
          <div className="border-l-2 border-gray-200 dark:border-gray-700 ml-6">
            {client.children.map(child => renderClientRow(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  // Obter nome do cliente pai
  const getParentClientName = (parentId: string | null): string => {
    if (!parentId) return '';
    const parent = clients.find(c => c._id === parentId);
    return parent?.name || '';
  };

  // Construir opções hierárquicas para select de cliente pai
  const buildParentOptions = (clientList: Client[], level: number = 0, excludeId?: string): React.ReactElement[] => {
    const options: React.ReactElement[] = [];
    
    clientList.forEach(client => {
      // Não mostrar o próprio cliente ou seus descendentes como opção de pai
      if (excludeId && (client._id === excludeId || (client.path && client.path.includes(excludeId)))) {
        return;
      }
      
      const prefix = '—'.repeat(level);
      options.push(
        <option key={client._id} value={client._id}>
          {prefix}{prefix ? ' ' : ''}{client.name}
        </option>
      );
      
      if (client.children && client.children.length > 0) {
        options.push(...buildParentOptions(client.children, level + 1, excludeId));
      }
    });
    
    return options;
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
      {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 density-header-mb">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Clientes
            </h1>
            <p className="text-muted-foreground">
              Gerencie seus clientes e sub-clientes
            </p>
          </div>
          <button
            onClick={() => openNewModal()}
            className="btn-primary flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-start"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Novo Cliente
          </button>
        </div>

        {/* Lista em Árvore */}
        <div className={`card-soft overflow-hidden ${isCompact ? 'p-3' : 'p-6'}`}>
          <div className="space-y-1">
            {clientsTree.length === 0 ? (
              <div className={`text-center text-muted-foreground ${isCompact ? 'py-8' : 'py-12'}`}>
                Nenhum cliente cadastrado
              </div>
            ) : (
              clientsTree.map(client => renderClientRow(client, 0))
            )}
          </div>
        </div>

        {/* Modal */}
        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title={editingClient ? 'Editar Cliente' : (form.parentId ? `Novo Sub-cliente de ${getParentClientName(form.parentId)}` : 'Novo Cliente')}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Cliente Pai - apenas para novo cliente ou se já tem parentId */}
            {(!editingClient || editingClient.parentId) && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Cliente Pai {!form.parentId && '(opcional)'}
                </label>
                <select
                  value={form.parentId || ''}
                  onChange={(e) => handleFieldChange('parentId', e.target.value || null)}
                  className="input-soft"
                >
                  <option value="">Nenhum (Cliente Direto)</option>
                  {buildParentOptions(clientsTree, 0, editingClient?._id)}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  Deixe vazio para criar um cliente direto ou selecione um cliente existente para criar um sub-cliente.
                </p>
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Nome *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                className={`input-soft ${validationErrors.name ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                placeholder={form.parentId ? 'Nome do sub-cliente' : 'Nome do cliente'}
              />
              {validationErrors.name && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {validationErrors.name}
                </p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Telefone
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => handleFieldChange('phone', e.target.value)}
                className={`input-soft ${validationErrors.phone ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                placeholder="(00) 00000-0000"
                maxLength={15}
              />
              {validationErrors.phone && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {validationErrors.phone}
                </p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                E-mail
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => handleFieldChange('email', e.target.value)}
                className={`input-soft ${validationErrors.email ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                placeholder="email@exemplo.com"
              />
              {validationErrors.email && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {validationErrors.email}
                </p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Endereço
              </label>
              <textarea
                value={form.address}
                onChange={(e) => handleFieldChange('address', e.target.value)}
                className={`input-soft ${validationErrors.address ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                rows={2}
                placeholder="Endereço completo"
              />
              {validationErrors.address && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {validationErrors.address}
                </p>
              )}
            </div>
            
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => handleFieldChange('active', e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Cliente ativo</span>
              </label>
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
  );
}
