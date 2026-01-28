'use client';

import { useState, FormEvent, useEffect } from 'react';
import Modal from './Modal';

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
  color?: string;
}

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
  asanaEmailSent?: boolean;
}

interface TaskFormData {
  requestDate: string;
  clientId: string;
  categoryId: string;
  title: string;
  description: string;
  deliveryDate: string;
  cost: number;
  observations: string;
  status: string;
  sendToAsana: boolean;
}

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingTask?: Task | null;
  clientsTree: Client[];
  categories: Category[];
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pendente' },
  { value: 'in_progress', label: 'Em Andamento' },
  { value: 'completed', label: 'Concluída' },
  { value: 'cancelled', label: 'Cancelada' },
];

const getInitialFormState = (): TaskFormData => ({
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

export default function TaskModal({
  isOpen,
  onClose,
  onSuccess,
  editingTask,
  clientsTree,
  categories,
}: TaskModalProps) {
  const [form, setForm] = useState<TaskFormData>(getInitialFormState());
  const [attachments, setAttachments] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  // Reset form when modal opens/closes or editingTask changes
  useEffect(() => {
    if (isOpen) {
      if (editingTask) {
        setForm({
          requestDate: editingTask.requestDate.split('T')[0],
          clientId: editingTask.clientId,
          categoryId: editingTask.categoryId,
          title: editingTask.title,
          description: editingTask.description,
          deliveryDate: editingTask.deliveryDate ? editingTask.deliveryDate.split('T')[0] : '',
          cost: editingTask.cost,
          observations: editingTask.observations || '',
          status: editingTask.status,
          sendToAsana: false, // Default to false when editing
        });
      } else {
        setForm(getInitialFormState());
      }
      setAttachments([]);
    }
  }, [isOpen, editingTask]);

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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const url = editingTask 
        ? `/api/tasks/${editingTask._id}` 
        : '/api/tasks';
      
      let res: Response;
      
      // Se não está editando e tem anexos e vai enviar para Asana, usa FormData
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
        
        res = await fetch(url, {
          method: 'POST',
          body: formData,
        });
      } else {
        // Usa JSON normal para edição ou quando não há anexos
        res = await fetch(url, {
          method: editingTask ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...form,
            cost: Number(form.cost),
          }),
        });
      }
      
      if (res.ok) {
        onClose();
        onSuccess();
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingTask ? 'Editar Tarefa' : 'Nova Tarefa'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Datas */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Data de Solicitação
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
        
        {/* Cliente e Categoria */}
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
              {buildClientOptions(clientsTree)}
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
        
        {/* Título */}
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
        
        {/* Descrição */}
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
        
        {/* Custo, Status e Asana */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Custo (Esforço) *
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
              <span className="text-sm text-muted-foreground">
                {editingTask ? 'Re-enviar Asana' : 'Enviar Asana'}
              </span>
            </label>
          </div>
        </div>
        
        {/* Anexos (apenas para novas tarefas) */}
        {!editingTask && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Anexos para Asana (máx. 5 arquivos, 10MB cada)
            </label>
            <input
              type="file"
              multiple
              disabled={!form.sendToAsana}
              onChange={handleFileChange}
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
                      onClick={() => removeAttachment(idx)}
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
        
        {/* Observações */}
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
        
        {/* Botões */}
        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
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
  );
}
