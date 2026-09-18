'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { runResolveNow, topUpNow } from '@/app/admin/_actions';

interface Props {
  overdue: number;
  awaiting: number;
  openCount: number;
  target: number;
  lastResolvedAt: string | null;
  cronSecretSet: boolean;
  resendSet: boolean;
  anthropicSet: boolean;
  appUrl: string | null;
}

export function OpsPanel({ overdue, awaiting, openCount, target, lastResolvedAt, cronSecretSet, resendSet, anthropicSet, appUrl }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [log, setLog] = useState<string>('');

  const lastResolvedDays = lastResolvedAt
    ? Math.floor((Date.now() - new Date(lastResolvedAt).getTime()) / 864e5)
    : null;

  const checks: { ok: boolean; label: string; hint: string }[] = [
    { ok: cronSecretSet, label: 'CRON_SECRET', hint: 'Vercel env\'de yoksa günlük cron 401 alır ve hiçbir market çözülmez.' },
    { ok: anthropicSet, label: 'ANTHROPIC_API_KEY', hint: 'Market üretimi ve otomatik çözüm için gerekli.' },
    { ok: resendSet, label: 'RESEND_API_KEY', hint: 'Kazanç e-postaları ve günlük rapor için gerekli.' },
    { ok: !!appUrl && appUrl.startsWith('https://'), label: 'NEXT_PUBLIC_APP_URL', hint: 'Bot tetikleyici ve OG linkleri bu adresi kullanır.' },
    { ok: overdue === 0, label: `Süresi dolmuş aktif market: ${overdue}`, hint: 'Sıfır olmalı. Değilse cron çalışmıyor → "Şimdi çöz".' },
    { ok: lastResolvedDays !== null && lastResolvedDays <= 7, label: lastResolvedAt ? `Son çözüm: ${lastResolvedDays} gün önce` : 'Henüz çözüm yok', hint: 'Cron her sabah 06:00 UTC çalışır.' },
    { ok: openCount >= target, label: `Açık market: ${openCount} / hedef ${target}`, hint: 'Cron her gün hedefe tamamlar; "Market üret" ile anında.' },
  ];

  function run(action: () => Promise<Record<string, unknown>>, name: string) {
    setLog(`${name} çalışıyor... (web search'lü, 1-3 dk sürebilir)`);
    startTransition(async () => {
      const res = await action();
      const fatal = (res as { fatal?: string }).fatal;
      setLog((fatal ? `❌ ${fatal}\n\n` : '') + JSON.stringify(res, null, 2));
      router.refresh();
    });
  }

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs font-bold text-[#9CA3AF] uppercase tracking-wider">Operasyon Sağlığı</div>
          <div className="text-xs text-[#6B7280] mt-0.5">{awaiting} market sonuç bekliyor</div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => run(runResolveNow as () => Promise<Record<string, unknown>>, 'Çözüm taraması')}
            disabled={pending}
            className="bg-[#16A34A] text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-[#15803D] disabled:opacity-50 transition-colors">
            ⚡ Şimdi çöz + tamamla
          </button>
          <button
            onClick={() => run(topUpNow as () => Promise<Record<string, unknown>>, 'Market üretimi')}
            disabled={pending}
            className="bg-[#F3F4F6] text-[#374151] text-xs font-semibold px-3 py-2 rounded-lg hover:bg-[#E5E7EB] disabled:opacity-50 transition-colors">
            ✨ Market üret
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {checks.map((c) => (
          <div key={c.label} className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 border ${c.ok ? 'bg-[#F0FDF4] border-[#BBF7D0]' : 'bg-red-50 border-red-200'}`}>
            <span>{c.ok ? '✅' : '❌'}</span>
            <div>
              <div className={`font-semibold ${c.ok ? 'text-[#15803D]' : 'text-red-600'}`}>{c.label}</div>
              {!c.ok && <div className="text-[11px] text-[#6B7280] mt-0.5">{c.hint}</div>}
            </div>
          </div>
        ))}
      </div>

      {log && (
        <pre className="text-[11px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-3 max-h-64 overflow-auto whitespace-pre-wrap text-[#374151]">{log}</pre>
      )}
    </div>
  );
}
