'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function MaintenancePage() {
  const router = useRouter();
  const [checking, setChecking] = useState(false);

  // Verificar periodicamente se manutenção foi desativada
  useEffect(() => {
    const checkMaintenanceStatus = async () => {
      try {
        const res = await fetch('/api/settings/maintenance');
        const data = await res.json();
        
        if (!data.enabled) {
          // Manutenção desativada, redirecionar para home
          router.push('/');
        }
      } catch (err) {
        console.error('Erro ao verificar status:', err);
      }
    };

    // Verificar a cada 30 segundos
    const interval = setInterval(checkMaintenanceStatus, 30000);
    
    return () => clearInterval(interval);
  }, [router]);

  const handleCheckNow = async () => {
    setChecking(true);
    try {
      const res = await fetch('/api/settings/maintenance');
      const data = await res.json();
      
      if (!data.enabled) {
        router.push('/');
      } else {
        alert('O sistema ainda está em manutenção. Por favor, aguarde.');
      }
    } catch (err) {
      console.error('Erro ao verificar status:', err);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-md w-full text-center p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-xl">
        {/* Ícone de manutenção */}
        <div className="mb-6 relative">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-32 bg-yellow-100 dark:bg-yellow-900/30 rounded-full animate-pulse"></div>
          </div>
          <svg 
            className="relative mx-auto h-24 w-24 text-yellow-500" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={1.5} 
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" 
            />
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={1.5} 
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" 
            />
          </svg>
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Sistema em Manutenção
        </h1>
        
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Estamos realizando melhorias no sistema para proporcionar uma experiência ainda melhor. 
          Por favor, tente novamente em alguns minutos.
        </p>
        
        {/* Informações adicionais */}
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Verificando status automaticamente...
          </div>
        </div>
        
        {/* Botão para verificar agora */}
        <button
          onClick={handleCheckNow}
          disabled={checking}
          className="w-full mb-4 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {checking ? (
            <>
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Verificando...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Verificar Agora
            </>
          )}
        </button>

        {/* Link para administradores */}
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
            <strong>Administradores:</strong> Faça login para acessar durante a manutenção.
          </p>
          <a 
            href="/login" 
            className="inline-flex items-center gap-1 text-sm font-medium text-yellow-700 dark:text-yellow-300 hover:underline"
          >
            Ir para login
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>

        {/* Rodapé */}
        <p className="mt-6 text-xs text-gray-400 dark:text-gray-500">
          Agradecemos sua compreensão e paciência.
        </p>
      </div>
    </div>
  );
}
