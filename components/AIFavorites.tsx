'use client';

import { useLang } from '@/contexts/LangContext';
import type { AIFavorite } from '@/types';

interface Props {
  favorites: AIFavorite[];
}

export function AIFavorites({ favorites }: Props) {
  const { t } = useLang();

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-[#111827]">
            🤖 {t('Yapay Zeka Tahminleri', 'AI Predictions')}
          </h3>
          <p className="text-xs text-[#9CA3AF] mt-0.5">
            {t('Önde gelen modellerin EVET tahmini', 'Leading models\' YES estimate')}
          </p>
        </div>
        <span className="text-[10px] font-medium text-[#9CA3AF] bg-[#F3F4F6] px-2 py-1 rounded-md">
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
                <span className="text-xs font-bold text-[#374151]">{pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-[#F3F4F6] overflow-hidden">
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

      <p className="text-[10px] text-[#9CA3AF] mt-4 leading-relaxed">
        {t(
          'Bu tahminler istatistiksel modellerdir, kesin doğruluğu garanti edilmez.',
          'These are statistical estimates, not guaranteed predictions.'
        )}
      </p>
    </div>
  );
}
