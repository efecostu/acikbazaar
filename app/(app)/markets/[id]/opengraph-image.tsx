import { ImageResponse } from 'next/og';
import { createAdminClient } from '@/lib/supabase/server';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'AçıkBazaar tahmin marketi';

// Türkçe karakterler için latin-ext font — Google Fonts'tan TTF çek
async function loadFont(): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      'https://fonts.googleapis.com/css2?family=Figtree:wght@700&subset=latin-ext',
      { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; rv:109.0)' } }
    ).then((r) => r.text());
    const url = css.match(/src:\s*url\((https:[^)]+\.ttf)\)/)?.[1];
    if (!url) return null;
    return await fetch(url).then((r) => r.arrayBuffer());
  } catch {
    return null;
  }
}

export default async function OpengraphImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createAdminClient();
  const [{ data: market }, { data: options }, font] = await Promise.all([
    supabase.from('markets').select('title_tr, yes_pool, no_pool, kind, total_volume').eq('id', id).single(),
    supabase.from('market_options').select('label_tr, pool').eq('market_id', id).order('pool', { ascending: false }).limit(3),
    loadFont(),
  ]);

  const title = market?.title_tr ?? 'AçıkBazaar';
  const isMulti = market?.kind === 'multi' && (options?.length ?? 0) > 0;
  const total = (market?.yes_pool ?? 1) + (market?.no_pool ?? 1);
  const yesPct = Math.round(((market?.yes_pool ?? 1) / Math.max(total, 1)) * 100);
  const optTotal = (options ?? []).reduce((s, o) => s + o.pool, 0) || 1;

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        backgroundColor: '#0C1F16', padding: '64px 72px', justifyContent: 'space-between',
        fontFamily: font ? 'Figtree' : 'sans-serif',
      }}>
        {/* Üst: marka */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ color: '#2FD588', fontSize: 36, fontWeight: 700 }}>◈</div>
          <div style={{ color: '#FFFFFF', fontSize: 30, fontWeight: 700 }}>AçıkBazaar</div>
          <div style={{ color: '#7C9B8A', fontSize: 22, marginLeft: 12, letterSpacing: 2 }}>TAHMİN PAZARI</div>
        </div>

        {/* Orta: soru */}
        <div style={{
          color: '#FFFFFF', fontSize: title.length > 70 ? 44 : 54, fontWeight: 700,
          lineHeight: 1.15, maxWidth: 1000, display: 'flex',
        }}>
          {title}
        </div>

        {/* Alt: kotasyon */}
        {isMulti ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {(options ?? []).map((o, i) => {
              const pct = Math.round((o.pool / optTotal) * 100);
              const colors = ['#2FD588', '#5B9BFF', '#F5B23D'];
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  <div style={{ color: colors[i], fontSize: 30, fontWeight: 700, width: 620, display: 'flex' }}>
                    {o.label_tr.slice(0, 40)}
                  </div>
                  <div style={{ display: 'flex', flex: 1, height: 14, backgroundColor: '#1C3428', borderRadius: 8 }}>
                    <div style={{ width: `${pct}%`, backgroundColor: colors[i], borderRadius: 8 }} />
                  </div>
                  <div style={{ color: colors[i], fontSize: 34, fontWeight: 700, width: 110, justifyContent: 'flex-end', display: 'flex' }}>
                    {pct}%
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ color: '#7C9B8A', fontSize: 24, letterSpacing: 4, display: 'flex' }}>EVET</div>
              <div style={{ color: '#2FD588', fontSize: 110, fontWeight: 700, lineHeight: 1, display: 'flex' }}>
                {yesPct}%
              </div>
            </div>
            <div style={{
              display: 'flex', flex: 1, height: 16, backgroundColor: '#3A2224',
              borderRadius: 10, margin: '0 48px 28px', overflow: 'hidden',
            }}>
              <div style={{ width: `${yesPct}%`, backgroundColor: '#2FD588', borderRadius: 10 }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <div style={{ color: '#7C9B8A', fontSize: 24, letterSpacing: 4, display: 'flex' }}>HAYIR</div>
              <div style={{ color: '#FF7A70', fontSize: 110, fontWeight: 700, lineHeight: 1, display: 'flex' }}>
                {100 - yesPct}%
              </div>
            </div>
          </div>
        )}
      </div>
    ),
    {
      ...size,
      fonts: font ? [{ name: 'Figtree', data: font, weight: 700 as const, style: 'normal' as const }] : undefined,
    }
  );
}
