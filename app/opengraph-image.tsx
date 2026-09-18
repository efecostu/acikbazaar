import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'AçıkBazaar — Olacak mı, olmayacak mı?';

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

export default async function OpengraphImage() {
  const font = await loadFont();
  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        backgroundColor: '#0C1F16', padding: '64px 72px', justifyContent: 'space-between',
        fontFamily: font ? 'Figtree' : 'sans-serif',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', width: 30, height: 30, backgroundColor: '#2FD588', transform: 'rotate(45deg)', borderRadius: 4, marginRight: 6 }} />
          <div style={{ color: '#FFFFFF', fontSize: 30, fontWeight: 700 }}>AçıkBazaar</div>
          <div style={{ color: '#7C9B8A', fontSize: 22, marginLeft: 12, letterSpacing: 2 }}>TAHMİN PAZARI</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ color: '#FFFFFF', fontSize: 92, fontWeight: 700, lineHeight: 1.05, display: 'flex' }}>Olacak mı,</div>
          <div style={{ color: '#2FD588', fontSize: 92, fontWeight: 700, lineHeight: 1.05, display: 'flex' }}>olmayacak mı?</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ color: '#7C9B8A', fontSize: 26, display: 'flex' }}>
            Türkiye&apos;nin ücretsiz tahmin pazarı · 100.000 sanal kredi ile başla
          </div>
          <div style={{ color: '#7C9B8A', fontSize: 24, display: 'flex' }}>acikbazaar.com</div>
        </div>
      </div>
    ),
    { ...size, fonts: font ? [{ name: 'Figtree', data: font, weight: 700 as const, style: 'normal' as const }] : undefined },
  );
}
