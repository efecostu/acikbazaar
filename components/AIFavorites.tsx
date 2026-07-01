'use client';

import { useLang } from '@/contexts/LangContext';
import type { AIFavorite } from '@/types';

interface Props {
  favorites: AIFavorite[];
}

export function AIFavorites({ favorites }: Props) {
  const { t } = useLang();

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 transition-colors duration-200">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display text-sm font-bold text-[var(--ink)]">
            🤖 {t('Yapay Zeka Tahminleri', 'AI Predictions')}
          </h3>
          <p className="text-xs text-[var(--ink-3)] mt-0.5">
            {t('Önde gelen modellerin EVET tahmini', 'Leading models\' YES estimate')}
          </p>
        </div>
        <span className="text-[10px] font-medium text-[var(--ink-3)] bg-[var(--surface-2)] px-2 py-1 rounded-md">
          {t('Tahmini', 'Estimated')}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {favorites.map((ai) => {
          const pct = Math.round(ai.prob * 100);
          return (
            <div key={ai.name}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold" style={{ color: ai.color }}>
                  {ai.name}
                </span>
                <span className="font-data text-xs font-medium text-[var(--ink)]">{pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: ai.color,
                    opacity: 0.85,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-[var(--ink-3)] mt-4 leading-relaxed">
        {t(
          'Bu tahminler istatistiksel modellerdir, kesin doğruluğu garanti edilmez.',
          'These are statistical estimates, not guaranteed predictions.'
        )}
      </p>
    </div>
  );
}
