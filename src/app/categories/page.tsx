'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, FormEvent } from 'react';import { useUI } from '@/contexts/UIContext';import Modal from '@/components/Modal';

interface Category {
  _id: string;
  name: string;
  description?: string;
  icon: string;
  color: string;
  active: boolean;
  createdAt: string;
}

interface TeamMember {
  _id: string;
  name: string;
  role?: string;
  icon: string;
  color: string;
  active: boolean;
  createdAt: string;
}

const ICONS = ['📋', '💻', '🎨', '📊', '🔧', '📝', '💡', '🚀', '📦', '🎯', '⚡', '🔨'];
const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', 
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
];

const MEMBER_ICONS = ['👤', '👩‍💻', '👨‍💻', '🧑‍💼', '👩‍🎨', '👨‍🔧', '🧑‍🏫', '👩‍💼', '👨‍🎨', '🧑‍💻', '👷', '🦸'];

export default function CategoriesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { density } = useUI();
  const isCompact = density === 'compact';
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  
  const [form, setForm] = useState({
    name: '',
    description: '',
    icon: '📋',
    color: '#3B82F6',
    active: true,
  });

  // Team Members state
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [savingMember, setSavingMember] = useState(false);
  const [deletingMember, setDeletingMember] = useState<string | null>(null);
  
  const [memberForm, setMemberForm] = useState({
    name: '',
    role: '',
    icon: '👤',
    color: '#3B82F6',
    active: true,
  });

  const userRole = (session?.user as any)?.role || 'user';
  const canDelete = userRole === 'rootAdmin';

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      loadCategories();
      loadTeamMembers();
    }
  }, [status, router]);

  const loadCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTeamMembers = async () => {
    try {
      const res = await fetch('/api/team-members');
      const data = await res.json();
      setTeamMembers(data.teamMembers || []);
    } catch (error) {
      console.error('Error loading team members:', error);
    }
  };

  const openNewModal = () => {
    setEditingCategory(null);
    setForm({
      name: '',
      description: '',
      icon: '📋',
      color: '#3B82F6',
      active: true,
    });
    setShowModal(true);
  };

  const openEditModal = (category: Category) => {
    setEditingCategory(category);
    setForm({
      name: category.name,
      description: category.description || '',
      icon: category.icon,
      color: category.color,
      active: category.active,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const url = editingCategory 
        ? `/api/categories/${editingCategory._id}` 
        : '/api/categories';
      
      const res = await fetch(url, {
        method: editingCategory ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      
      if (res.ok) {
        setShowModal(false);
        loadCategories();
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao salvar categoria');
      }
    } catch (error) {
      console.error('Error saving category:', error);
      alert('Erro ao salvar categoria');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta categoria?')) return;
    
    setDeleting(id);
    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: 'DELETE',
      });
      
      if (res.ok) {
        loadCategories();
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao excluir categoria');
      }
    } catch (error) {
      console.error('Error deleting category:', error);
      alert('Erro ao excluir categoria');
    } finally {
      setDeleting(null);
    }
  };

  // Team Member handlers
  const openNewMemberModal = () => {
    setEditingMember(null);
    setMemberForm({
      name: '',
      role: '',
      icon: '👤',
      color: '#3B82F6',
      active: true,
    });
    setShowMemberModal(true);
  };

  const openEditMemberModal = (member: TeamMember) => {
    setEditingMember(member);
    setMemberForm({
      name: member.name,
      role: member.role || '',
      icon: member.icon,
      color: member.color,
      active: member.active,
    });
    setShowMemberModal(true);
  };

  const handleMemberSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSavingMember(true);
    
    try {
      const url = editingMember 
        ? `/api/team-members/${editingMember._id}` 
        : '/api/team-members';
      
      const res = await fetch(url, {
        method: editingMember ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(memberForm),
      });
      
      if (res.ok) {
        setShowMemberModal(false);
        loadTeamMembers();
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao salvar membro da equipe');
      }
    } catch (error) {
      console.error('Error saving team member:', error);
      alert('Erro ao salvar membro da equipe');
    } finally {
      setSavingMember(false);
    }
  };

  const handleDeleteMember = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este membro da equipe?')) return;
    
    setDeletingMember(id);
    try {
      const res = await fetch(`/api/team-members/${id}`, {
        method: 'DELETE',
      });
      
      if (res.ok) {
        loadTeamMembers();
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao excluir membro da equipe');
      }
    } catch (error) {
      console.error('Error deleting team member:', error);
      alert('Erro ao excluir membro da equipe');
    } finally {
      setDeletingMember(null);
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
    <div id="categories-page" className="density-container density-py">
      {/* Header */}
        <header id="categories-header" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 density-header-mb">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Categorias
            </h1>
            <p className="text-muted-foreground">
              Gerencie as categorias de serviços
            </p>
          </div>
          <button
            onClick={openNewModal}
            className="btn-primary flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-start"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nova Categoria
          </button>
        </header>

        {/* Grid de Categorias */}
        <section id="categories-list" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((category) => (
            <div
              key={category._id}
              className={`card-soft flex items-center gap-4 ${isCompact ? 'p-3' : 'p-4'}`}
            >
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
                style={{ backgroundColor: `${category.color}20` }}
              >
                {category.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-foreground truncate">
                  {category.name}
                </h3>
                {category.description && (
                  <p className="text-sm text-muted-foreground truncate">
                    {category.description}
                  </p>
                )}
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs mt-1 ${
                  category.active
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                }`}>
                  {category.active ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => openEditModal(category)}
                  className="p-2 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors dark:hover:text-blue-400 dark:hover:bg-blue-950/30"
                  title="Editar"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                {canDelete && (
                  <button
                    onClick={() => handleDelete(category._id)}
                    disabled={deleting === category._id}
                    className="p-2 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors dark:hover:text-red-400 dark:hover:bg-red-950/30 disabled:opacity-50"
                    title="Excluir"
                  >
                    {deleting === category._id ? (
                      <div className="w-5 h-5 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
          {categories.length === 0 && (
            <div className="col-span-full card-soft p-12 text-center text-muted-foreground">
              Nenhuma categoria cadastrada
            </div>
          )}
        </section>

        {/* Modal */}
        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title={editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Nome *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input-soft"
                placeholder="Nome da categoria"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Descrição
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="input-soft"
                rows={2}
                placeholder="Descrição opcional"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Ícone
              </label>
              <div className="flex flex-wrap gap-2">
                {ICONS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setForm({ ...form, icon })}
                    className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-all ${
                      form.icon === icon
                        ? 'bg-blue-100 ring-2 ring-blue-500 dark:bg-blue-900/30'
                        : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600'
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Cor
              </label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm({ ...form, color })}
                    className={`w-8 h-8 rounded-full transition-all ${
                      form.color === color
                        ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-offset-gray-800'
                        : ''
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Categoria ativa</span>
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

        {/* ========== MEMBROS DA EQUIPE ========== */}
        <div className="mt-12 border-t border-gray-200 dark:border-gray-700 pt-8">
          {/* Header */}
          <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 density-header-mb">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Membros da Equipe
              </h1>
              <p className="text-muted-foreground">
                Gerencie os membros para distribuição de custos
              </p>
            </div>
            <button
              onClick={openNewMemberModal}
              className="btn-primary flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-start"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Novo Membro
            </button>
          </header>

          {/* Grid de Membros */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {teamMembers.map((member) => (
              <div
                key={member._id}
                className={`card-soft flex items-center gap-4 ${isCompact ? 'p-3' : 'p-4'}`}
              >
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
                  style={{ backgroundColor: `${member.color}20` }}
                >
                  {member.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-foreground truncate">
                    {member.name}
                  </h3>
                  {member.role && (
                    <p className="text-sm text-muted-foreground truncate">
                      {member.role}
                    </p>
                  )}
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs mt-1 ${
                    member.active
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                  }`}>
                    {member.active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditMemberModal(member)}
                    className="p-2 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors dark:hover:text-blue-400 dark:hover:bg-blue-950/30"
                    title="Editar"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  {canDelete && (
                    <button
                      onClick={() => handleDeleteMember(member._id)}
                      disabled={deletingMember === member._id}
                      className="p-2 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors dark:hover:text-red-400 dark:hover:bg-red-950/30 disabled:opacity-50"
                      title="Excluir"
                    >
                      {deletingMember === member._id ? (
                        <div className="w-5 h-5 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {teamMembers.length === 0 && (
              <div className="col-span-full card-soft p-12 text-center text-muted-foreground">
                Nenhum membro da equipe cadastrado
              </div>
            )}
          </section>
        </div>

        {/* Modal Membro da Equipe */}
        <Modal
          isOpen={showMemberModal}
          onClose={() => setShowMemberModal(false)}
          title={editingMember ? 'Editar Membro' : 'Novo Membro da Equipe'}
        >
          <form onSubmit={handleMemberSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Nome *
              </label>
              <input
                type="text"
                value={memberForm.name}
                onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
                className="input-soft"
                placeholder="Nome do membro"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Cargo / Função
              </label>
              <input
                type="text"
                value={memberForm.role}
                onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value })}
                className="input-soft"
                placeholder="Ex: Desenvolvedor, Designer..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Ícone
              </label>
              <div className="flex flex-wrap gap-2">
                {MEMBER_ICONS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setMemberForm({ ...memberForm, icon })}
                    className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-all ${
                      memberForm.icon === icon
                        ? 'bg-blue-100 ring-2 ring-blue-500 dark:bg-blue-900/30'
                        : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600'
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Cor
              </label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setMemberForm({ ...memberForm, color })}
                    className={`w-8 h-8 rounded-full transition-all ${
                      memberForm.color === color
                        ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-offset-gray-800'
                        : ''
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={memberForm.active}
                  onChange={(e) => setMemberForm({ ...memberForm, active: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Membro ativo</span>
              </label>
            </div>
            
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowMemberModal(false)}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingMember}
                className="btn-primary"
              >
                {savingMember ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </Modal>
      </div>
  );
}
