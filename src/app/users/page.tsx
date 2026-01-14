'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, FormEvent } from 'react';import { useUI } from '@/contexts/UIContext';import Modal from '@/components/Modal';
import { formatDateTime } from '@/lib/utils';

interface User {
  _id: string;
  username: string;
  name: string;
  email?: string;
  role: 'rootAdmin' | 'admin' | 'user';
  active: boolean;
  createdAt: string;
  lastLogin?: string;
}

const ROLES = [
  { value: 'user', label: 'Usuário', description: 'Pode visualizar e criar tarefas' },
  { value: 'admin', label: 'Administrador', description: 'Pode gerenciar próprios registros' },
  { value: 'rootAdmin', label: 'Root Admin', description: 'Acesso total ao sistema' },
];

export default function UsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { isCompact } = useUI();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  
  const [form, setForm] = useState({
    username: '',
    password: '',
    name: '',
    email: '',
    role: 'user' as 'rootAdmin' | 'admin' | 'user',
    active: true,
  });

  const userRole = (session?.user as any)?.role || 'user';
  const userId = (session?.user as any)?.id;
  const canManageUsers = userRole === 'rootAdmin' || userRole === 'admin';
  const canDelete = userRole === 'rootAdmin';
  const canAssignRoles = userRole === 'rootAdmin';

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      if (!canManageUsers) {
        router.push('/dashboard');
        return;
      }
      loadUsers();
    }
  }, [status, router, canManageUsers]);

  const loadUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const openNewModal = () => {
    setEditingUser(null);
    setForm({
      username: '',
      password: '',
      name: '',
      email: '',
      role: 'user',
      active: true,
    });
    setShowModal(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setForm({
      username: user.username,
      password: '',
      name: user.name,
      email: user.email || '',
      role: user.role,
      active: user.active,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const url = editingUser 
        ? `/api/users/${editingUser._id}` 
        : '/api/users';
      
      const body: any = {
        username: form.username,
        name: form.name,
        email: form.email || undefined,
        active: form.active,
      };
      
      if (canAssignRoles) {
        body.role = form.role;
      }
      
      if (form.password) {
        body.password = form.password;
      }
      
      const res = await fetch(url, {
        method: editingUser ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      if (res.ok) {
        setShowModal(false);
        loadUsers();
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao salvar usuário');
      }
    } catch (error) {
      console.error('Error saving user:', error);
      alert('Erro ao salvar usuário');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (id === userId) {
      alert('Você não pode excluir seu próprio usuário');
      return;
    }
    
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return;
    
    setDeleting(id);
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
      });
      
      if (res.ok) {
        loadUsers();
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao excluir usuário');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Erro ao excluir usuário');
    } finally {
      setDeleting(null);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'rootAdmin':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      case 'admin':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400';
    }
  };

  const getRoleLabel = (role: string) => {
    return ROLES.find(r => r.value === role)?.label || role;
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
              Usuários
            </h1>
            <p className="text-muted-foreground">
              Gerencie os usuários do sistema
            </p>
          </div>
          <button
            onClick={openNewModal}
            className="btn-primary flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Novo Usuário
          </button>
        </div>

        {/* Lista */}
        <div className={`card-soft overflow-hidden ${isCompact ? 'p-3' : 'p-6'}`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="">
                <tr className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <th className={`${isCompact ? 'px-3 py-2' : 'px-6 py-3'}`}>USUÁRIO</th>
                  <th className={`${isCompact ? 'px-3 py-2' : 'px-6 py-3'}`}>NOME</th>
                  <th className={`${isCompact ? 'px-3 py-2' : 'px-6 py-3'}`}>E-MAIL</th>
                  <th className={`${isCompact ? 'px-3 py-2' : 'px-6 py-3'}`}>PAPEL</th>
                  <th className={`${isCompact ? 'px-3 py-2' : 'px-6 py-3'}`}>STATUS</th>
                  <th className={`${isCompact ? 'px-3 py-2' : 'px-6 py-3'}`}>ÚLTIMO LOGIN</th>
                  <th className={`text-right ${isCompact ? 'px-3 py-2' : 'px-6 py-3'}`}>AÇÕES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {users.map((user) => (
                  <tr key={user._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className={`text-sm whitespace-nowrap ${isCompact ? 'px-3 py-1.5' : 'px-4 py-3'}`}>
                    <span className="font-medium text-foreground">
                      {user.username}
                    </span>
                  </td>
                  <td className={`text-sm text-muted-foreground ${isCompact ? 'px-3 py-1.5' : 'px-4 py-3'}`}>
                    {user.name}
                  </td>
                  <td className={`text-sm text-muted-foreground ${isCompact ? 'px-3 py-1.5' : 'px-4 py-3'}`}>
                    {user.email || '-'}
                  </td>
                  <td className={`${isCompact ? 'px-3 py-1.5' : 'px-4 py-3'}`}>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadge(user.role)}`}>
                      {getRoleLabel(user.role)}
                    </span>
                  </td>
                  <td className={`${isCompact ? 'px-3 py-1.5' : 'px-4 py-3'}`}>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.active
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {user.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className={`text-sm text-muted-foreground whitespace-nowrap ${isCompact ? 'px-3 py-1.5' : 'px-4 py-3'}`}>
                    {user.lastLogin ? formatDateTime(user.lastLogin) : 'Nunca'}
                  </td>
                  <td className={`${isCompact ? 'px-3 py-1.5' : 'px-4 py-3'}`}>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(user)}
                        className="p-2 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors dark:text-muted-foreground dark:hover:text-blue-400 dark:hover:bg-blue-950/30"
                        title="Editar"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      {canDelete && user._id !== userId && (
                        <button
                          onClick={() => handleDelete(user._id)}
                          disabled={deleting === user._id}
                          className="p-2 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors dark:text-muted-foreground dark:hover:text-red-400 dark:hover:bg-red-950/30 disabled:opacity-50"
                          title="Excluir"
                        >
                          {deleting === user._id ? (
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
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} className={`text-center text-muted-foreground ${isCompact ? 'px-3 py-8' : 'px-4 py-12'}`}>
                    Nenhum usuário cadastrado
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
          title={editingUser ? 'Editar Usuário' : 'Novo Usuário'}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Username *
                </label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="input-soft"
                  placeholder="Nome de usuário"
                  required
                  disabled={!!editingUser}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Senha {editingUser ? '(deixe em branco para manter)' : '*'}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="input-soft"
                  placeholder="********"
                  required={!editingUser}
                  minLength={6}
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Nome Completo *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input-soft"
                placeholder="Nome completo"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                E-mail
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="input-soft"
                placeholder="email@exemplo.com"
              />
            </div>
            
            {canAssignRoles && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Papel
                </label>
                <div className="space-y-2">
                  {ROLES.map((role) => (
                    <label
                      key={role.value}
                      className={`flex items-start p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                        form.role === role.value
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value={role.value}
                        checked={form.role === role.value}
                        onChange={(e) => setForm({ ...form, role: e.target.value as any })}
                        className="mt-0.5 mr-3"
                      />
                      <div>
                        <span className="font-medium text-foreground">
                          {role.label}
                        </span>
                        <p className="text-sm text-muted-foreground">
                          {role.description}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
            
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-foreground">Usuário ativo</span>
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
