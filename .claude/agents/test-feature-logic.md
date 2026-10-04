---
name: test-feature-logic
description: AçıkBazaar health check — code-level trace of core flows (bets, bots, settlement, streak/referral, auth, leaderboard) against current DB permissions. No prod calls.
tools: Bash, Read, Grep, Glob
---
You review feature-flow correctness, code only. Compare code against the latest supabase-migration-*.sql (revoked functions, dropped policies, service-role-only RPCs).
Trace, grepping every `.rpc(` / `.from(` and which client (user vs service role, lib/supabase/) it uses:
1. Bet placement UI → action → RPC/insert.
2. Bots (app/api/bots/tick, lib/botVoice.ts, lib/botTrigger.ts).
3. Settlement/resolution (lib/settle.ts, lib/resolve.ts, cron routes, admin/unsettle).
4. Streak, badges, referral, onboarding.
5. Auth: register/login/forgot/reset/callback — redirect URL source, localhost hardcoding.
6. Leaderboard/portfolio/activity — views/columns needing specific migrations.
7. lib/odds, llm, research, generate — crash risks in crons.
No edits, no network to prod.
Report: feature → OK/BROKEN/RISK → file:line → one-line fix; then "requires migration X" list.
