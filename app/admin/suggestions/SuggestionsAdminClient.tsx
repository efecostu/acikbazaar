'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { approveSuggestion, rejectSuggestion } from '@/app/admin/_actions';
import { categoryEmoji, formatDate } from '@/lib/utils';

interface Suggestion {
  id: string;
  title_tr: string;
  category: string;
  ends_at: string;
  details: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  profiles: { username: string } | null;
}

interface Props {
  suggestions: Suggestion[];
}

export function SuggestionsAdminClient({ suggestions }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const pending = suggestions.filter((s) => s.status === 'pending');
  const processed = suggestions.filter((s) => s.status !== 'pending');

  async function handleApprove(id: string) {
    setBusy(id); setError('');
    const result = await approveSuggestion(id);
    if (result?.error) setError(result.error);
    setBusy(null);
    router.refresh();
  }

  async function handleReject(id: string) {
    setBusy(id); setError('');
    await rejectSuggestion(id);
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111827]">Market Önerileri</h1>
        <p className="text-sm text-[#6B7280] mt-0.5">
          {pending.length} bekleyen · {processed.length} işlenmiş
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3">{error}</div>
      )}

      {/* Pending */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#F3F4F6]">
          <h2 className="text-sm font-bold text-[#111827]">Bekleyenler ({pending.length})</h2>
        </div>
        {pending.length === 0 ? (
          <p className="text-sm text-[#9CA3AF] text-center py-10">Bekleyen öneri yok.</p>
        ) : (
          <div className="divide-y divide-[#F3F4F6]">
            {pending.map((s) => (
              <div key={s.id} className="px-5 py-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#111827]">{s.title_tr}</p>
                  {s.details && <p className="text-xs text-[#6B7280] mt-1">{s.details}</p>}
                  <p className="text-[11px] text-[#9CA3AF] mt-1.5">
                    {categoryEmoji(s.category)} {s.category} · Bitiş: {formatDate(s.ends_at, 'tr')} · @{s.profiles?.username ?? '?'}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleApprove(s.id)}
                    disabled={busy === s.id}
                    className="text-xs font-semibold bg-[#16A34A] text-white px-4 py-2 rounded-lg hover:bg-[#15803D] disabled:opacity-50 transition-colors"
                  >
                    {busy === s.id ? '...' : '✓ Onayla'}
                  </button>
                  <button
                    onClick={() => handleReject(s.id)}
                    disabled={busy === s.id}
                    className="text-xs font-semibold text-red-500 border border-red-200 px-4 py-2 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                  >
                    ✗ Reddet
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Processed */}
      {processed.length > 0 && (
        <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#F3F4F6]">
            <h2 className="text-sm font-bold text-[#111827]">İşlenmiş</h2>
          </div>
          <div className="divide-y divide-[#F3F4F6]">
            {processed.map((s) => (
              <div key={s.id} className="px-5 py-3 flex items-center justify-between gap-4">
                <p className="text-sm text-[#6B7280] truncate">{s.title_tr}</p>
                <span className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                  s.status === 'approved' ? 'bg-[#F0FDF4] text-[#16A34A]' : 'bg-red-50 text-red-500'
                }`}>
                  {s.status === 'approved' ? 'Onaylandı' : 'Reddedildi'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
