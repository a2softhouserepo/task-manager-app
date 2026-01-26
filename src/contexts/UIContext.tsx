'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';
type Density = 'compact' | 'comfortable';
type DeviceType = 'mobile' | 'tablet' | 'desktop' | 'tv';

interface UIContextType {
  // Densidade
  density: Density;
  isFullWidth: boolean;
  toggleDensity: () => void;
  // Tema
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';
  // Device & Responsividade
  deviceType: DeviceType;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  // Menu Mobile
  mobileMenuOpen: boolean;
  toggleMobileMenu: () => void;
  closeMobileMenu: () => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

// Breakpoints consistentes com Tailwind CSS
const BREAKPOINTS = {
  mobile: 640,    // < sm
  tablet: 1024,   // sm - lg
  desktop: 2560,  // lg - 4k
  tv: Infinity,   // > 4k
};

export function UIProvider({ children }: { children: ReactNode }) {
  // Densidade
  const [density, setDensity] = useState<Density>('compact');
  // Tema
  const [theme, setThemeState] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  // Device
  const [deviceType, setDeviceType] = useState<DeviceType>('desktop');
  // Menu Mobile
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Mounted
  const [mounted, setMounted] = useState(false);

  const isFullWidth = density === 'comfortable';
  const isMobile = deviceType === 'mobile';
  const isTablet = deviceType === 'tablet';
  const isDesktop = deviceType === 'desktop' || deviceType === 'tv';

  // Detectar tipo de dispositivo baseado na largura da tela
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      
      if (width < BREAKPOINTS.mobile) {
        setDeviceType('mobile');
      } else if (width < BREAKPOINTS.tablet) {
        setDeviceType('tablet');
      } else if (width < BREAKPOINTS.desktop) {
        setDeviceType('desktop');
      } else {
        setDeviceType('tv');
      }
    };

    // Executar imediatamente
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fechar menu mobile quando mudar para desktop
  useEffect(() => {
    if (isDesktop && mobileMenuOpen) {
      setMobileMenuOpen(false);
    }
  }, [isDesktop, mobileMenuOpen]);

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

  const toggleMobileMenu = useCallback(() => {
    setMobileMenuOpen(prev => !prev);
  }, []);

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  return (
    <UIContext.Provider value={{ 
      density, 
      isFullWidth, 
      toggleDensity, 
      theme, 
      setTheme, 
      resolvedTheme,
      deviceType,
      isMobile,
      isTablet,
      isDesktop,
      mobileMenuOpen,
      toggleMobileMenu,
      closeMobileMenu,
    }}>
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
