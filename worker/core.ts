import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { resetUsage, usageSnapshot } from '@/lib/llm';

export type Summary = Record<string, unknown>;

export interface RunContext {
  /** Günlük OpenRouter bütçesi veya arama limiti doldu */
  overBudget: boolean;
}

export interface Agent {
  name: string;
  /** İki çalışma arası en az bu kadar dakika */
  everyMin: number;
  /** TRT saat aralığında çalışmaz: [başlangıç, bitiş) */
  quietHoursTrt?: [number, number];
  /** Bütçe dolunca: 'skip' → hiç çalışmaz; 'degrade' → ctx.overBudget ile ucuz modda çalışır; yoksa bütçeden muaf */
  onOverBudget?: 'skip' | 'degrade';
  run(db: SupabaseClient, ctx: RunContext): Promise<Summary>;
}

/** Günlük OpenRouter harcama tavanı (USD) ve Serper arama limiti — TRT gece yarısı sıfırlanır. */
export const DAILY_LLM_BUDGET_USD = parseFloat(process.env.DAILY_LLM_BUDGET_USD ?? '0.10');
export const DAILY_SEARCH_LIMIT = parseInt(process.env.DAILY_SEARCH_LIMIT ?? '200');

export function serviceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function hourTrt(d = new Date()): number {
  return (d.getUTCHours() + 3) % 24;
}

export function log(agent: string, msg: string, extra?: unknown) {
  const line = `${new Date().toISOString()} [${agent}] ${msg}`;
  if (extra === undefined) console.log(line);
  else console.log(line, JSON.stringify(extra).slice(0, 800));
}

/** Kill switch: agent_settings.enabled=false → hepsi durur; paused listesindekiler durur. */
export async function loadSettings(db: SupabaseClient): Promise<{ enabled: boolean; paused: string[] }> {
  const { data, error } = await db.from('agent_settings').select('key, value');
  if (error) throw new Error(`agent_settings: ${error.message}`);
  const map = new Map((data ?? []).map((r) => [r.key as string, r.value]));
  return {
    enabled: map.get('enabled') !== false,
    paused: Array.isArray(map.get('paused')) ? (map.get('paused') as string[]) : [],
  };
}

/** Son çalışma zamanı DB'den okunur — worker yeniden başlasa da tempo korunur. */
export async function lastRunAt(db: SupabaseClient, agent: string): Promise<number> {
  const { data } = await db
    .from('agent_runs')
    .select('started_at')
    .eq('agent', agent)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? new Date(data.started_at).getTime() : 0;
}

/** TRT gece yarısından beri tüm ajanların harcaması (agent_runs.summary.usage toplamı). */
export async function spentToday(db: SupabaseClient): Promise<{ costUsd: number; searches: number; calls: number }> {
  const now = new Date();
  const trtMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), -3));
  if (trtMidnight.getTime() > now.getTime()) trtMidnight.setUTCDate(trtMidnight.getUTCDate() - 1);
  const { data, error } = await db.from('agent_runs').select('usage:summary->usage').gte('started_at', trtMidnight.toISOString());
  if (error) throw new Error(`spentToday: ${error.message}`);
  const total = { costUsd: 0, searches: 0, calls: 0 };
  for (const r of (data ?? []) as { usage: { costUsd?: number; searches?: number; calls?: number } | null }[]) {
    total.costUsd += Number(r.usage?.costUsd ?? 0);
    total.searches += Number(r.usage?.searches ?? 0);
    total.calls += Number(r.usage?.calls ?? 0);
  }
  return total;
}

export function isOverBudget(spent: { costUsd: number; searches: number }): boolean {
  return spent.costUsd >= DAILY_LLM_BUDGET_USD || spent.searches >= DAILY_SEARCH_LIMIT;
}

export async function runLogged(db: SupabaseClient, agent: Agent, ctx: RunContext = { overBudget: false }): Promise<void> {
  const { data: row, error } = await db.from('agent_runs').insert({ agent: agent.name }).select('id').single();
  if (error) throw new Error(`agent_runs insert: ${error.message}`);
  const t0 = Date.now();
  resetUsage();
  try {
    const summary = { ...(await agent.run(db, ctx)), usage: usageSnapshot(), overBudget: ctx.overBudget || undefined };
    await db.from('agent_runs').update({ finished_at: new Date().toISOString(), ok: true, summary }).eq('id', row.id);
    log(agent.name, `ok in ${Math.round((Date.now() - t0) / 1000)}s`, summary);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Hata olsa da harcanan token bütçeye sayılsın
    await db.from('agent_runs').update({ finished_at: new Date().toISOString(), ok: false, error: msg.slice(0, 2000), summary: { usage: usageSnapshot() } }).eq('id', row.id);
    log(agent.name, `FAILED: ${msg}`);
  }
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}
