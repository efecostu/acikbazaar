/**
 * AçıkBazaar ajan worker'ı (VPS'te Docker ile sürekli çalışır, bkz. worker/README.md).
 *
 * Her dakika: kill switch'i oku → vakti gelen ajanı çalıştır. Ajanlar sırayla koşar
 * (1 vCPU; aynı anda iki ajan aynı marketi ellemesin). Tempo agent_runs'tan okunur,
 * yeniden başlatma takvimi bozmaz. `node worker/index.ts --once <ajan>` tek çalıştırma yapar.
 */
import { serviceClient, loadSettings, lastRunAt, runLogged, hourTrt, log, spentToday, isOverBudget, DAILY_LLM_BUDGET_USD, DAILY_SEARCH_LIMIT, type Agent } from './core';
import { scout } from './agents/scout';
import { resolver } from './agents/resolver';
import { tracker } from './agents/tracker';
import { trader } from './agents/trader';
import { ops } from './agents/ops';
import { syncBots } from './agents/bots';

const AGENTS: Agent[] = [resolver, scout, tracker, trader, ops];
const TICK_MS = 60_000;

function inQuietHours(a: Agent): boolean {
  if (!a.quietHoursTrt) return false;
  const h = hourTrt();
  const [from, to] = a.quietHoursTrt;
  return h >= from && h < to;
}

async function main() {
  const db = serviceClient();

  const onceIdx = process.argv.indexOf('--once');
  if (onceIdx !== -1) {
    const name = process.argv[onceIdx + 1];
    const agent = AGENTS.find((a) => a.name === name);
    if (!agent) throw new Error(`unknown agent "${name}" (${AGENTS.map((a) => a.name).join(', ')})`);
    await runLogged(db, agent, { overBudget: isOverBudget(await spentToday(db)) });
    return;
  }

  log('worker', `starting: ${AGENTS.map((a) => `${a.name}/${a.everyMin}m`).join(' ')} · budget $${DAILY_LLM_BUDGET_USD}/day, ${DAILY_SEARCH_LIMIT} searches/day`);
  try {
    log('worker', 'bot sync', await syncBots(db));
  } catch (e) {
    log('worker', `bot sync failed: ${(e as Error).message}`);
  }

  let stopping = false;
  process.on('SIGTERM', () => { stopping = true; log('worker', 'SIGTERM, finishing current agent'); });
  process.on('SIGINT', () => { stopping = true; });

  while (!stopping) {
    try {
      const settings = await loadSettings(db);
      if (settings.enabled) {
        for (const agent of AGENTS) {
          if (stopping) break;
          if (settings.paused.includes(agent.name) || inQuietHours(agent)) continue;
          if (Date.now() - (await lastRunAt(db, agent.name)) < agent.everyMin * 60_000) continue;
          const overBudget = isOverBudget(await spentToday(db));
          if (overBudget && agent.onOverBudget === 'skip') continue;
          await runLogged(db, agent, { overBudget });
        }
      }
    } catch (e) {
      log('worker', `tick error: ${(e as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, TICK_MS));
  }
  log('worker', 'stopped');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
