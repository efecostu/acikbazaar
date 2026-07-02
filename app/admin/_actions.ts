'use server';

import { createAdminClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

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

export async function resolveMarket(marketId: string, outcome: boolean) {
  const supabase = await createAdminClient();

  await supabase.from('markets').update({
    status: 'resolved', outcome, resolved_at: new Date().toISOString(),
  }).eq('id', marketId);

  const { data: bets } = await supabase
    .from('bets')
    .select('*')
    .eq('market_id', marketId)
    .eq('status', 'pending');

  for (const bet of bets ?? []) {
    const won = (bet.side === 'yes' && outcome) || (bet.side === 'no' && !outcome);
    const settled_at = new Date().toISOString();
    if (won) {
      await supabase.from('bets').update({ status: 'won', settled_at }).eq('id', bet.id);
      await supabase.rpc('credit_and_update_user', { p_user_id: bet.user_id, p_amount: bet.potential_payout });
    } else {
      await supabase.from('bets').update({ status: 'lost', settled_at }).eq('id', bet.id);
    }
  }

  revalidatePath('/admin/markets');
  revalidatePath(`/admin/markets/${marketId}`);
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
      model: 'claude-sonnet-4-6',
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
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/ai/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-secret': process.env.ADMIN_SECRET!,
    },
    body: JSON.stringify({ region, category, count: 1 }),
  });
  const data = await res.json();
  revalidatePath('/admin/markets');
  return data;
}
