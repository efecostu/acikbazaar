import { createAdminClient } from '@/lib/supabase/server';
import { requireAdminPage } from '@/lib/adminAuth';
import { MasterSwitch, PauseToggle } from './AgentControls';

export const dynamic = 'force-dynamic';

const AGENTS: { name: string; label: string; every: string }[] = [
  { name: 'resolver', label: 'Çözümleyici: süresi dolan marketleri çözer, öder', every: '3 saat' },
  { name: 'scout',    label: 'Keşif: gündemden yeni market üretir', every: '4 saat' },
  { name: 'tracker',  label: 'Takip: açık marketlerin haberlerini tarar, olasılık tahmini yazar', every: '2 saat' },
  { name: 'trader',   label: 'Botlar: tahminlere göre bahis yapar, yorum yazar', every: '12 dk' },
  { name: 'ops',      label: 'Sağlık: günlük kontrol, sorun varsa e-posta', every: '24 saat' },
];

type Run = { id: number; agent: string; started_at: string; finished_at: string | null; ok: boolean | null; summary: Record<string, unknown> | null; error: string | null };

function ago(iso: string): string {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${m} dk önce`;
  if (m < 1440) return `${Math.round(m / 60)} sa önce`;
  return `${Math.round(m / 1440)} gün önce`;
}

function brief(r: Run): string {
  if (r.ok === false) return r.error?.slice(0, 140) ?? 'hata';
  if (r.ok === null) return 'çalışıyor…';
  const s = r.summary ?? {};
  switch (r.agent) {
    case 'trader': return `${s.bets ?? 0} bahis (${s.informed ?? 0} haber tabanlı), ${s.comments ?? 0} yorum`;
    case 'tracker': return `${s.tracked ?? 0}/${s.due ?? 0} market tahmini`;
    case 'resolver': return `${s.resolved ?? 0} çözüldü, ${s.closed ?? 0} beklemede, ${s.errors ?? 0} hata`;
    case 'scout': return s.mode === 'idle' ? `boşta (${s.active} açık market)` : `${s.mode}: ${Array.isArray(s.inserted) ? s.inserted.length : s.generated ?? 0} yeni market`;
    case 'ops': return Array.isArray(s.issues) && s.issues.length ? `${s.issues.length} sorun: ${String(s.issues[0]).slice(0, 100)}` : 'sorun yok';
    default: return '';
  }
}

export default async function AdminAgentsPage() {
  await requireAdminPage();
  const supabase = await createAdminClient();
  const now = new Date();
  const trtMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), -3));
  if (trtMidnight > now) trtMidnight.setUTCDate(trtMidnight.getUTCDate() - 1);
  const [{ data: settings, error }, { data: runs }, { data: estimates }, { data: todayRuns }] = await Promise.all([
    supabase.from('agent_settings').select('key, value'),
    supabase.from('agent_runs').select('id, agent, started_at, finished_at, ok, summary, error').order('started_at', { ascending: false }).limit(60),
    supabase.from('market_estimates').select('yes_prob, confidence, summary_tr, created_at, markets(title_tr, yes_prob)').order('created_at', { ascending: false }).limit(8),
    supabase.from('agent_runs').select('usage:summary->usage').gte('started_at', trtMidnight.toISOString()),
  ]);
  const spent = ((todayRuns ?? []) as { usage: { costUsd?: number; searches?: number } | null }[])
    .reduce((t, r) => ({ cost: t.cost + Number(r.usage?.costUsd ?? 0), searches: t.searches + Number(r.usage?.searches ?? 0) }), { cost: 0, searches: 0 });

  if (error) {
    return (
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 text-sm text-[#374151]">
        Ajan tabloları yok. Supabase SQL editöründe <code>supabase-migration-11.sql</code> dosyasını çalıştır.
      </div>
    );
  }

  const map = new Map((settings ?? []).map((s) => [s.key, s.value]));
  const enabled = map.get('enabled') !== false;
  const paused = Array.isArray(map.get('paused')) ? (map.get('paused') as string[]) : [];
  const all = (runs ?? []) as Run[];
  const lastOf = (name: string) => all.find((r) => r.agent === name);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">Ajanlar</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">
            VPS worker&apos;ı · {enabled ? 'çalışıyor' : <span className="text-red-500 font-semibold">durduruldu</span>} · değişiklik 1 dk içinde etkili olur
          </p>
          <p className="text-sm text-[#374151] mt-1">
            Bugün: <b>${spent.cost.toFixed(4)}</b> OpenRouter · <b>{spent.searches}</b> arama
            <span className="text-[#9CA3AF]"> (tavan VPS .env&apos;de: DAILY_LLM_BUDGET_USD, DAILY_SEARCH_LIMIT)</span>
          </p>
        </div>
        <MasterSwitch enabled={enabled} />
      </div>

      <div className="bg-white border border-[#E5E7EB] rounded-xl divide-y divide-[#F3F4F6]">
        {AGENTS.map((a) => {
          const last = lastOf(a.name);
          const stale = last && Date.now() - new Date(last.started_at).getTime() > 3 * 864e5;
          return (
            <div key={a.name} className="flex items-center gap-4 px-5 py-4">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${!last ? 'bg-[#D1D5DB]' : last.ok === false || stale ? 'bg-red-500' : 'bg-[#16A34A]'}`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[#111827]">{a.name} <span className="font-normal text-[#9CA3AF]">· her {a.every}</span></div>
                <div className="text-xs text-[#6B7280]">{a.label}</div>
                <div className="text-xs text-[#374151] mt-1 truncate">
                  {last ? `${ago(last.started_at)} · ${brief(last)}` : 'henüz çalışmadı'}
                </div>
              </div>
              <PauseToggle agent={a.name} paused={paused.includes(a.name)} />
            </div>
          );
        })}
      </div>

      <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
        <div className="px-5 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wider border-b border-[#E5E7EB]">Son haber tabanlı tahminler</div>
        {(estimates ?? []).length === 0 && <div className="px-5 py-4 text-sm text-[#9CA3AF]">Henüz tahmin yok.</div>}
        {((estimates ?? []) as unknown as { yes_prob: number; confidence: number; summary_tr: string | null; created_at: string; markets: { title_tr: string; yes_prob: number } | null }[]).map((e, i) => (
          <div key={i} className="px-5 py-3 border-b border-[#F3F4F6] last:border-0">
            <div className="text-sm text-[#111827]">{e.markets?.title_tr}</div>
            <div className="text-xs text-[#6B7280] mt-0.5">
              Ajan %{Math.round(Number(e.yes_prob) * 100)} · kalabalık %{Math.round(Number(e.markets?.yes_prob ?? 0) * 100)} · güven {Math.round(Number(e.confidence) * 100)}% · {ago(e.created_at)}
            </div>
            {e.summary_tr && <div className="text-xs text-[#374151] mt-1">{e.summary_tr}</div>}
          </div>
        ))}
      </div>

      <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
        <div className="px-5 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wider border-b border-[#E5E7EB]">Son çalışmalar</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {all.slice(0, 40).map((r) => (
                <tr key={r.id} className="border-b border-[#F3F4F6] last:border-0">
                  <td className="px-5 py-2 text-xs text-[#9CA3AF] whitespace-nowrap">{ago(r.started_at)}</td>
                  <td className="px-2 py-2 text-xs font-semibold text-[#374151]">{r.agent}</td>
                  <td className={`px-2 py-2 text-xs ${r.ok === false ? 'text-red-500' : 'text-[#374151]'}`}>{brief(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
