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
  createdAt: string;
}

// Schema de validação com Zod
const clientSchema = z.object({
  name: z.string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres'),
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
  const { isCompact } = useUI();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  
  // Ordenação
  const [sortColumn, setSortColumn] = useState<'name' | 'email'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  const [form, setForm] = useState({
    name: '',
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
      const res = await fetch('/api/clients');
      const data = await res.json();
      setClients(data.clients || []);
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const openNewModal = () => {
    setEditingClient(null);
    setForm({
      name: '',
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
      
      const res = await fetch(url, {
        method: editingClient ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
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

  const handleDelete = async (id: string) => {
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
  const handleFieldChange = (field: keyof typeof form, value: string | boolean) => {
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

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${isCompact ? 'py-4' : 'py-8'}`}>
      {/* Header */}
        <div className={`flex items-center justify-between ${isCompact ? 'mb-3' : 'mb-8'}`}>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Clientes
            </h1>
            <p className="text-muted-foreground">
              Gerencie seus clientes
            </p>
          </div>
          <button
            onClick={openNewModal}
            className="btn-primary flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Novo Cliente
          </button>
        </div>

        {/* Lista */}
        <div className={`card-soft overflow-hidden ${isCompact ? 'p-3' : 'p-6'}`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-200">
              <thead className="">
                <tr className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <th className={`whitespace-nowrap ${isCompact ? 'px-3 py-2' : 'px-6 py-3'}`}>
                    <button
                      onClick={() => handleSort('name')}
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      NOME
                      {renderSortIcon('name')}
                    </button>
                  </th>
                  <th className={`whitespace-nowrap ${isCompact ? 'px-3 py-2' : 'px-6 py-3'}`}>TELEFONE</th>
                  <th className={`whitespace-nowrap ${isCompact ? 'px-3 py-2' : 'px-6 py-3'}`}>
                    <button
                      onClick={() => handleSort('email')}
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      E-MAIL
                      {renderSortIcon('email')}
                    </button>
                  </th>
                  <th className={`whitespace-nowrap ${isCompact ? 'px-3 py-2' : 'px-6 py-3'}`}>ENDEREÇO</th>
                  <th className={`whitespace-nowrap ${isCompact ? 'px-3 py-2' : 'px-6 py-3'}`}>STATUS</th>
                  <th className={`text-right whitespace-nowrap ${isCompact ? 'px-3 py-2' : 'px-6 py-3'}`}>AÇÕES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {getSortedClients().map((client) => (
                <tr key={client._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                  <td className={`text-sm whitespace-nowrap ${isCompact ? 'px-3 py-1.5' : 'px-4 py-3'}`}>
                    <span className="font-medium text-foreground">
                      {client.name}
                    </span>
                  </td>
                  <td className={`text-sm whitespace-nowrap text-muted-foreground ${isCompact ? 'px-3 py-1.5' : 'px-4 py-3'}`}>
                    {client.phone || '-'}
                  </td>
                  <td className={`text-sm whitespace-nowrap text-muted-foreground ${isCompact ? 'px-3 py-1.5' : 'px-4 py-3'}`}>
                    {client.email || '-'}
                  </td>
                  <td className={`text-sm whitespace-nowrap text-muted-foreground ${isCompact ? 'px-3 py-1.5' : 'px-4 py-3'}`}>
                    <div className="max-w-xs truncate" title={client.address || ''}>
                      {client.address || '-'}
                    </div>
                  </td>
                  <td className={`whitespace-nowrap ${isCompact ? 'px-3 py-1.5' : 'px-4 py-3'}`}>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      client.active
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {client.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className={`whitespace-nowrap ${isCompact ? 'px-3 py-1.5' : 'px-4 py-3'}`}>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(client)}
                        className="p-2 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors dark:text-muted-foreground dark:hover:text-blue-400 dark:hover:bg-blue-950/30"
                        title="Editar"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(client._id)}
                          disabled={deleting === client._id}
                          className="p-2 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors dark:text-muted-foreground dark:hover:text-red-400 dark:hover:bg-red-950/30 disabled:opacity-50"
                          title="Excluir"
                        >
                          {deleting === client._id ? (
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
              {clients.length === 0 && (
                <tr>
                  <td colSpan={6} className={`text-center text-muted-foreground ${isCompact ? 'px-3 py-8' : 'px-4 py-12'}`}>
                    Nenhum cliente cadastrado
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
          title={editingClient ? 'Editar Cliente' : 'Novo Cliente'}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Nome *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                className={`input-soft ${validationErrors.name ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                placeholder="Nome do cliente"
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
