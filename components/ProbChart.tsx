'use client';

import { useMemo, useRef, useState } from 'react';
import { useLang } from '@/contexts/LangContext';

export interface ProbPoint {
  yes_prob: number;
  recorded_at: string;
}

interface Props {
  points: ProbPoint[];
  currentProb: number;
}

const W = 600;
const H = 160;
const PAD = { top: 14, right: 14, bottom: 22, left: 38 };

export function ProbChart({ points, currentProb }: Props) {
  const { lang, t } = useLang();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  // Şimdiki değeri son nokta olarak ekle — çizgi hep "canlı" biter
  const data = useMemo(() => {
    const pts = points.map((p) => ({ t: new Date(p.recorded_at).getTime(), p: p.yes_prob }));
    pts.push({ t: Date.now(), p: currentProb });
    return pts.sort((a, b) => a.t - b.t);
  }, [points, currentProb]);

  const { path, area, coords } = useMemo(() => {
    const t0 = data[0].t;
    const t1 = data[data.length - 1].t;
    const span = Math.max(t1 - t0, 1);
    const iw = W - PAD.left - PAD.right;
    const ih = H - PAD.top - PAD.bottom;
    const coords = data.map((d) => ({
      x: PAD.left + ((d.t - t0) / span) * iw,
      y: PAD.top + (1 - d.p) * ih,
      t: d.t,
      p: d.p,
    }));
    const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
    const area = `${path} L${coords[coords.length - 1].x.toFixed(1)},${H - PAD.bottom} L${coords[0].x.toFixed(1)},${H - PAD.bottom} Z`;
    return { path, area, coords };
  }, [data]);

  function handleMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestDist = Infinity;
    coords.forEach((c, i) => {
      const d = Math.abs(c.x - x);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    setHover(best);
  }

  const hp = hover !== null ? coords[hover] : null;

  const fmtDate = (ts: number) =>
    new Date(ts).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'short' }) +
    ' ' +
    new Date(ts).toLocaleTimeString(lang === 'tr' ? 'tr-TR' : 'en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="tabela rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="tabela-label">{t('evet olasılığı — zaman', 'yes probability — over time')}</span>
        <span className="tabela-rise text-sm font-medium">
          {hp ? `${Math.round(hp.p * 100)}%` : `${Math.round(currentProb * 100)}%`}
        </span>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none select-none"
        onPointerMove={handleMove}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="probFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--rise-bright)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--rise-bright)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* %25/50/75 kılavuz çizgileri */}
        {[0.25, 0.5, 0.75].map((g) => {
          const y = PAD.top + (1 - g) * (H - PAD.top - PAD.bottom);
          return (
            <g key={g}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y}
                stroke="var(--board-line)" strokeWidth="1" strokeDasharray={g === 0.5 ? '0' : '3 4'} />
              <text x={PAD.left - 6} y={y + 3} textAnchor="end" fontSize="10"
                fill="var(--board-text)" fontFamily="var(--font-mono)">
                {Math.round(g * 100)}
              </text>
            </g>
          );
        })}

        <path d={area} fill="url(#probFill)" />
        <path d={path} fill="none" stroke="var(--rise-bright)" strokeWidth="2"
          strokeLinejoin="round" strokeLinecap="round" />

        {/* Hover göstergesi */}
        {hp && (
          <g>
            <line x1={hp.x} x2={hp.x} y1={PAD.top} y2={H - PAD.bottom}
              stroke="var(--board-text)" strokeWidth="1" strokeDasharray="2 3" />
            <circle cx={hp.x} cy={hp.y} r="4.5" fill="var(--rise-bright)" stroke="var(--board)" strokeWidth="2" />
          </g>
        )}

        {/* Son nokta: canlı nabız */}
        {!hp && coords.length > 0 && (
          <circle cx={coords[coords.length - 1].x} cy={coords[coords.length - 1].y} r="4"
            fill="var(--rise-bright)" stroke="var(--board)" strokeWidth="2" />
        )}
      </svg>

      <div className="flex items-center justify-between mt-1 text-[10px]" style={{ color: 'var(--board-text)' }}>
        <span className="font-data">{fmtDate(coords[0].t)}</span>
        <span className="font-data">
          {hp ? fmtDate(hp.t) : t('şimdi', 'now')}
        </span>
      </div>
    </div>
  );
}
