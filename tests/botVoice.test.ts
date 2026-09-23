import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PERSONAS, commentPrompt, fallbackComment, sanitizeComment, personaOf } from '../lib/botVoice.ts';

test('her persona geçerli ve kullanıcı adı DB kuralına uyar', () => {
  for (const [name, p] of Object.entries(PERSONAS)) {
    assert.match(name, /^[A-Za-z0-9_]{3,20}$/, name);
    assert.ok(p.sample.length >= 3, `${name} örnek yorum`);
    assert.ok(p.stake[0] < p.stake[1], `${name} stake`);
    for (const k of ['contrarian', 'chattiness', 'oddsTalk'] as const) assert.ok(p[k] >= 0 && p[k] <= 1, `${name} ${k}`);
  }
});

test('oran sadece oddsTalk tuttuğunda prompt\'a girer', () => {
  const base = { bot: 'SkeptikSelin', persona: personaOf('SkeptikSelin'), title: 'Türkiye Fransa\'yı yener mi?', description: null, category: 'sports', side: 'no' as const, recent: [] };
  assert.doesNotMatch(commentPrompt(base), /%\d+ EVET/);
  assert.match(commentPrompt({ ...base, yesPct: 42 }), /%42 EVET/);
});

test('şablon yorumlarda yüzde/oran yok', () => {
  for (const name of [...Object.keys(PERSONAS), 'BilinmeyenBot']) {
    for (let i = 0; i < 10; i++) {
      const c = fallbackComment(name, i % 2 ? 'yes' : 'no', 'Türkiye Fransa\'yı yener mi?');
      assert.ok(c.length > 0);
      assert.doesNotMatch(c, /%|\{pct\}|\{konu\}/);
    }
  }
});

test('sanitizeComment emoji, hashtag, tire ve tırnağı temizler', () => {
  assert.equal(sanitizeComment('"olur bu — kesin 🔥 #gs"'), 'olur bu, kesin');
});
