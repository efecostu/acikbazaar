# AçıkBazaar ajan worker'ı

VPS'te (Hostinger, `careerops-vps`) Docker ile sürekli çalışır. Site ve API Vercel'de kalır; ajanlar
Supabase'e service-role ile bağlanır. Durum ve kill switch: `/admin/agents`.

| Ajan | Sıklık | İş | Bütçe dolunca |
|---|---|---|---|
| resolver | 3 sa | Süresi dolan marketleri çözer, öder (`lib/resolve` → `lib/settle`) | muaf |
| scout | 4 sa | Açık market < `TARGET_ACTIVE_MARKETS` ise tamamlar; 24 sa yeni market yoksa 2 üretir | atlanır |
| tracker | 2 sa | 6 marketin haberini tarar → `market_estimates` (olasılık + özet) | atlanır |
| trader | 12 dk | Botlar tahmine + kişiliğe göre bahis yapar, habere dayalı yorum yazar | şablon yorum |
| ops | 24 sa | Sağlık kontrolü, bot eşitleme, sorun varsa e-posta | muaf |

## Maliyet (ölçüm 2026-10-04, OpenRouter)
tracker çalışması ≈ $0.0034 (gemini-2.5-flash, 12 Serper araması), trader ≈ $0.0004 (flash-lite).
Toplam ≈ $0.07/gün. Tavan: `DAILY_LLM_BUDGET_USD` (varsayılan 0.10) ve `DAILY_SEARCH_LIMIT` (200),
TRT gece yarısı sıfırlanır. Her çalışmanın harcaması `agent_runs.summary.usage`'da.

## Kurulum / güncelleme
```bash
# ilk kez: VPS'te /docker/acikbazaar-agents/.env oluştur (worker/.env.example)
worker/deploy.sh            # rsync + docker compose up -d --build
ssh careerops-vps 'docker logs -f --tail 50 acikbazaar-agents'
```
Tek ajan elle: `npx tsx --env-file=.env.local worker/index.ts --once tracker`
