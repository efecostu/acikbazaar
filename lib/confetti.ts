/**
 * Hafif konfeti — kütüphanesiz. Bahis başarısında çağrılır.
 * prefers-reduced-motion'a saygı duyar.
 */
export function celebrate(originEl?: HTMLElement | null) {
  if (typeof window === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const colors = ['#2FD588', '#0BA05F', '#F5B23D', '#5B9BFF', '#FF7A70', '#B4652F'];
  const rect = originEl?.getBoundingClientRect();
  const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
  const cy = rect ? rect.top : window.innerHeight / 2;

  for (let i = 0; i < 28; i++) {
    const p = document.createElement('div');
    const size = 5 + Math.random() * 6;
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9;
    const velocity = 180 + Math.random() * 260;
    const dx = Math.cos(angle) * velocity;
    const dy = Math.sin(angle) * velocity;

    p.style.cssText = `
      position: fixed; left: ${cx}px; top: ${cy}px; z-index: 9999;
      width: ${size}px; height: ${size * (Math.random() > 0.5 ? 0.4 : 1)}px;
      background: ${colors[i % colors.length]};
      border-radius: ${Math.random() > 0.5 ? '50%' : '1px'};
      pointer-events: none; will-change: transform, opacity;
    `;
    document.body.appendChild(p);

    const rotate = (Math.random() - 0.5) * 720;
    const anim = p.animate(
      [
        { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
        { transform: `translate(${dx * 0.6}px, ${dy * 0.6 + 60}px) rotate(${rotate * 0.6}deg)`, opacity: 1, offset: 0.6 },
        { transform: `translate(${dx}px, ${dy + 320}px) rotate(${rotate}deg)`, opacity: 0 },
      ],
      { duration: 900 + Math.random() * 500, easing: 'cubic-bezier(0.15, 0.6, 0.4, 1)' }
    );
    anim.onfinish = () => p.remove();
  }
}
