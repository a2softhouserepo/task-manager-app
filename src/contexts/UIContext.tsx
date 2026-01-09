'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface UIContextType {
  isCompact: boolean;
  toggleDensity: () => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export function UIProvider({ children }: { children: ReactNode }) {
  const [isCompact, setIsCompact] = useState<boolean>(false);

  useEffect(() => {
    const saved = localStorage.getItem('ui-density');
    if (saved) setIsCompact(saved === 'compact');
  }, []);

  const toggleDensity = () => {
    const newDensity = !isCompact;
    setIsCompact(newDensity);
    localStorage.setItem('ui-density', newDensity ? 'compact' : 'comfortable');
  };

  return (
    <UIContext.Provider value={{ isCompact, toggleDensity }}>
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
