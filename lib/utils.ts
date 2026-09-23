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
    politics:      '#EF4444',
    economy:       '#F59E0B',
    sports:        '#3B82F6',
    tech:          '#8B5CF6',
    world:         '#10B981',
    entertainment: '#EC4899',
    weather:       '#06B6D4',
  };
  return map[category] ?? '#6B7280';
}

export function categoryLabel(category: string, lang: 'tr' | 'en'): string {
  const map: Record<string, { tr: string; en: string }> = {
    politics:      { tr: 'Siyaset',    en: 'Politics'      },
    economy:       { tr: 'Ekonomi',    en: 'Economy'       },
    sports:        { tr: 'Spor',       en: 'Sports'        },
    tech:          { tr: 'Teknoloji',  en: 'Tech'          },
    world:         { tr: 'Dünya',      en: 'World'         },
    entertainment: { tr: 'Eğlence',   en: 'Entertainment' },
    weather:       { tr: 'Hava',       en: 'Weather'       },
  };
  return map[category]?.[lang] ?? category;
}

/** AI'nın ürettiği serbest tag değerlerini ("hot", "trending", "🔥") okunur etikete çevirir. */
export function tagLabel(tag: string | null | undefined, lang: 'tr' | 'en'): string | null {
  if (!tag) return null;
  const key = tag.trim().toLowerCase();
  if (key === 'hot' || key === '🔥' || key === 'sıcak') return lang === 'tr' ? 'Sıcak' : 'Hot';
  if (key === 'trending' || key === 'trend') return lang === 'tr' ? 'Trend' : 'Trending';
  if (key === 'new' || key === 'yeni') return lang === 'tr' ? 'Yeni' : 'New';
  return tag;
}

/** @deprecated UI'da emoji kullanılmıyor; CategoryIcon bileşenini kullan. Admin listeleri için tutuluyor. */
export function categoryEmoji(category: string): string {
  const map: Record<string, string> = {
    politics: '🏛️', economy: '📈', sports: '⚽',
    tech: '💻', world: '🌍', entertainment: '🎬', weather: '🌤️',
  };
  return map[category] ?? '◈';
}
