export function formatCurrency(value: number): string {
  // Formata como valor unitário de esforço
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

export function formatDate(date: Date | string): string {
  // Se for uma string no formato YYYY-MM-DD (apenas data, sem hora),
  // interpreta como data local ao invés de UTC para evitar problemas de timezone
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] = date.split('-').map(Number);
    return new Intl.DateTimeFormat('pt-BR').format(new Date(year, month - 1, day));
  }
  
  // Para strings ISO completas ou objetos Date, converte e ajusta para timezone local
  const dateObj = new Date(date);
  
  // Se a data vier do MongoDB como ISO string (ex: "2025-02-15T00:00:00.000Z"),
  // vamos usar apenas a parte da data em UTC para evitar shift de timezone
  if (typeof date === 'string' && date.includes('T')) {
    const utcDate = new Date(date);
    const year = utcDate.getUTCFullYear();
    const month = utcDate.getUTCMonth();
    const day = utcDate.getUTCDate();
    return new Intl.DateTimeFormat('pt-BR').format(new Date(year, month, day));
  }
  
  return new Intl.DateTimeFormat('pt-BR').format(dateObj);
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(date));
}

export function formatDateInput(date: Date | string): string {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

export function getMonthRange(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

export function getCurrentMonthRange(): { start: Date; end: Date } {
  const now = new Date();
  return getMonthRange(now.getFullYear(), now.getMonth());
}

export function getMonthName(month: number): string {
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  return months[month];
}
