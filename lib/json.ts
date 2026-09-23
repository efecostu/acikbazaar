/**
 * Model yanıtından ilk dengeli JSON dizi/nesnesini çıkarır.
 * Greedy regex "[...]" iki ayrı diziyi veya sonraki açıklama metnini yakalayıp patlıyordu;
 * burada parantez sayarak ilk tam bloğu alıyoruz, kod bloğu işaretlerini yok sayıyoruz.
 */
export function extractJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, '');
  const start = cleaned.search(/[[{]/);
  if (start < 0) return JSON.parse(cleaned);
  const open = cleaned[start];
  const close = open === '[' ? ']' : '}';
  let depth = 0;
  let inStr = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inStr) {
      if (ch === '\\') i++;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return JSON.parse(cleaned.slice(start, i + 1));
    }
  }
  return JSON.parse(cleaned.slice(start));
}

/** Faturalama/anahtar hatası — tekrar denemek anlamsız, taramayı erken bitir. */
export function isBillingError(err: unknown): boolean {
  const msg = String(err);
  return /credit balance|billing|invalid x-api-key|authentication_error|ANTHROPIC_API_KEY missing|LLM 402|LLM 401|insufficient credits|serper 40[13]/i.test(msg);
}
