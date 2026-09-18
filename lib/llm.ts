import Anthropic from '@anthropic-ai/sdk';

/**
 * Sağlayıcıdan bağımsız kısa metin üretimi (bot yorumları gibi web araması gerektirmeyen işler).
 *
 * Öncelik:
 *  1. LLM_BASE_URL + LLM_API_KEY  → OpenAI uyumlu herhangi bir uç nokta (Qwen/DashScope, OpenRouter, Groq, DeepSeek, Ollama...)
 *  2. ANTHROPIC_API_KEY           → Claude
 *  3. hiçbiri                     → null (çağıran taraf şablon havuzuna düşer)
 *
 * Örnek (OpenRouter, test edildi 2026-09-18; Türkçe sözlük ağzında en iyi ucuz model):
 *   LLM_BASE_URL=https://openrouter.ai/api/v1
 *   LLM_API_KEY=sk-or-...
 *   LLM_MODEL=google/gemini-2.5-flash-lite      (~0,00005 $/yorum; deepseek/deepseek-chat-v3.1 daha "insan", 4 kat pahalı)
 */
export interface ChatOpts { maxTokens?: number; temperature?: number; system?: string }

export function llmProvider(): 'openai-compatible' | 'anthropic' | null {
  if (process.env.LLM_BASE_URL && process.env.LLM_API_KEY) return 'openai-compatible';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  return null;
}

export async function chat(prompt: string, opts: ChatOpts = {}): Promise<string> {
  const provider = llmProvider();
  const maxTokens = opts.maxTokens ?? 200;
  const temperature = opts.temperature ?? 0.9;

  if (provider === 'openai-compatible') {
    const base = process.env.LLM_BASE_URL!.replace(/\/+$/, '');
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.LLM_API_KEY}`, 'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'https://acikbazaar.com', 'X-Title': 'AcikBazaar' },
      body: JSON.stringify({
        model: process.env.LLM_MODEL ?? 'google/gemini-2.5-flash-lite',
        max_tokens: maxTokens,
        temperature,
        messages: [
          ...(opts.system ? [{ role: 'system', content: opts.system }] : []),
          { role: 'user', content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json() as { choices?: { message?: { content?: string } }[] };
    return (data.choices?.[0]?.message?.content ?? '').trim();
  }

  if (provider === 'anthropic') {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      temperature,
      ...(opts.system ? { system: opts.system } : {}),
      messages: [{ role: 'user', content: prompt }],
    });
    return response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';
  }

  throw new Error('No LLM provider configured');
}
