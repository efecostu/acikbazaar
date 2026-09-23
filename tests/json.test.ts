import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractJson, isBillingError } from '../lib/json.ts';

test('extractJson: kod bloğu ve açıklama metni içinden ilk diziyi alır', () => {
  const text = 'İşte sonuç:\n```json\n[{"index":0,"outcome":true}]\n```\nNot: [ikinci dizi] yok say.';
  assert.deepEqual(extractJson(text), [{ index: 0, outcome: true }]);
});

test('extractJson: string içindeki parantezler dengeyi bozmaz', () => {
  const text = '{"reasoning":"kaynak [AA] } dedi","outcome":false} sonra metin }';
  assert.deepEqual(extractJson(text), { reasoning: 'kaynak [AA] } dedi', outcome: false });
});

test('extractJson: kaçışlı tırnak', () => {
  assert.deepEqual(extractJson('{"a":"x \\" y"}'), { a: 'x " y' });
});

test('isBillingError: faturalama hatalarını tanır', () => {
  assert.equal(isBillingError(new Error('400 Your credit balance is too low')), true);
  assert.equal(isBillingError('LLM 402: insufficient'), true);
  assert.equal(isBillingError(new Error('market_closed')), false);
});
