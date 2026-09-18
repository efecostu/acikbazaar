import Anthropic from '@anthropic-ai/sdk';

/**
 * Sağlayıcıdan bağımsız kısa metin üretimi (bot yorumları gibi web araması gerektirmeyen işler).
 *
 * Öncelik:
 *  1. LLM_BASE_URL + LLM_API_KEY  → OpenAI uyumlu herhangi bir uç nokta (Qwen/DashScope, OpenRouter, Groq, DeepSeek, Ollama...)
 *  2. ANTHROPIC_API_KEY           → Claude
 *  3. hiçbiri                     → null (çağıran taraf şablon havuzuna düşer)
 *
 * Örnek (Qwen Flash, Alibaba Model Studio uluslararası):
 *   LLM_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
 *   LLM_API_KEY=sk-...
 *   LLM_MODEL=qwen-flash
 * Örnek (OpenRouter): LLM_BASE_URL=https://openrouter.ai/api/v1  LLM_MODEL=qwen/qwen-turbo
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
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.LLM_API_KEY}` },
      body: JSON.stringify({
        model: process.env.LLM_MODEL ?? 'qwen-flash',
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
