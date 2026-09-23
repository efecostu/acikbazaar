import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateOdds, calculatePayout } from '../lib/odds.ts';

test('boş havuz 50/50 ve 2.00x', () => {
  assert.deepEqual(calculateOdds(0, 0), { yesProb: 0.5, noProb: 0.5, yesOdds: 2, noOdds: 2 });
});

test('%3 komisyon ve 0.02–0.98 sınırı (place_bet SQL ile aynı)', () => {
  const { yesProb, noProb } = calculateOdds(750, 250);
  assert.ok(Math.abs(yesProb - 0.75 * 0.97) < 1e-9);
  assert.ok(Math.abs(noProb - 0.25 * 0.97) < 1e-9);
  assert.equal(calculateOdds(1_000_000, 1).noProb, 0.02);
});

test('ödeme aşağı yuvarlanır', () => {
  assert.equal(calculatePayout(100, 0.3), 333);
});
