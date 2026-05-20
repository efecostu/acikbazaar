import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatCredits(amount: number): string {
  return amount.toLocaleString('tr-TR');
}

export function formatDate(dateStr: string, lang: 'tr' | 'en'): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function categoryColor(category: string): string {
  const map: Record<string, string> = {
    politics: '#EF4444',
    economy: '#F59E0B',
    sports: '#3B82F6',
    tech: '#8B5CF6',
    world: '#10B981',
  };
  return map[category] ?? '#6B7280';
}

export function categoryLabel(category: string, lang: 'tr' | 'en'): string {
  const map: Record<string, { tr: string; en: string }> = {
    politics: { tr: 'Siyaset', en: 'Politics' },
    economy: { tr: 'Ekonomi', en: 'Economy' },
    sports: { tr: 'Spor', en: 'Sports' },
    tech: { tr: 'Teknoloji', en: 'Tech' },
    world: { tr: 'Dünya', en: 'World' },
  };
  return map[category]?.[lang] ?? category;
}
