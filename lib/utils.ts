import { clsx, type ClassValue } from 'clsx';
import type { AIFavorite } from '@/types';

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

export function categoryEmoji(category: string): string {
  const map: Record<string, string> = {
    politics: '🏛️', economy: '📈', sports: '⚽',
    tech: '💻', world: '🌍', entertainment: '🎬', weather: '🌤️',
  };
  return map[category] ?? '◈';
}

/**
 * Deterministik AI tahminleri üretir.
 * Market ID'yi seed olarak kullanır — her yüklenmede aynı değerleri gösterir.
 */
export function getAIFavorites(marketId: string, baseProb: number): AIFavorite[] {
  const hex = marketId.replace(/-/g, '');

  // UUID'den 4 deterministik offset çıkar (-0.10 to +0.10 arası)
  const o1 = ((parseInt(hex.slice(0, 4), 16) % 20) - 10) / 100;  // Gemini
  const o2 = ((parseInt(hex.slice(4, 8), 16) % 16) - 8)  / 100;  // ChatGPT
  const o3 = ((parseInt(hex.slice(8, 12), 16) % 24) - 12) / 100; // Grok

  const clamp = (v: number) => Math.max(0.05, Math.min(0.95, v));

  return [
    {
      name: 'Claude',
      prob: clamp(baseProb),
      color: '#D97706',
      bgColor: '#FEF3C7',
    },
    {
      name: 'Gemini',
      prob: clamp(baseProb + o1),
      color: '#4285F4',
      bgColor: '#EFF6FF',
    },
    {
      name: 'ChatGPT',
      prob: clamp(baseProb + o2),
      color: '#10A37F',
      bgColor: '#F0FDF4',
    },
    {
      name: 'Grok',
      prob: clamp(baseProb + o3),
      color: '#6B7280',
      bgColor: '#F9FAFB',
    },
  ];
}

/**
 * Verilen yes_prob'a göre gerçekçi görünen simüle havuz değerleri üretir.
 * Favori taraf daha büyük havuza sahip olur.
 */
export function simulatePools(yesProb: number, targetVolume: number) {
  const yes_pool = Math.floor(targetVolume * yesProb);
  const no_pool  = targetVolume - yes_pool;
  const participant_count = Math.max(
    12,
    Math.floor(targetVolume / 180) + Math.floor(Math.random() * 30)
  );
  return { yes_pool, no_pool, participant_count };
}
