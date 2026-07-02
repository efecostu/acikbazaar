'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatCredits, formatDate, categoryLabel } from '@/lib/utils';
import { updateMarket, resolveMarket, resolveMarketMulti, deleteMarket } from '@/app/admin/_actions';
import type { Market, MarketOption } from '@/types';

interface BetWithUser {
  id: string;
  side: 'yes' | 'no' | null;
  option_id?: string | null;
  amount: number;
  odds_at_bet: number;
  potential_payout: number;
  status: 'pending' | 'won' | 'lost';
  created_at: string;
  profiles: { username: string } | null;
}

interface Props {
  market: Market;
  bets: BetWithUser[];
  options?: MarketOption[];
}

export function MarketAdminClient({ market, bets, options = [] }: Props) {
  const isMulti = market.kind === 'multi' && options.length > 0;
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const [titleEn, setTitleEn]   = useState(market.title_en);
  const [titleTr, setTitleTr]   = useState(market.title_tr);
  const [descEn, setDescEn]     = useState(market.description_en ?? '');
  const [descTr, setDescTr]     = useState(market.description_tr ?? '');
  const [endsAt, setEndsAt]     = useState(market.ends_at.slice(0, 10));
  const [tag, setTag]           = useState(market.tag ?? '');
  const [yesProb, setYesProb]   = useState(Math.round((market.yes_prob ?? 0.5) * 100));

  async function handleSave() {
    setSaving(true); setMsg('');
    await updateMarket(market.id, {
      title_en: titleEn,
      title_tr: titleTr,
      description_en: descEn || null,
      description_tr: descTr || null,
      ends_at: new Date(endsAt).toISOString(),
      tag: tag || null,
      yes_prob: yesProb / 100,
    });
    setMsg('Kaydedildi ✓');
    setSaving(false);
    router.refresh();
  }

  async function handleResolve(outcome: boolean) {
    const pending = bets.filter(b => b.status === 'pending').length;
    if (!confirm(`Market "${outcome ? 'EVET' : 'HAYIR'}" olarak kapatılsın mı?\n${pending} bekleyen bahis etkilenecek.`)) return;
    setSaving(true);
    await resolveMarket(market.id, outcome);
    setMsg(`Market ${outcome ? 'EVET ✓' : 'HAYIR ✓'} olarak kapatıldı`);
    setSaving(false);
    router.refresh();
  }

  async function handleResolveMulti(optionId: string, label: string) {
    const pending = bets.filter(b => b.status === 'pending').length;
    if (!confirm(`"${label}" kazanan seçenek olarak işaretlensin mi?\n${pending} bekleyen bahis etkilenecek.`)) return;
    setSaving(true);
    await resolveMarketMulti(market.id, optionId);
    setMsg(`Kapatıldı — kazanan: ${label} ✓`);
    setSaving(false);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm('Bu marketi ve TÜM bahislerini silmek istediğinden emin misin? Bu işlem geri alınamaz.')) return;
    await deleteMarket(market.id);
    router.push('/admin/markets');
  }

  const pending = bets.filter(b => b.status === 'pending');
  const won     = bets.filter(b => b.status === 'won');
  const lost    = bets.filter(b => b.status === 'lost');
  const yesBets = bets.filter(b => b.side === 'yes');
  const noBets  = bets.filter(b => b.side === 'no');

  const inputCls = "w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-sm text-[#111827] outline-none focus:border-[#16A34A] focus:ring-1 focus:ring-[#16A34A]/20 bg-white transition-all";
  const labelCls = "text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1.5 block";

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <button onClick={() => router.back()} className="text-xs text-[#9CA3AF] hover:text-[#374151] mb-2 block transition-colors">
            ← Marketler
          </button>
          <h1 className="text-xl font-bold text-[#111827] leading-snug truncate">{market.title_en}</h1>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-xs bg-[#F3F4F6] text-[#6B7280] px-2 py-0.5 rounded-md">
              {categoryLabel(market.category, 'en')}
            </span>
            <span className="text-xs text-[#9CA3AF]">
              {market.region === 'turkey' ? '🇹🇷 Turkey' : '🌐 Global'}
            </span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
              market.status === 'active'
                ? 'bg-[#F0FDF4] text-[#16A34A]'
                : 'bg-[#F3F4F6] text-[#9CA3AF]'
            }`}>
              {market.status === 'active' ? 'Aktif' : `Kapandı — ${market.outcome ? 'EVET' : 'HAYIR'}`}
            </span>
          </div>
        </div>
        <button onClick={handleDelete}
          className="shrink-0 text-xs font-semibold text-red-500 border border-red-200 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors">
          🗑 Sil
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Edit Form — 3 cols */}
        <div className="lg:col-span-3 bg-white border border-[#E5E7EB] rounded-xl p-5 flex flex-col gap-4">
          <h2 className="text-sm font-bold text-[#111827]">✏️ Düzenle</h2>

          <div>
            <label className={labelCls}>Başlık (EN)</label>
            <input value={titleEn} onChange={e => setTitleEn(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Başlık (TR)</label>
            <input value={titleTr} onChange={e => setTitleTr(e.target.value)} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Açıklama (EN)</label>
              <input value={descEn} onChange={e => setDescEn(e.target.value)} placeholder="—" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Açıklama (TR)</label>
              <input value={descTr} onChange={e => setDescTr(e.target.value)} placeholder="—" className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Kapanış Tarihi</label>
              <input type="date" value={endsAt} onChange={e => setEndsAt(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Etiket</label>
              <select value={tag} onChange={e => setTag(e.target.value)} className={inputCls}>
                <option value="">—</option>
                <option value="hot">hot</option>
                <option value="trending">trending</option>
                <option value="🔥">🔥</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>EVET Olasılığı: %{yesProb}</label>
            <input type="range" min={5} max={95} value={yesProb}
              onChange={e => setYesProb(Number(e.target.value))}
              className="w-full accent-[#16A34A]" />
            <div className="flex justify-between text-[10px] text-[#9CA3AF] mt-0.5">
              <span>%5 HAYIR favori</span><span>%95 EVET favori</span>
            </div>
          </div>

          {msg && <p className="text-xs text-[#16A34A] font-medium">{msg}</p>}

          <button onClick={handleSave} disabled={saving}
            className="w-full bg-[#16A34A] text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-[#15803D] disabled:opacity-50 transition-colors">
            {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
          </button>
        </div>

        {/* Stats + Resolve — 2 cols */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Stats */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
            <h2 className="text-sm font-bold text-[#111827] mb-3">📊 İstatistikler</h2>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: 'Toplam Bahis',  value: bets.length },
                { label: 'Bekliyor',      value: pending.length },
                { label: 'Kazanan',       value: won.length },
                { label: 'Kaybeden',      value: lost.length },
                { label: 'EVET tarafı',   value: yesBets.length },
                { label: 'HAYIR tarafı',  value: noBets.length },
                { label: 'Toplam Hacim',  value: `◈${formatCredits(market.total_volume ?? 0)}` },
                { label: 'Katılımcı',     value: market.participant_count ?? 0 },
              ].map(({ label, value }) => (
                <div key={label} className="bg-[#F9FAFB] rounded-lg p-3">
                  <div className="text-base font-bold text-[#111827]">{value}</div>
                  <div className="text-[10px] text-[#9CA3AF] mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Close date info */}
          <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-4 text-sm">
            <div className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-1">Kapanış Tarihi</div>
            <div className={`font-semibold ${new Date(market.ends_at) < new Date() && market.status === 'active' ? 'text-red-500' : 'text-[#374151]'}`}>
              {formatDate(market.ends_at, 'tr')}
            </div>
            {new Date(market.ends_at) < new Date() && market.status === 'active' && (
              <div className="text-xs text-red-400 mt-1">⚠ Süresi doldu, resolve bekliyor</div>
            )}
          </div>

          {/* Resolve */}
          {market.status === 'active' && (
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
              <h2 className="text-sm font-bold text-[#111827] mb-0.5">⚖️ Manuel Kapat</h2>
              <p className="text-xs text-[#9CA3AF] mb-4">
                {pending.length} bekleyen bahis etkilenecek
              </p>
              {isMulti ? (
                <div className="flex flex-col gap-2">
                  {options.map((o) => (
                    <button key={o.id} onClick={() => handleResolveMulti(o.id, o.label_tr)} disabled={saving}
                      className="py-2.5 px-3 rounded-xl border-2 border-[#E5E7EB] text-sm font-semibold text-[#374151] hover:border-[#16A34A] hover:text-[#16A34A] disabled:opacity-50 transition-colors text-left">
                      🏆 {o.label_tr}
                    </button>
                  ))}
                </div>
              ) : (
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => handleResolve(true)} disabled={saving}
                  className="py-3 rounded-xl border-2 border-[#16A34A] bg-[#F0FDF4] text-[#16A34A] font-bold text-sm hover:bg-[#DCFCE7] disabled:opacity-50 transition-colors">
                  ✓ EVET
                </button>
                <button onClick={() => handleResolve(false)} disabled={saving}
                  className="py-3 rounded-xl border-2 border-red-400 bg-red-50 text-red-500 font-bold text-sm hover:bg-red-100 disabled:opacity-50 transition-colors">
                  ✗ HAYIR
                </button>
              </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bets table */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#F3F4F6] flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#111827]">Bahis Yapan Kullanıcılar ({bets.length})</h2>
          <div className="flex gap-4 text-xs text-[#9CA3AF]">
            <span>EVET: {yesBets.length}</span>
            <span>HAYIR: {noBets.length}</span>
            <span>Bekliyor: {pending.length}</span>
          </div>
        </div>
        {bets.length === 0 ? (
          <div className="text-center py-12 text-[#9CA3AF] text-sm">Henüz bahis yok.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F9FAFB] text-[10px] text-[#9CA3AF] uppercase tracking-wider">
                  <th className="px-5 py-3 text-left">Kullanıcı</th>
                  <th className="px-5 py-3 text-left">Taraf</th>
                  <th className="px-5 py-3 text-right">Miktar</th>
                  <th className="px-5 py-3 text-right">Oran</th>
                  <th className="px-5 py-3 text-right">Potansiyel Kazanç</th>
                  <th className="px-5 py-3 text-left">Durum</th>
                </tr>
              </thead>
              <tbody>
                {bets.map((bet) => (
                  <tr key={bet.id} className="border-t border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors">
                    <td className="px-5 py-3 font-medium text-[#111827]">
                      {bet.profiles?.username ?? '—'}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`font-bold ${bet.side !== 'no' ? 'text-[#16A34A]' : 'text-red-500'}`}>
                        {bet.side ? bet.side.toUpperCase() : options.find((o) => o.id === bet.option_id)?.label_tr ?? 'SEÇENEK'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-medium">◈{formatCredits(bet.amount)}</td>
                    <td className="px-5 py-3 text-right text-[#6B7280]">{bet.odds_at_bet}x</td>
                    <td className="px-5 py-3 text-right text-[#6B7280]">◈{formatCredits(bet.potential_payout)}</td>
                    <td className="px-5 py-3">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                        bet.status === 'won'  ? 'bg-[#F0FDF4] text-[#16A34A]' :
                        bet.status === 'lost' ? 'bg-red-50 text-red-500' :
                                                'bg-[#F3F4F6] text-[#9CA3AF]'
                      }`}>
                        {bet.status === 'won' ? 'KAZANDI' : bet.status === 'lost' ? 'KAYBETTİ' : 'Bekliyor'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
