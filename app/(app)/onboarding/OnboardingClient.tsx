'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLang } from '@/contexts/LangContext';
import { createClient } from '@/lib/supabase/client';
import { categoryLabel, categoryEmoji, cn } from '@/lib/utils';

const CATEGORIES = ['sports', 'economy', 'politics', 'tech', 'world', 'entertainment', 'weather'];

interface Props {
  username: string;
}

export function OnboardingClient({ username }: Props) {
  const { lang, t } = useLang();
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  function toggle(cat: string) {
    setSelected((prev) => prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]);
  }

  async function handleFinish(skip = false) {
    setSaving(true);
    const supabase = createClient();
    // Boş geçse bile bir değer yazılır ki onboarding tekrar sorulmasın
    await supabase.rpc('set_interests', { p_interests: skip || selected.length === 0 ? CATEGORIES : selected });
    router.push('/markets');
    router.refresh();
  }

  return (
    <div className="max-w-lg mx-auto flex flex-col gap-8 py-10">
      <div className="text-center">
        <div className="font-data text-[11px] tracking-[0.18em] uppercase text-[var(--rise)] mb-4">
          {t('Hoş geldin', 'Welcome')}{username ? ` @${username}` : ''}
        </div>
        <h1 className="font-display text-3xl font-bold text-[var(--ink)] mb-3">
          {t('Neyi tahmin etmeyi seversin?', 'What do you like to predict?')}
        </h1>
        <p className="text-sm text-[var(--ink-2)]">
          {t('Seçtiklerin "Senin için" akışını besler. İstediğin zaman değiştirebilirsin.', 'Your picks power the "For you" feed. Change them anytime.')}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {CATEGORIES.map((cat) => {
          const active = selected.includes(cat);
          return (
            <button
              key={cat}
              onClick={() => toggle(cat)}
              className={cn(
                'flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all',
                active
                  ? 'border-[var(--rise)] bg-[var(--rise-soft)]'
                  : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--ink-3)]'
              )}
            >
              <span className="text-2xl">{categoryEmoji(cat)}</span>
              <span className={cn('text-sm font-semibold', active ? 'text-[var(--rise)]' : 'text-[var(--ink)]')}>
                {categoryLabel(cat, lang)}
              </span>
              {active && <span className="ml-auto text-[var(--rise)]">✓</span>}
            </button>
          );
        })}
      </div>

      {/* Kredi bilgisi */}
      <div className="tabela rounded-2xl px-6 py-5 text-center">
        <div className="tabela-label mb-1">{t('başlangıç kredin', 'your starting credits')}</div>
        <div className="tabela-rise text-3xl font-semibold">◈100.000</div>
      </div>

      <div className="flex flex-col gap-2">
        <button
          onClick={() => handleFinish(false)}
          disabled={saving || selected.length === 0}
          className="bg-[var(--rise)] text-white font-semibold py-3.5 rounded-xl hover:brightness-110 disabled:opacity-40 transition-all text-sm"
        >
          {saving ? t('Kaydediliyor...', 'Saving...') : t(`Başla (${selected.length} kategori)`, `Start (${selected.length} categories)`)}
        </button>
        <button
          onClick={() => handleFinish(true)}
          disabled={saving}
          className="text-sm text-[var(--ink-3)] hover:text-[var(--ink)] py-2 transition-colors"
        >
          {t('Şimdilik geç', 'Skip for now')}
        </button>
      </div>
    </div>
  );
}
