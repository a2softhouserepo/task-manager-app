'use client';

import { SessionProvider, useSession, signOut } from 'next-auth/react';
import { UIProvider, useUI } from '@/contexts/UIContext';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import Header from './Header';
import MobileNav from './MobileNav';

/**
 * Componente que verifica expiração de sessão
 */
function SessionExpirationChecker({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  useEffect(() => {
    if (status === 'authenticated' && (session as any)?.expired) {
      // Sessão expirada - fazer logout e redirecionar
      signOut({ 
        callbackUrl: '/login?expired=true',
        redirect: true 
      });
    }
  }, [session, status, router]);
  
  return <>{children}</>;
}

/**
 * OTIMIZAÇÃO: Cache de verificação de manutenção
 * TTL de 30 segundos - reduz chamadas de API em ~90%
 */
interface MaintenanceCache {
  enabled: boolean;
  timestamp: number;
}
const MAINTENANCE_CACHE_TTL = 30 * 1000; // 30 segundos

/**
 * Componente que verifica modo manutenção
 */
function MaintenanceModeChecker({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const maintenanceCache = useRef<MaintenanceCache | null>(null);
  
  useEffect(() => {
    const checkMaintenance = async () => {
      // Páginas isentas de verificação
      const exemptPages = ['/login', '/maintenance', '/api'];
      if (exemptPages.some(page => pathname.startsWith(page))) {
        setChecking(false);
        return;
      }
      
      // rootAdmin pode acessar durante manutenção
      if ((session?.user as any)?.role === 'rootAdmin') {
        setChecking(false);
        return;
      }
      
      // OTIMIZAÇÃO: Usar cache se válido
      const now = Date.now();
      if (maintenanceCache.current && (now - maintenanceCache.current.timestamp) < MAINTENANCE_CACHE_TTL) {
        if (maintenanceCache.current.enabled) {
          router.push('/maintenance');
          return;
        }
        setChecking(false);
        return;
      }
      
      try {
        const res = await fetch('/api/settings/maintenance', {
          headers: { 'x-internal-request': 'true' }
        });
        
        if (res.ok) {
          const data = await res.json();
          
          // Atualizar cache
          maintenanceCache.current = {
            enabled: data.enabled,
            timestamp: now
          };
          
          if (data.enabled) {
            router.push('/maintenance');
            return;
          }
        }
      } catch (err) {
        console.error('Erro ao verificar modo manutenção:', err);
      }
      
      setChecking(false);
    };
    
    if (status !== 'loading') {
      checkMaintenance();
    }
  }, [pathname, session, status, router]);
  
  // Enquanto verifica, mostrar loading mínimo (apenas se não for página login/manutenção)
  if (checking && status !== 'loading') {
    const exemptPages = ['/login', '/maintenance', '/'];
    if (!exemptPages.some(page => pathname === page)) {
      return null; // Ou um loading spinner se preferir
    }
  }
  
  return <>{children}</>;
}

function AppWrapper({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const { density } = useUI();
  
  // Páginas que não devem ter header
  const publicPages = ['/login', '/register', '/', '/maintenance'];
  const isPublicPage = publicPages.includes(pathname);
  
  // Mostrar header apenas se autenticado e não estiver em página pública
  const showHeader = status === 'authenticated' && !isPublicPage;

  return (
    <div className={`min-h-screen transition-colors duration-300 density-${density}`}>
      {showHeader && (
        <>
          <Header />
          <MobileNav />
        </>
      )}
      <main className="safe-area-bottom">
        {children}
      </main>
    </div>
  );
}

function AppContent({ children }: { children: React.ReactNode }) {
  return (
    <UIProvider>
      <SessionExpirationChecker>
        <MaintenanceModeChecker>
          <AppWrapper>{children}</AppWrapper>
        </MaintenanceModeChecker>
      </SessionExpirationChecker>
    </UIProvider>
  );
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AppContent>{children}</AppContent>
    </SessionProvider>
  );
}
