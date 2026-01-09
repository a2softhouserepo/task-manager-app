'use client';

import { SessionProvider, useSession } from 'next-auth/react';
import { UIProvider } from '@/contexts/UIContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { usePathname } from 'next/navigation';
import Header from './Header';

function AppWrapper({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  
  // Páginas que não devem ter header
  const publicPages = ['/login', '/register', '/'];
  const isPublicPage = publicPages.includes(pathname);
  
  // Mostrar header apenas se autenticado e não estiver em página pública
  const showHeader = status === 'authenticated' && !isPublicPage;

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] transition-colors duration-300">
      {showHeader && <Header />}
      <main>
        {children}
      </main>
    </div>
  );
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <UIProvider>
          <AppWrapper>{children}</AppWrapper>
        </UIProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
