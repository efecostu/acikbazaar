'use server';

import { createAdminClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { sendWinEmails } from '@/lib/notify';
import { settleMarket } from '@/lib/settle';
import { runResolveSweep } from '@/lib/resolve';
import { generateMarkets, topUpMarkets } from '@/lib/generate';
import type { MarketCategory, MarketRegion } from '@/types';

export async function updateMarket(marketId: string, data: {
  title_en?: string;
  title_tr?: string;
  description_en?: string | null;
  description_tr?: string | null;
  yes_prob?: number;
  ends_at?: string;
  tag?: string | null;
}) {
  const supabase = await createAdminClient();
  await supabase.from('markets').update(data).eq('id', marketId);
  revalidatePath('/admin/markets');
  revalidatePath(`/admin/markets/${marketId}`);
}

export async function resolveMarket(marketId: string, outcome: boolean, reasoning?: string) {
  const supabase = await createAdminClient();
  try {
    const result = await settleMarket(supabase, marketId, { outcome, winningOptionId: null, reasoning: reasoning ?? null });
    await sendWinEmails(supabase, result.wins);
    revalidatePath('/admin/markets');
    revalidatePath(`/admin/markets/${marketId}`);
    revalidatePath(`/markets/${marketId}`);
    revalidatePath('/markets');
    return { success: true, winners: result.winners, losers: result.losers };
  } catch (err) {
    return { error: String(err) };
  }
}

export async function resolveMarketMulti(marketId: string, winningOptionId: string, reasoning?: string) {
  const supabase = await createAdminClient();
  try {
    const result = await settleMarket(supabase, marketId, { outcome: null, winningOptionId, reasoning: reasoning ?? null });
    await sendWinEmails(supabase, result.wins);
    revalidatePath('/admin/markets');
    revalidatePath(`/admin/markets/${marketId}`);
    revalidatePath(`/markets/${marketId}`);
    revalidatePath('/markets');
    return { success: true, winners: result.winners, losers: result.losers };
  } catch (err) {
    return { error: String(err) };
  }
}

/** Süresi dolmuş ama çözülememiş marketi "sonuç bekleniyor" (closed) durumuna al / geri aç. */
/** Yanlış çözülmüş marketi geri aç: ödemeler iade edilir, bahisler pending'e döner. */
export async function unsettleMarketAction(marketId: string) {
  const { unsettleMarket } = await import('@/lib/settle');
  const supabase = await createAdminClient();
  const r = await unsettleMarket(supabase, marketId);
  revalidatePath('/admin/markets');
  revalidatePath(`/admin/markets/${marketId}`);
  revalidatePath('/markets');
  revalidatePath(`/markets/${marketId}`);
  return r;
}

export async function setMarketStatus(marketId: string, status: 'active' | 'closed') {
  const supabase = await createAdminClient();
  await supabase.from('markets').update({ status }).eq('id', marketId);
  revalidatePath('/admin/markets');
  revalidatePath(`/admin/markets/${marketId}`);
  revalidatePath('/markets');
}

/** Günlük cron'un yaptığı taramayı admin panelinden anında çalıştır. */
export async function runResolveNow() {
  const supabase = await createAdminClient();
  try {
    const result = await runResolveSweep(supabase);
    revalidatePath('/admin');
    revalidatePath('/admin/markets');
    revalidatePath('/markets');
    return { success: true, ...result };
  } catch (err) {
    return { error: String(err) };
  }
}

/** Açık market sayısını hedefe tamamla (AI üretimi). */
export async function topUpNow() {
  const supabase = await createAdminClient();
  try {
    const result = await topUpMarkets(supabase);
    revalidatePath('/admin');
    revalidatePath('/admin/markets');
    revalidatePath('/markets');
    return { success: true, ...result };
  } catch (err) {
    return { error: String(err) };
  }
}

export async function createMultiMarket(data: {
  title_en: string;
  title_tr: string;
  category: string;
  region: string;
  ends_at: string;
  options: { label_tr: string; label_en: string; weight: number }[];
  simulated_volume: number;
}) {
  const supabase = await createAdminClient();

  const { data: market, error } = await supabase.from('markets').insert({
    title_en: data.title_en,
    title_tr: data.title_tr,
    category: data.category,
    region: data.region,
    kind: 'multi',
    yes_prob: 0.5,
    yes_pool: 0,
    no_pool: 0,
    total_volume: data.simulated_volume,
    participant_count: Math.max(10, Math.floor(data.simulated_volume / 180)),
    ends_at: data.ends_at,
    status: 'active',
    outcome: null,
  }).select().single();

  if (error || !market) return { error: error?.message ?? 'Market oluşturulamadı.' };

  const totalWeight = data.options.reduce((s, o) => s + o.weight, 0) || 1;
  await supabase.from('market_options').insert(
    data.options.map((o, i) => ({
      market_id: market.id,
      label_tr: o.label_tr,
      label_en: o.label_en || o.label_tr,
      pool: Math.floor(data.simulated_volume * (o.weight / totalWeight)),
      sort: i,
    }))
  );

  revalidatePath('/admin/markets');
  return { success: true };
}

export async function deleteMarket(marketId: string) {
  const supabase = await createAdminClient();
  await supabase.from('bets').delete().eq('market_id', marketId);
  await supabase.from('markets').delete().eq('id', marketId);
  revalidatePath('/admin/markets');
}

export async function createMarket(data: {
  title_en: string;
  title_tr: string;
  description_en: string | null;
  description_tr: string | null;
  category: string;
  region: string;
  yes_prob: number;
  ends_at: string;
  tag: string | null;
  simulated_volume: number;
}) {
  const supabase = await createAdminClient();
  const { yes_prob, simulated_volume } = data;
  const yes_pool = Math.floor(simulated_volume * yes_prob);
  const no_pool = simulated_volume - yes_pool;
  const participant_count = Math.max(10, Math.floor(simulated_volume / 180));

  await supabase.from('markets').insert({
    title_en: data.title_en,
    title_tr: data.title_tr,
    description_en: data.description_en,
    description_tr: data.description_tr,
    category: data.category,
    region: data.region,
    yes_prob,
    yes_pool,
    no_pool,
    total_volume: simulated_volume,
    participant_count,
    ends_at: data.ends_at,
    tag: data.tag,
    status: 'active',
    outcome: null,
  });

  revalidatePath('/admin/markets');
}

export async function approveSuggestion(suggestionId: string) {
  const supabase = await createAdminClient();
  const { data: s } = await supabase
    .from('market_suggestions')
    .select('*')
    .eq('id', suggestionId)
    .single();
  if (!s || s.status !== 'pending') return { error: 'Öneri bulunamadı veya zaten işlenmiş.' };

  // Claude: EN çeviri + gerçekçi olasılık tahmini (hızlı, web search'süz)
  let title_en = s.title_tr;
  let yes_prob = 0.5;
  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic();
    const resp = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Turkish prediction-market question. Translate to English (max 12 words, punchy) and estimate a realistic YES probability between 0.05 and 0.95.
Return ONLY JSON: {"title_en":"...","yes_prob":0.55}

Question: ${s.title_tr}
${s.details ? `Details: ${s.details}` : ''}
Resolution date: ${s.ends_at}
Today: ${new Date().toISOString().slice(0, 10)}`,
      }],
    });
    const text = resp.content[0]?.type === 'text' ? resp.content[0].text : '';
    const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? '{}');
    if (parsed.title_en) title_en = parsed.title_en;
    const p = Number(parsed.yes_prob);
    if (p >= 0.05 && p <= 0.95) yes_prob = p;
  } catch { /* çeviri başarısızsa TR başlıkla ve %50 ile devam */ }

  const vol = 2000 + Math.floor(Math.random() * 6000);
  const yes_pool = Math.floor(vol * yes_prob);

  const { error } = await supabase.from('markets').insert({
    title_en,
    title_tr: s.title_tr,
    description_en: null,
    description_tr: s.details,
    category: s.category,
    region: 'turkey',
    yes_prob,
    yes_pool,
    no_pool: vol - yes_pool,
    total_volume: vol,
    participant_count: Math.max(10, Math.floor(vol / 180)),
    ends_at: new Date(s.ends_at).toISOString(),
    tag: null,
    status: 'active',
    outcome: null,
  });
  if (error) return { error: error.message };

  await supabase.from('market_suggestions').update({ status: 'approved' }).eq('id', suggestionId);
  revalidatePath('/admin/suggestions');
  revalidatePath('/admin/markets');
  return { success: true };
}

export async function rejectSuggestion(suggestionId: string) {
  const supabase = await createAdminClient();
  await supabase.from('market_suggestions').update({ status: 'rejected' }).eq('id', suggestionId);
  revalidatePath('/admin/suggestions');
}

export async function generateMarketWithAI(category: string, region: string) {
  const supabase = await createAdminClient();
  try {
    const result = await generateMarkets(supabase, {
      category: category as MarketCategory,
      region: region as MarketRegion,
      count: 1,
    });
    revalidatePath('/admin/markets');
    revalidatePath('/markets');
    if (result.inserted.length === 0) return { error: 'Üretilen market doğrulamadan geçemedi.', rejected: result.rejected };
    return { success: true, markets: result.inserted, rejected: result.rejected };
  } catch (err) {
    return { error: String(err) };
  }
}
