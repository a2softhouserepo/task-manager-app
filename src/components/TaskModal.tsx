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

interface TeamMember {
  _id: string;
  name: string;
  role?: string;
  icon: string;
  color: string;
  active: boolean;
}

interface CostDistributionItem {
  teamMemberId: string;
  teamMemberName: string;
  value: number;
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
  asanaSynced?: boolean;
  asanaTaskGid?: string;
  costDistribution?: CostDistributionItem[];
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
  costDistribution: CostDistributionItem[];
}

interface AsanaConfig {
  allowedTypes: string[];
  maxSizeMB: number;
  maxFiles: number;
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
  { value: 'qa', label: 'Em QA' },
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
  costDistribution: [],
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
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [attachmentWarning, setAttachmentWarning] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [asanaConfig, setAsanaConfig] = useState<AsanaConfig>({
    allowedTypes: ['.zip'],
    maxSizeMB: 10,
    maxFiles: 5,
  });

  // Fetch Asana config and team members on mount
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/settings/asana');
        if (res.ok) {
          const data = await res.json();
          setAsanaConfig({
            allowedTypes: data.allowedTypes || ['.zip'],
            maxSizeMB: data.maxSizeMB || 10,
            maxFiles: data.maxFiles || 5,
          });
        }
      } catch (error) {
        console.error('Error fetching Asana config:', error);
      }
    };
    const fetchTeamMembers = async () => {
      try {
        const res = await fetch('/api/team-members?active=true');
        if (res.ok) {
          const data = await res.json();
          setTeamMembers(data.teamMembers || []);
        }
      } catch (error) {
        console.error('Error fetching team members:', error);
      }
    };
    fetchConfig();
    fetchTeamMembers();
  }, []);

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
          sendToAsana: !!editingTask.asanaTaskGid, // true se já sincronizada, false se não
          costDistribution: editingTask.costDistribution || [],
        });
      } else {
        setForm(getInitialFormState());
      }
      setAttachments([]);
      setAttachmentWarning(null);
      setSelectedMemberId('');
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
    setAttachmentWarning(null);
    
    try {
      const url = editingTask 
        ? `/api/tasks/${editingTask._id}` 
        : '/api/tasks';
      
      let res: Response;
      
      // Validar se há pelo menos 1 membro de equipe
      if (form.costDistribution.length === 0) {
        alert('É obrigatório associar pelo menos 1 membro da equipe à tarefa');
        setSaving(false);
        return;
      }
      
      // Validar distribuição de custo antes de enviar
      if (form.costDistribution.length > 0) {
        const distributionSum = Math.round(form.costDistribution.reduce((sum, d) => sum + d.value, 0) * 10) / 10;
        const costValue = Math.round(Number(form.cost) * 10) / 10;
        if (distributionSum !== costValue) {
          alert(`A soma da distribuição (${distributionSum}) deve ser igual ao custo total (${costValue})`);
          setSaving(false);
          return;
        }
      }

      // Usar FormData quando há anexos e vai enviar para Asana
      if (attachments.length > 0 && form.sendToAsana) {
        setUploadingAttachments(true);
        
        const formData = new FormData();
        
        // Adiciona todos os campos do formulário
        Object.entries(form).forEach(([key, value]) => {
          if (key === 'costDistribution') return; // handled separately
          if (value !== undefined && value !== null && value !== '') {
            formData.append(key, value.toString());
          }
        });
        formData.append('cost', Number(form.cost).toString());
        
        // Adiciona costDistribution como JSON string
        if (form.costDistribution.length > 0) {
          formData.append('costDistribution', JSON.stringify(form.costDistribution));
        }
        
        // Adiciona os arquivos
        attachments.forEach((file) => {
          formData.append('attachments', file);
        });
        
        res = await fetch(url, {
          method: editingTask ? 'PUT' : 'POST',
          body: formData,
        });
        
        setUploadingAttachments(false);
      } else {
        // Usa JSON normal quando não há anexos
        res = await fetch(url, {
          method: editingTask ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...form,
            cost: Number(form.cost),
            costDistribution: form.costDistribution.length > 0 ? form.costDistribution : editingTask ? [] : undefined,
          }),
        });
      }
      
      const data = await res.json();
      
      if (res.ok) {
        // Verificar se houve erros nos anexos
        if (data.attachmentErrors && data.attachmentErrors.length > 0) {
          setAttachmentWarning(data.warning || `Alguns anexos falharam: ${data.attachmentErrors.join(', ')}`);
          // Não fechar o modal imediatamente para mostrar o aviso
          setTimeout(() => {
            onClose();
            onSuccess();
          }, 3000);
        } else {
          onClose();
          onSuccess();
        }
      } else {
        alert(data.error || 'Erro ao salvar tarefa');
      }
    } catch (error) {
      console.error('Error saving task:', error);
      alert('Erro ao salvar tarefa');
    } finally {
      setSaving(false);
      setUploadingAttachments(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // Validar quantidade
    if (files.length > asanaConfig.maxFiles) {
      alert(`Máximo de ${asanaConfig.maxFiles} arquivos permitidos`);
      return;
    }
    
    // Validar tamanho
    const maxSizeBytes = asanaConfig.maxSizeMB * 1024 * 1024;
    const oversized = files.find(f => f.size > maxSizeBytes);
    if (oversized) {
      alert(`Arquivo ${oversized.name} excede ${asanaConfig.maxSizeMB}MB`);
      return;
    }
    
    // Validar tipo de arquivo (extensão)
    if (asanaConfig.allowedTypes.length > 0) {
      for (const file of files) {
        const ext = '.' + file.name.split('.').pop()?.toLowerCase();
        if (!asanaConfig.allowedTypes.includes(ext)) {
          alert(`Tipo de arquivo não permitido: ${file.name}\nPermitidos: ${asanaConfig.allowedTypes.join(', ')}`);
          return;
        }
      }
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
              step="0.1"
              min="0"
              value={form.cost.toFixed(1)}
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
            {editingTask?.asanaTaskGid ? (
              <div className="flex items-center gap-2 px-2 py-1 bg-green-100 dark:bg-green-900/30 rounded text-sm text-green-700 dark:text-green-400">
                ✅ Sincronizado com Asana
              </div>
            ) : (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.sendToAsana}
                  onChange={(e) => setForm({ ...form, sendToAsana: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-muted-foreground">
                  Enviar para Asana
                </span>
              </label>
            )}
          </div>
        </div>
        
        {/* Distribuição de Custo por Membro */}
        {form.cost > 0 && teamMembers.length > 0 && (
          <div className={`border rounded-lg p-4 space-y-3 ${
            form.costDistribution.length === 0 
              ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20' 
              : 'border-gray-200 dark:border-gray-700'
          }`}>
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-foreground">
                Distribuição de Custo <span className={`text-xs ${
                  form.costDistribution.length === 0 
                    ? 'text-red-600 dark:text-red-400 font-semibold' 
                    : 'text-muted-foreground'
                }`}>({form.costDistribution.length === 0 ? 'obrigatório - mínimo 1 membro' : 'obrigatório'})</span>
              </label>
              {form.costDistribution.length > 0 && (
                <span className={`text-xs font-medium px-2 py-1 rounded ${
                  Math.round(form.costDistribution.reduce((s, d) => s + d.value, 0) * 10) / 10 === Math.round(Number(form.cost) * 10) / 10
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  Restante: {(Math.round((Number(form.cost) - form.costDistribution.reduce((s, d) => s + d.value, 0)) * 10) / 10).toFixed(1)}
                </span>
              )}
            </div>
            
            {/* Alerta visual quando não há membros associados */}
            {form.costDistribution.length === 0 && (
              <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg flex items-start gap-2">
                <svg className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-red-800 dark:text-red-300">Atenção</p>
                  <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                    É obrigatório associar pelo menos um membro da equipe à tarefa antes de salvar.
                  </p>
                </div>
              </div>
            )}
            
            {/* Adicionar membro */}
            <div className="flex gap-2">
              <select
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                className="input-soft flex-1"
              >
                <option value="">Selecionar membro...</option>
                {teamMembers
                  .filter(m => !form.costDistribution.find(d => d.teamMemberId === m._id))
                  .map((m) => (
                    <option key={m._id} value={m._id}>{m.icon} {m.name}</option>
                  ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  if (!selectedMemberId) return;
                  const member = teamMembers.find(m => m._id === selectedMemberId);
                  if (!member) return;
                  setForm({
                    ...form,
                    costDistribution: [
                      ...form.costDistribution,
                      {
                        teamMemberId: member._id,
                        teamMemberName: member.name,
                        value: 0.1,
                      }
                    ]
                  });
                  setSelectedMemberId('');
                }}
                disabled={!selectedMemberId}
                className="btn-primary px-3 py-2 text-sm disabled:opacity-50"
              >
                Adicionar
              </button>
            </div>
            
            {/* Lista de membros com sliders */}
            {form.costDistribution.map((dist, idx) => {
              const member = teamMembers.find(m => m._id === dist.teamMemberId);
              return (
                <div key={dist.teamMemberId} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                  <span className="text-lg" title={member?.role || dist.teamMemberName}>
                    {member?.icon || '👤'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-foreground truncate">
                        {dist.teamMemberName}
                      </span>
                      <span className="text-sm font-bold text-blue-600 dark:text-blue-400 ml-2">
                        {dist.value.toFixed(1)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max={Number(form.cost)}
                      step="0.1"
                      value={dist.value}
                      onChange={(e) => {
                        const newValue = Math.round(parseFloat(e.target.value) * 10) / 10;
                        const newDistribution = [...form.costDistribution];
                        newDistribution[idx] = { ...dist, value: newValue };
                        setForm({ ...form, costDistribution: newDistribution });
                      }}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-blue-600"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setForm({
                        ...form,
                        costDistribution: form.costDistribution.filter((_, i) => i !== idx),
                      });
                    }}
                    className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded dark:hover:bg-red-950/30"
                    title="Remover"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
        
        {/* Anexos para Asana */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Anexos para Asana
            <span className="text-xs text-muted-foreground ml-2">
              (máx. {asanaConfig.maxFiles} arquivos, {asanaConfig.maxSizeMB}MB cada, tipos: {asanaConfig.allowedTypes.join(', ')})
            </span>
          </label>
          <input
            type="file"
            multiple
            accept={asanaConfig.allowedTypes.join(',')}
            disabled={(!form.sendToAsana && !editingTask?.asanaTaskGid) || saving}
            onChange={handleFileChange}
            className="input-soft file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/30 dark:file:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          {!form.sendToAsana && !editingTask?.asanaTaskGid && (
            <p className="text-xs text-muted-foreground mt-1">
              Marque &quot;Enviar para Asana&quot; para habilitar anexos
            </p>
          )}
          {editingTask?.asanaTaskGid && (
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              ℹ️ Novos anexos serão adicionados à tarefa existente no Asana
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
                    disabled={saving}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {/* Feedback de upload em andamento */}
          {uploadingAttachments && (
            <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Enviando anexos para o Asana...
            </div>
          )}
          
          {/* Aviso de erros nos anexos */}
          {attachmentWarning && (
            <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-sm text-yellow-700 dark:text-yellow-300">
              ⚠️ {attachmentWarning}
            </div>
          )}
        </div>
        
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
            disabled={saving || form.costDistribution.length === 0}
            title={form.costDistribution.length === 0 ? 'Adicione pelo menos 1 membro da equipe para continuar' : ''}
            className={`btn-primary ${form.costDistribution.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
