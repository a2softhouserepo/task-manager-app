'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface SystemConfig {
  _id: string;
  key: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'json';
  category: 'backup' | 'email' | 'security' | 'general';
  label: string;
  description?: string;
  options?: string[];
  updatedBy: string;
  updatedAt: string;
}

const CATEGORY_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  backup: { label: 'Backup', icon: '💾', color: 'blue' },
  security: { label: 'Segurança', icon: '🔒', color: 'red' },
  email: { label: 'E-mail', icon: '📧', color: 'green' },
  general: { label: 'Geral', icon: '⚙️', color: 'gray' },
};

const CONFIG_CACHE_KEY = 'system_config_cache';
const CONFIG_CACHE_VERSION = 'v1';

// Funções para gerenciar cache no localStorage
function saveConfigCache(configs: SystemConfig[]) {
  try {
    const cacheData = {
      version: CONFIG_CACHE_VERSION,
      timestamp: Date.now(),
      data: configs,
    };
    localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(cacheData));
  } catch (e) {
    console.error('Erro ao salvar cache de configs:', e);
  }
}

function loadConfigCache(): SystemConfig[] | null {
  try {
    const cached = localStorage.getItem(CONFIG_CACHE_KEY);
    if (!cached) return null;
    
    const parsed = JSON.parse(cached);
    if (parsed.version !== CONFIG_CACHE_VERSION) return null;
    
    // Cache válido por 1 hora
    if (Date.now() - parsed.timestamp > 60 * 60 * 1000) return null;
    
    return parsed.data;
  } catch (e) {
    console.error('Erro ao carregar cache de configs:', e);
    return null;
  }
}

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changes, setChanges] = useState<Record<string, any>>({});
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (status === 'authenticated') {
      if ((session.user as any).role !== 'rootAdmin') {
        router.push('/dashboard');
        return;
      }
      loadConfigs();
    } else if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router, session]);

  const loadConfigs = async () => {
    try {
      // Tentar carregar do cache primeiro
      const cached = loadConfigCache();
      if (cached) {
        setConfigs(cached);
        setLoading(false);
      }

      // Buscar do servidor
      const res = await fetch('/api/settings');
      const data = await res.json();
      
      if (data.configs) {
        setConfigs(data.configs);
        saveConfigCache(data.configs);
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleValueChange = (key: string, value: any) => {
    setChanges(prev => ({ ...prev, [key]: value }));
  };

  const hasChanges = Object.keys(changes).length > 0;

  const saveChanges = async () => {
    if (!hasChanges) return;

    setSaving(true);
    setSuccessMessage('');

    try {
      const configsToUpdate = Object.entries(changes).map(([key, value]) => ({
        key,
        value,
      }));

      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configs: configsToUpdate }),
      });

      const data = await res.json();

      if (res.ok) {
        setConfigs(data.configs);
        saveConfigCache(data.configs);
        setChanges({});
        setSuccessMessage('Configurações salvas com sucesso!');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        alert(data.error || 'Erro ao salvar configurações');
      }
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const discardChanges = () => {
    setChanges({});
  };

  const getConfigValue = (config: SystemConfig) => {
    return changes[config.key] !== undefined ? changes[config.key] : config.value;
  };

  const renderConfigInput = (config: SystemConfig) => {
    const value = getConfigValue(config);
    const hasChange = changes[config.key] !== undefined;

    if (config.options && config.options.length > 0) {
      return (
        <select
          value={value}
          onChange={(e) => handleValueChange(config.key, e.target.value)}
          className={`input-soft ${hasChange ? 'ring-2 ring-blue-500' : ''}`}
        >
          {config.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt === 'daily' && 'Diário (24h)'}
              {opt === 'every_login' && 'A cada login'}
              {opt === 'disabled' && 'Desabilitado'}
              {!['daily', 'every_login', 'disabled'].includes(opt) && opt}
            </option>
          ))}
        </select>
      );
    }

    switch (config.type) {
      case 'boolean':
        return (
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={value}
              onChange={(e) => handleValueChange(config.key, e.target.checked)}
              className="sr-only peer"
            />
            <div className={`w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600 ${hasChange ? 'ring-2 ring-blue-500' : ''}`}></div>
          </label>
        );

      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleValueChange(config.key, parseInt(e.target.value) || 0)}
            className={`input-soft w-32 ${hasChange ? 'ring-2 ring-blue-500' : ''}`}
          />
        );

      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleValueChange(config.key, e.target.value)}
            className={`input-soft ${hasChange ? 'ring-2 ring-blue-500' : ''}`}
          />
        );
    }
  };

  // Agrupar configs por categoria
  const configsByCategory = configs.reduce((acc, config) => {
    const cat = config.category || 'general';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(config);
    return acc;
  }, {} as Record<string, SystemConfig[]>);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="density-container density-py">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between density-header-mb">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Configurações do Sistema
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerencie as configurações globais do sistema
            </p>
          </div>

          {hasChanges && (
            <div className="flex items-center gap-3 mt-4 sm:mt-0">
              <button
                onClick={discardChanges}
                className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                Descartar
              </button>
              <button
                onClick={saveChanges}
                disabled={saving}
                className="btn-soft flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Salvar Alterações
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Mensagem de sucesso */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-sm text-green-800 dark:text-green-400 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {successMessage}
            </p>
          </div>
        )}

        {/* Indicador de alterações não salvas */}
        {hasChanges && (
          <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-400 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Você tem {Object.keys(changes).length} alteração(ões) não salva(s)
            </p>
          </div>
        )}

        {/* Configurações por categoria */}
        {configs.length === 0 ? (
          <div className="card-soft p-8 text-center">
            <svg className="w-12 h-12 mx-auto text-muted-foreground mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <h3 className="text-lg font-medium text-foreground mb-2">
              Nenhuma configuração encontrada
            </h3>
            <p className="text-muted-foreground mb-4">
              Execute o script de seed para criar as configurações iniciais.
            </p>
            <code className="block bg-gray-100 dark:bg-gray-800 p-3 rounded-lg text-sm">
              node scripts/seed-config.js
            </code>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(configsByCategory).map(([category, categoryConfigs]) => {
              const catInfo = CATEGORY_LABELS[category] || CATEGORY_LABELS.general;
              
              // Classes condicionais para o header da categoria
              const headerClasses = {
                backup: 'px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/10',
                security: 'px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-red-50 dark:bg-red-900/10',
                email: 'px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-purple-50 dark:bg-purple-900/10',
                general: 'px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/10',
              }[category] || 'px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/10';
              
              return (
                <div key={category} className="card-soft overflow-hidden">
                  <div className={headerClasses}>
                    <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                      <span>{catInfo.icon}</span>
                      {catInfo.label}
                    </h2>
                  </div>
                  
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {categoryConfigs.map((config) => (
                      <div key={config.key} className="px-6 py-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <div className="flex-1">
                            <label className="block text-sm font-medium text-foreground">
                              {config.label}
                            </label>
                            {config.description && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {config.description}
                              </p>
                            )}
                          </div>
                          <div className="sm:w-64">
                            {renderConfigInput(config)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Info box */}
        <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h3 className="text-sm font-medium text-blue-800 dark:text-blue-400 mb-2">
            💡 Informações
          </h3>
          <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
            <li>• As configurações são armazenadas no banco de dados e aplicadas em tempo real.</li>
            <li>• Alterações são registradas no log de auditoria para rastreabilidade.</li>
            <li>• O cache local é atualizado automaticamente após cada alteração.</li>
            <li>• Se uma configuração não existir no banco, o sistema usa o valor padrão do arquivo .env.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
