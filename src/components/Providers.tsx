'use client';

import { SessionProvider, useSession } from 'next-auth/react';
import { UIProvider, useUI } from '@/contexts/UIContext';
import { usePathname } from 'next/navigation';
import Header from './Header';
import MobileNav from './MobileNav';

function AppWrapper({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const { density } = useUI();
  
  // Páginas que não devem ter header
  const publicPages = ['/login', '/register', '/'];
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
      <AppWrapper>{children}</AppWrapper>
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
