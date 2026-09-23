import type { SupabaseClient } from '@supabase/supabase-js';

export type WinInfo = {
  userId: string;
  marketTitle: string;
  amount: number;
  payout: number;
  pick: string;
};

export type Verdict = {
  /** Binary marketler için EVET/HAYIR; multi marketlerde null */
  outcome: boolean | null;
  /** Multi marketlerde kazanan seçenek; binary'de null */
  winningOptionId: string | null;
  /** Kararın kısa gerekçesi (kaynaklı). Opsiyonel. */
  reasoning?: string | null;
};

export type SettleResult = {
  winners: number;
  losers: number;
  betsSettled: number;
  wins: WinInfo[];
};

/**
 * Tek yerden market çözümü — cron, admin paneli ve settle API bunu kullanır.
 * Market statüsünü, kazanan seçeneği, resolved_at'i yazar; bekleyen tüm
 * bahisleri kazandı/kaybetti olarak kapatır ve kazananlara ödemeyi yapar.
 *
 * İdempotent: zaten çözülmüş bir market için pending bahis kalmadığından
 * ikinci çağrı ödeme yapmaz.
 */
export async function settleMarket(
  admin: SupabaseClient,
  marketId: string,
  verdict: Verdict,
): Promise<SettleResult> {
  const { data: market } = await admin
    .from('markets')
    .select('id, title_tr, kind')
    .eq('id', marketId)
    .single();
  if (!market) throw new Error('market_not_found');

  const isMulti = market.kind === 'multi';
  if (isMulti && !verdict.winningOptionId) throw new Error('winning_option_required');
  if (!isMulti && verdict.outcome === null) throw new Error('outcome_required');

  let winningLabel = '';
  if (isMulti) {
    const { data: option } = await admin
      .from('market_options')
      .select('id, label_tr')
      .eq('id', verdict.winningOptionId!)
      .eq('market_id', marketId)
      .single();
    if (!option) throw new Error('option_not_found');
    winningLabel = option.label_tr;
  }

  const now = new Date().toISOString();

  const { error: updateError } = await admin.from('markets').update({
    status: 'resolved',
    outcome: isMulti ? null : verdict.outcome,
    winning_option_id: isMulti ? verdict.winningOptionId : null,
    resolved_at: now,
  }).eq('id', marketId);
  if (updateError) throw new Error(updateError.message);

  // resolution_note kolonu migration-7 ile gelir; yoksa sessizce geç
  if (verdict.reasoning) {
    await admin.from('markets').update({ resolution_note: verdict.reasoning }).eq('id', marketId);
  }

  const { data: bets } = await admin
    .from('bets')
    .select('id, user_id, side, option_id, amount, potential_payout')
    .eq('market_id', marketId)
    .eq('status', 'pending');

  const wins: WinInfo[] = [];
  let winners = 0;
  let losers = 0;

  for (const bet of bets ?? []) {
    const won = isMulti
      ? bet.option_id === verdict.winningOptionId
      : (bet.side === 'yes' && verdict.outcome === true) || (bet.side === 'no' && verdict.outcome === false);

    if (won) {
      // Önce bahsi kapat, sonra öde — aynı bahis iki kez ödenmesin
      const { data: claimed } = await admin
        .from('bets')
        .update({ status: 'won', settled_at: now })
        .eq('id', bet.id)
        .eq('status', 'pending')
        .select('id');
      if (!claimed || claimed.length === 0) continue;

      await admin.rpc('credit_and_update_user', {
        p_user_id: bet.user_id,
        p_amount: bet.potential_payout,
      });
      wins.push({
        userId: bet.user_id,
        marketTitle: market.title_tr,
        amount: bet.amount,
        payout: bet.potential_payout,
        pick: isMulti ? winningLabel : (bet.side === 'yes' ? 'EVET' : 'HAYIR'),
      });
      winners++;
    } else {
      await admin.from('bets').update({ status: 'lost', settled_at: now }).eq('id', bet.id).eq('status', 'pending');
      losers++;
    }
  }

  return { winners, losers, betsSettled: bets?.length ?? 0, wins };
}

/**
 * Yanlış çözülmüş bir marketi geri açar: kazananlardan ödemeyi ve total_won'u geri alır,
 * tüm bahisleri pending'e döndürür, marketi active yapar. Bitiş tarihi geçmişse 'closed' yapar.
 */
export async function unsettleMarket(admin: SupabaseClient, marketId: string): Promise<{ reverted: number }> {
  const { data: market } = await admin.from('markets').select('id, status, ends_at').eq('id', marketId).single();
  if (!market) throw new Error('market_not_found');
  if (market.status !== 'resolved') return { reverted: 0 };

  const { data: bets } = await admin
    .from('bets')
    .select('id, user_id, potential_payout, status')
    .eq('market_id', marketId)
    .in('status', ['won', 'lost']);

  let reverted = 0;
  for (const bet of bets ?? []) {
    // Önce bahsi geri al, sonra ödemeyi düş — aynı bahis iki kez düşülmesin
    const { data: claimed } = await admin
      .from('bets')
      .update({ status: 'pending', settled_at: null })
      .eq('id', bet.id)
      .eq('status', bet.status)
      .select('id');
    if (!claimed || claimed.length === 0) continue;
    if (bet.status === 'won') await adjustBalance(admin, bet.user_id, -bet.potential_payout, -1);
    reverted++;
  }

  const stillOpen = new Date(market.ends_at).getTime() > Date.now();
  await admin.from('markets').update({
    status: stillOpen ? 'active' : 'closed',
    outcome: null,
    winning_option_id: null,
    resolved_at: null,
    resolution_note: null,
  }).eq('id', marketId);

  return { reverted };
}

/**
 * Atomik bakiye düzeltmesi (migration-10 `adjust_balance`). Fonksiyon henüz yoksa
 * okuma-yazma ile düşer — migration uygulanana kadar eski davranış.
 */
export async function adjustBalance(admin: SupabaseClient, userId: string, delta: number, wonDelta = 0): Promise<void> {
  const { error } = await admin.rpc('adjust_balance', { p_user_id: userId, p_delta: delta, p_won_delta: wonDelta });
  if (!error) return;
  const { data: prof } = await admin.from('profiles').select('balance, total_won').eq('id', userId).single();
  if (!prof) return;
  await admin.from('profiles').update({
    balance: prof.balance + delta,
    total_won: Math.max(0, (prof.total_won ?? 0) + wonDelta),
  }).eq('id', userId);
}

/** Market silinmeden önce: bekleyen bahislerin yatırılan tutarını iade eder. */
export async function refundPendingBets(admin: SupabaseClient, marketId: string): Promise<{ refunded: number }> {
  const { data: bets } = await admin
    .from('bets')
    .select('id, user_id, amount')
    .eq('market_id', marketId)
    .eq('status', 'pending');
  let refunded = 0;
  for (const bet of bets ?? []) {
    const { data: claimed } = await admin.from('bets').delete().eq('id', bet.id).eq('status', 'pending').select('id');
    if (!claimed || claimed.length === 0) continue;
    await adjustBalance(admin, bet.user_id, bet.amount);
    refunded++;
  }
  return { refunded };
}
