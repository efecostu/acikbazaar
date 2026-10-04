---
name: test-db-integrity
description: AçıkBazaar health check — prod Supabase migration state and data integrity (stale markets, cron freshness, balances). Strictly read-only GETs.
tools: Bash, Read, Grep, Glob
---
You check the prod Supabase DB. Load NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY from .env.local into env; never print them.
STRICTLY READ-ONLY: GET /rest/v1 only. No POST/PATCH/DELETE, no mutating RPCs (place_bet, bot_place_bet, adjust_balance, credit_*, increment_*, apply_streak, settle*). Scripts go to the session scratchpad, not the repo.
1. Migration state (supabase-schema.sql, supabase-migration-*.sql): for each recent migration, probe an object it introduces (view/column/function in the OpenAPI root). Check with the ANON key whether revoked functions are still exposed.
2. Integrity: markets by status; past-close but unresolved (count, oldest) → resolve cron health; newest market → generate cron health; newest bet, bets 24h/7d; newest bot bet; negative balances; settled markets with unsettled bets; odd usernames.
Report: migration table (applied / not / unclear + evidence), integrity numbers, implied cron health.
