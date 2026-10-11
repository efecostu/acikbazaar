import type { Metadata } from 'next';
import ConsentReset from './ConsentReset';

export const metadata: Metadata = {
  title: 'Çerez politikası',
  description: 'AçıkBazaar hangi çerezleri neden kullanır, tercihini nasıl değiştirirsin.',
  alternates: { canonical: '/cerez-politikasi' },
};

export default function CookiePolicyPage() {
  return (
    <article className="max-w-2xl space-y-4 text-[var(--ink-2)]">
      <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">Çerez politikası</h1>
      <p>AçıkBazaar iki tür çerez ve benzeri yerel depolama kullanır.</p>
      <h2 className="text-lg font-semibold text-[var(--ink)]">Zorunlu</h2>
      <p>
        Giriş oturumunu (Supabase), tema ve çerez tercihini hatırlamak için. Bunlar olmadan site çalışmaz ve
        rızaya bağlı değildir.
      </p>
      <h2 className="text-lg font-semibold text-[var(--ink)]">Analitik (isteğe bağlı)</h2>
      <p>
        Google Analytics 4: hangi sayfaların ziyaret edildiğini, ziyaretçilerin siteye nereden geldiğini ve kayıt / tahmin
        gibi adımların ne sıklıkla tamamlandığını toplu olarak ölçmek için. Yalnızca çerez bandında “Kabul et” dersen
        yüklenir. Veriler Google LLC tarafından işlenir; reklam kişiselleştirmesi için kullanılmaz.
      </p>
      <h2 className="text-lg font-semibold text-[var(--ink)]">Tercihini değiştir</h2>
      <ConsentReset />
    </article>
  );
}
