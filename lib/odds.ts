export function calculateOdds(yesPool: number, noPool: number) {
  const total = yesPool + noPool;
  if (total === 0) return { yesProb: 0.5, noProb: 0.5, yesOdds: 2.0, noOdds: 2.0 };

  const fee = 0.03;
  const yesProb = Math.max(0.02, Math.min(0.98, (yesPool / total) * (1 - fee)));
  const noProb = Math.max(0.02, Math.min(0.98, (noPool / total) * (1 - fee)));

  return {
    yesProb,
    noProb,
    yesOdds: parseFloat((1 / yesProb).toFixed(2)),
    noOdds: parseFloat((1 / noProb).toFixed(2)),
  };
}

export function calculatePayout(amount: number, prob: number): number {
  return Math.floor(amount / prob);
}
