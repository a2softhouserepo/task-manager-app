'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';
type Density = 'compact' | 'comfortable';

interface UIContextType {
  density: Density;
  isFullWidth: boolean; // true quando density = 'comfortable' (100% viewport)
  toggleDensity: () => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export function UIProvider({ children }: { children: ReactNode }) {
  // 'compact' = container limitado, espaçamento menor
  // 'comfortable' = 100% viewport, espaçamento maior
  const [density, setDensity] = useState<Density>('compact');
  const [theme, setThemeState] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  const isFullWidth = density === 'comfortable';

  // Carrega preferências salvas
  useEffect(() => {
    setMounted(true);
    const savedDensity = localStorage.getItem('ui-density') as Density | null;
    if (savedDensity && (savedDensity === 'compact' || savedDensity === 'comfortable')) {
      setDensity(savedDensity);
    }
    
    const savedTheme = localStorage.getItem('theme') as Theme | null;
    if (savedTheme) setThemeState(savedTheme);
  }, []);

  // Aplica o tema no documento
  useEffect(() => {
    if (!mounted) return;

    const root = window.document.documentElement;
    
    const applyTheme = (currentTheme: Theme) => {
      let effectiveTheme: 'light' | 'dark';
      
      if (currentTheme === 'system') {
        effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      } else {
        effectiveTheme = currentTheme;
      }

      if (effectiveTheme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
      
      setResolvedTheme(effectiveTheme);
    };

    applyTheme(theme);
    localStorage.setItem('theme', theme);

    // Escuta mudanças no tema do sistema
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme('system');
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme, mounted]);

  const toggleDensity = () => {
    const newDensity: Density = density === 'compact' ? 'comfortable' : 'compact';
    setDensity(newDensity);
    localStorage.setItem('ui-density', newDensity);
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  return (
    <UIContext.Provider value={{ density, isFullWidth, toggleDensity, theme, setTheme, resolvedTheme }}>
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
}
