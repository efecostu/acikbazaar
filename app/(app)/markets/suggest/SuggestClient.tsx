'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLang } from '@/contexts/LangContext';
import { createClient } from '@/lib/supabase/client';
import { categoryLabel, categoryEmoji, formatDate } from '@/lib/utils';

const CATEGORIES = ['politics', 'economy', 'sports', 'tech', 'world', 'entertainment', 'weather'];

interface Suggestion {
  id: string;
  title_tr: string;
  category: string;
  ends_at: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

interface Props {
  userId: string;
  mySuggestions: Suggestion[];
}

export function SuggestClient({ userId, mySuggestions }: Props) {
  const { lang, t } = useLang();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('sports');
  const [endsAt, setEndsAt] = useState('');
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const minDate = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  const maxDate = new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10);

  async function handleSubmit() {
    if (title.trim().length < 10 || !endsAt) return;
    setSending(true); setMsg(null);
    const supabase = createClient();
    const { error } = await supabase.from('market_suggestions').insert({
      user_id: userId,
      title_tr: title.trim(),
      category,
      ends_at: endsAt,
      details: details.trim() || null,
    });
    if (error) {
      setMsg({
        ok: false,
        text: error.message.includes('rate_limit')
          ? t('Günlük öneri limitine ulaştın (5/gün). Yarın tekrar dene.', 'Daily limit reached (5/day). Try again tomorrow.')
          : t('Öneri gönderilemedi. Başlık 10-140 karakter olmalı.', 'Could not submit. Title must be 10-140 characters.'),
      });
    } else {
      setTitle(''); setDetails(''); setEndsAt('');
      setMsg({ ok: true, text: t('Önerin alındı! İncelendikten sonra markete dönüşecek.', 'Suggestion received! It will become a market after review.') });
      router.refresh();
    }
    setSending(false);
  }

  const inputCls = 'w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--ink-3)] outline-none focus:border-[var(--rise)] focus:ring-2 focus:ring-[var(--rise)]/10 transition-all';
  const labelCls = 'text-[11px] font-semibold text-[var(--ink-2)] uppercase tracking-wider mb-1.5 block';

  const STATUS_STYLE: Record<Suggestion['status'], string> = {
    pending: 'bg-[var(--surface-2)] text-[var(--ink-3)]',
    approved: 'bg-[var(--rise-soft)] text-[var(--rise)]',
    rejected: 'bg-[var(--fall-soft)] text-[var(--fall)]',
  };
  const STATUS_LABEL: Record<Suggestion['status'], [string, string]> = {
    pending: ['İnceleniyor', 'In review'],
    approved: ['Yayında', 'Live'],
    rejected: ['Reddedildi', 'Rejected'],
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      <div>
        <button onClick={() => router.back()} className="text-sm text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors mb-3 flex items-center gap-1">
          ← {t('Geri', 'Back')}
        </button>
        <h1 className="font-display text-[26px] font-bold text-[var(--ink)]">
          {t('Market Öner', 'Suggest a Market')}
        </h1>
        <p className="text-sm text-[var(--ink-2)] mt-1">
          {t('Sence neyin tahmini olmalı? Sorunu yaz, ekip onaylayınca markete dönüşsün.', 'What should people predict? Write your question — approved suggestions become live markets.')}
        </p>
      </div>

      {/* Form */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 flex flex-col gap-4">
        <div>
          <label className={labelCls}>{t('Soru (EVET/HAYIR formatında)', 'Question (YES/NO format)')}</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 140))}
            placeholder={t('Örn: Fenerbahçe bu sezon Avrupa\'da yarı finale kalır mı?', 'e.g., Will Fenerbahçe reach a European semi-final this season?')}
            className={inputCls}
          />
          <p className="text-[11px] text-[var(--ink-3)] mt-1">{title.length}/140 · {t('net, doğrulanabilir bir soru olmalı', 'must be a clear, verifiable question')}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{t('Kategori', 'Category')}</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{categoryEmoji(c)} {categoryLabel(c, lang)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>{t('Sonuç tarihi', 'Resolution date')}</label>
            <input type="date" min={minDate} max={maxDate} value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)} className={inputCls} />
          </div>
        </div>

        <div>
          <label className={labelCls}>{t('Detay (opsiyonel)', 'Details (optional)')}</label>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value.slice(0, 500))}
            placeholder={t('Nasıl doğrulanır? Hangi kaynak esas alınmalı?', 'How is it verified? Which source counts?')}
            rows={2}
            className={`${inputCls} resize-none`}
          />
        </div>

        {msg && (
          <p className={`text-sm ${msg.ok ? 'text-[var(--rise)]' : 'text-[var(--fall)]'}`}>{msg.text}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={sending || title.trim().length < 10 || !endsAt}
          className="bg-[var(--rise)] text-white text-sm font-semibold py-3 rounded-xl hover:brightness-110 disabled:opacity-40 transition-all"
        >
          {sending ? t('Gönderiliyor...', 'Submitting...') : t('Öneriyi Gönder', 'Submit Suggestion')}
        </button>
      </div>

      {/* My suggestions */}
      {mySuggestions.length > 0 && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 flex flex-col gap-3">
          <h2 className="text-sm font-bold text-[var(--ink)]">{t('Önerilerim', 'My Suggestions')}</h2>
          {mySuggestions.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 text-sm border-t border-[var(--border-light)] pt-3 first:border-0 first:pt-0">
              <div className="min-w-0">
                <p className="text-[var(--ink)] truncate">{s.title_tr}</p>
                <p className="text-[11px] text-[var(--ink-3)] mt-0.5">
                  {categoryEmoji(s.category)} {categoryLabel(s.category, lang)} · {formatDate(s.ends_at, lang)}
                </p>
              </div>
              <span className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-md ${STATUS_STYLE[s.status]}`}>
                {t(...STATUS_LABEL[s.status])}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
