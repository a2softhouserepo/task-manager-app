export const getChartColors = (resolvedTheme: 'light' | 'dark') => {
  const isDark = resolvedTheme === 'dark';
  
  return {
    text: isDark ? '#e5e5e5' : '#213547',
    grid: isDark ? '#262626' : '#e5e7eb',
    tooltipBg: isDark ? '#141414' : '#ffffff',
    tooltipText: isDark ? '#e5e5e5' : '#213547',
    tooltipBorder: isDark ? '#262626' : '#e5e7eb',
    primary: '#3b82f6',
    primaryLight: '#60a5fa',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    purple: '#8b5cf6',
    pink: '#ec4899',
  };
};
