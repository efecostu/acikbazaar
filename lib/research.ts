import { chat, llmProvider } from '@/lib/llm';

/**
 * Ucuz araştırma yolu: Serper (Google arama, 2.500 ücretsiz kredi, sonra 1.000 arama ≈ 0,30 $)
 * + OpenAI uyumlu ucuz model (OpenRouter). Anthropic web_search'ün yerine geçer.
 *
 * Aktif olması için: SERPER_API_KEY + LLM_BASE_URL + LLM_API_KEY.
 * Model: LLM_MODEL_STRONG (varsayılan google/gemini-2.5-flash; karar işleri için Flash Lite'tan güvenilir,
 * yine de milyon token 0,30 $). OpenRouter anahtarının haftalık limiti doğal harcama tavanıdır.
 */

export interface SearchHit { title: string; link: string; snippet: string; date?: string }

export function cheapResearchAvailable(): boolean {
  return !!process.env.SERPER_API_KEY && llmProvider() === 'openai-compatible';
}

export async function serperSearch(q: string, opts: { num?: number; recent?: 'd' | 'w' | 'm' | 'y'; gl?: string; hl?: string } = {}): Promise<SearchHit[]> {
  const key = process.env.SERPER_API_KEY;
  if (!key) return [];
  const body: Record<string, unknown> = { q, num: opts.num ?? 6, gl: opts.gl ?? 'tr', hl: opts.hl ?? 'tr' };
  if (opts.recent) body.tbs = `qdr:${opts.recent}`;
  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`serper ${res.status}`);
  const data = await res.json() as { organic?: { title: string; link: string; snippet: string; date?: string }[]; answerBox?: { answer?: string; snippet?: string; title?: string } };
  const hits: SearchHit[] = (data.organic ?? []).map((o) => ({ title: o.title, link: o.link, snippet: o.snippet, date: o.date }));
  if (data.answerBox?.snippet || data.answerBox?.answer) {
    hits.unshift({ title: data.answerBox.title ?? 'Google', link: '', snippet: data.answerBox.answer ?? data.answerBox.snippet ?? '' });
  }
  return hits;
}

/** Birden çok sorguyu çalıştırır, tekilleştirir, modele verilecek metin bloğu üretir. */
export async function gatherEvidence(queries: string[], opts: { perQuery?: number; recent?: 'd' | 'w' | 'm' | 'y'; maxQueries?: number } = {}): Promise<{ text: string; hits: SearchHit[]; searches: number }> {
  const qs = queries.filter(Boolean).slice(0, opts.maxQueries ?? 3);
  const seen = new Set<string>();
  const hits: SearchHit[] = [];
  let searches = 0;
  for (const q of qs) {
    try {
      const r = await serperSearch(q, { num: opts.perQuery ?? 6, recent: opts.recent });
      searches++;
      for (const h of r) {
        const k = h.link || h.snippet;
        if (seen.has(k)) continue;
        seen.add(k);
        hits.push(h);
      }
    } catch { /* tek sorgu düşerse devam */ }
  }
  const text = hits.length
    ? hits.map((h, i) => `[${i + 1}] ${h.title}${h.date ? ` (${h.date})` : ''}\n${h.snippet}\n${h.link}`).join('\n\n')
    : '(no search results)';
  return { text, hits, searches };
}

/** Kanıt bloğu + görev → ucuz modelden yanıt. */
export async function answerWithEvidence(task: string, evidence: string, opts: { maxTokens?: number } = {}): Promise<string> {
  const prompt = `${task}

SEARCH RESULTS (the only facts you may rely on; if they don't settle the question, say so via the JSON's null/low-confidence fields):
${evidence}`;
  return chat(prompt, { maxTokens: opts.maxTokens ?? 1200, temperature: 0.2, model: process.env.LLM_MODEL_STRONG ?? 'google/gemini-2.5-flash' });
}
