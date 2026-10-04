import { gatherEvidence, answerWithEvidence, cheapResearchAvailable } from '@/lib/research';
import { extractJson } from '@/lib/json';
import { clamp, type Agent } from '../core';

/**
 * Açık marketleri haberlerle izler: her çalışmada en eski tahmini olan TRACKER_BATCH marketi
 * araştırır, haber tabanlı EVET olasılığı + kısa Türkçe özet yazar (market_estimates).
 * Trader botlar bu tahmine göre bahis yapar ve yorumlarında bu özeti kullanır —
 * araştırma market başına bir kez yapılır, tüm botlar paylaşır.
 */
const BATCH = parseInt(process.env.TRACKER_BATCH ?? '6');
const STALE_HOURS = parseInt(process.env.TRACKER_STALE_HOURS ?? '12');

type Verdict = { yes_prob: number; confidence: number; summary_tr: string; decided: boolean };

export const tracker: Agent = {
  name: 'tracker',
  everyMin: 120,
  quietHoursTrt: [1, 7],
  onOverBudget: 'skip',
  async run(db) {
    if (!cheapResearchAvailable()) throw new Error('SERPER_API_KEY + LLM_BASE_URL/LLM_API_KEY required');

    const nowIso = new Date().toISOString();
    const [{ data: markets }, { data: latest }] = await Promise.all([
      db.from('markets')
        .select('id, title_tr, title_en, description_tr, ends_at, yes_prob')
        .eq('status', 'active').eq('kind', 'binary').gt('ends_at', nowIso),
      db.from('market_estimates').select('market_id, created_at')
        .gte('created_at', new Date(Date.now() - 7 * 864e5).toISOString())
        .order('created_at', { ascending: false }),
    ]);

    const lastEst = new Map<string, number>();
    for (const e of latest ?? []) if (!lastEst.has(e.market_id)) lastEst.set(e.market_id, new Date(e.created_at).getTime());

    const due = (markets ?? [])
      .filter((m) => Date.now() - (lastEst.get(m.id) ?? 0) > STALE_HOURS * 36e5)
      // Hiç tahmini olmayan → yakında kapanan önce
      .sort((a, b) => (lastEst.get(a.id) ?? 0) - (lastEst.get(b.id) ?? 0) || a.ends_at.localeCompare(b.ends_at))
      .slice(0, BATCH);

    const done: { title: string; yes_prob: number; confidence: number; decided: boolean }[] = [];
    const failed: string[] = [];

    for (const m of due) {
      try {
        const ev = await gatherEvidence([m.title_tr, m.title_en].filter(Boolean) as string[], { recent: 'w', maxQueries: 2, perQuery: 5 });
        const task = `Today is ${nowIso.slice(0, 10)}. Prediction market (ends ${m.ends_at.slice(0, 10)}):
"${m.title_tr}"${m.title_en ? ` / "${m.title_en}"` : ''}
${m.description_tr ? `Resolution criteria: ${m.description_tr}` : ''}
Current crowd probability of YES: ${Math.round(Number(m.yes_prob) * 100)}%.

Estimate the probability that this market resolves YES, based ONLY on the search results.
Return ONLY JSON: {"yes_prob": 0..1, "confidence": 0..1, "summary_tr": "<=200 chars, Turkish, the single most relevant recent fact with no opinion", "decided": true|false}
- confidence: how much the evidence actually informs the estimate (0.2 if results are irrelevant).
- decided: true only if the evidence shows the outcome is already certain.
- If results are irrelevant, keep yes_prob near the crowd probability and confidence low.`;
        const raw = await answerWithEvidence(task, ev.text, { maxTokens: 400 });
        const v = extractJson(raw) as Partial<Verdict> | null;
        if (!v || typeof v.yes_prob !== 'number') throw new Error('no json');

        const row = {
          market_id: m.id,
          yes_prob: clamp(v.yes_prob, 0.01, 0.99),
          confidence: clamp(Number(v.confidence ?? 0.3), 0, 1),
          summary_tr: String(v.summary_tr ?? '').slice(0, 300) || null,
          decided: v.decided === true,
          sources: ev.hits.slice(0, 5).map((h) => ({ title: h.title, link: h.link, date: h.date })),
        };
        const { error } = await db.from('market_estimates').insert(row);
        if (error) throw new Error(error.message);
        done.push({ title: m.title_tr, yes_prob: row.yes_prob, confidence: row.confidence, decided: row.decided });
      } catch (e) {
        failed.push(`${m.title_tr.slice(0, 60)}: ${(e as Error).message.slice(0, 100)}`);
      }
    }

    if (due.length && !done.length) throw new Error(`all ${due.length} estimates failed: ${failed[0]}`);
    return { tracked: done.length, due: due.length, flaggedDecided: done.filter((d) => d.decided).map((d) => d.title), estimates: done, failed };
  },
};
