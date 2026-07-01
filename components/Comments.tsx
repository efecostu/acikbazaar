'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLang } from '@/contexts/LangContext';
import { createClient } from '@/lib/supabase/client';

export interface CommentRow {
  id: string;
  content: string;
  created_at: string;
  profiles: { username: string; is_bot: boolean } | null;
}

interface Props {
  marketId: string;
  userId: string;
  initialComments: CommentRow[];
}

function timeAgo(dateStr: string, lang: 'tr' | 'en'): string {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return lang === 'tr' ? 'az önce' : 'just now';
  if (mins < 60) return lang === 'tr' ? `${mins} dk önce` : `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return lang === 'tr' ? `${hours} sa önce` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return lang === 'tr' ? `${days} gün önce` : `${days}d ago`;
}

export function Comments({ marketId, userId, initialComments }: Props) {
  const { lang, t } = useLang();
  const router = useRouter();
  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');

  async function handlePost() {
    const trimmed = content.trim();
    if (!trimmed || !userId) return;
    setPosting(true); setError('');
    const supabase = createClient();
    const { error: insertError } = await supabase.from('comments').insert({
      market_id: marketId, user_id: userId, content: trimmed,
    });
    if (insertError) {
      setError(t('Yorum gönderilemedi.', 'Failed to post comment.'));
    } else {
      setContent('');
      router.refresh();
    }
    setPosting(false);
  }

  return (
    <div className="bg-white dark:bg-[#1E293B] border border-[#E5E7EB] dark:border-[#334155] rounded-2xl p-6 flex flex-col gap-4 transition-colors duration-200">
      <h2 className="text-base font-bold text-[#111827] dark:text-[#F1F5F9]">
        💬 {t('Yorumlar', 'Comments')} ({initialComments.length})
      </h2>

      {/* Composer */}
      {userId ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, 1000))}
            placeholder={t('Bu market hakkında ne düşünüyorsun?', 'What do you think about this market?')}
            rows={2}
            className="w-full bg-white dark:bg-[#0F172A] border border-[#E5E7EB] dark:border-[#334155] rounded-xl px-3 py-2.5 text-sm text-[#111827] dark:text-[#F1F5F9] placeholder:text-[#9CA3AF] dark:placeholder:text-[#64748B] outline-none focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/10 transition-all resize-none"
          />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[#9CA3AF] dark:text-[#64748B]">{content.length}/1000</span>
            <button
              onClick={handlePost}
              disabled={posting || !content.trim()}
              className="bg-[#16A34A] text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-[#15803D] disabled:opacity-50 transition-colors"
            >
              {posting ? t('Gönderiliyor...', 'Posting...') : t('Yorum Yap', 'Post')}
            </button>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      ) : (
        <div className="bg-[#F9FAFB] dark:bg-[#0F172A] border border-[#F3F4F6] dark:border-[#334155] rounded-xl p-4 text-center text-sm text-[#6B7280] dark:text-[#94A3B8]">
          {t('Yorum yapmak için ', 'To comment, ')}
          <Link href="/login" className="text-[#16A34A] font-semibold hover:underline">
            {t('giriş yap', 'log in')}
          </Link>
        </div>
      )}

      {/* List */}
      {initialComments.length === 0 ? (
        <p className="text-sm text-[#9CA3AF] dark:text-[#64748B] text-center py-4">
          {t('İlk yorumu sen yaz!', 'Be the first to comment!')}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {initialComments.map((c) => (
            <div key={c.id} className="border-t border-[#F3F4F6] dark:border-[#334155] pt-3 first:border-0 first:pt-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-[#111827] dark:text-[#F1F5F9]">
                  @{c.profiles?.username ?? 'anonim'}
                </span>
                {c.profiles?.is_bot && (
                  <span className="text-[9px] font-bold uppercase bg-[#EFF6FF] dark:bg-blue-950/50 text-[#3B82F6] dark:text-blue-400 border border-[#BFDBFE] dark:border-blue-800 px-1.5 py-0.5 rounded">
                    BOT
                  </span>
                )}
                <span className="text-[11px] text-[#9CA3AF] dark:text-[#64748B]">{timeAgo(c.created_at, lang)}</span>
              </div>
              <p className="text-sm text-[#374151] dark:text-[#CBD5E1] leading-relaxed whitespace-pre-wrap">{c.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
