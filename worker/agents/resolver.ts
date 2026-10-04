import { runResolveSweep } from '@/lib/resolve';
import type { Agent } from '../core';

/**
 * Süresi dolan marketleri çözer ve öder (lib/resolve → lib/settle, aynı yol Vercel cron'uyla).
 * Top-up scout'ta; pahalı erken tarama haftalık Vercel cron'unda kalır.
 */
export const resolver: Agent = {
  name: 'resolver',
  everyMin: 180,
  async run(db) {
    const sweep = await runResolveSweep(db, { topUp: false, skipEarly: true });
    if (sweep.fatal) throw new Error(`sweep fatal: ${sweep.fatal}`);
    return {
      checked: sweep.checked,
      resolved: sweep.resolved,
      closed: sweep.closed,
      skipped: sweep.skipped,
      errors: sweep.errors,
      results: sweep.results.filter((r) => r.path !== 'early').slice(0, 20),
    };
  },
};
