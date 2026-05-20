import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) redirect('/markets');

  const features = [
    { icon: '◈', title: 'Sanal Kredi', desc: 'Her hesap 1.000 kredi ile başlar. Gerçek para yok.' },
    { icon: '📊', title: 'Gerçek Mekanikler', desc: 'Piyasa mantığıyla çalışan oranlar ve havuzlar.' },
    { icon: '🤖', title: 'AI Eventler', desc: 'Claude ile üretilmiş güncel tahmin soruları.' },
    { icon: '🏆', title: 'Sıralama', desc: 'Toplulukla yarış, liderlik tablosuna gir.' },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="border-b border-[#1E2130] px-4 h-14 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <span className="text-[#00FF88] text-lg">◈</span>
          <span className="text-sm font-bold tracking-tight text-[#F0F2F5]">AçıkBazaar</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-xs text-[#8892A4] hover:text-[#F0F2F5] transition-colors">
            Giriş Yap
          </Link>
          <Link
            href="/register"
            className="bg-[#00FF88] text-[#08090C] text-xs font-bold px-4 py-2 rounded hover:bg-[#00CC6A] transition-colors"
          >
            Ücretsiz Başla
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 text-center gap-8 py-24">
        <div className="flex flex-col items-center gap-4">
          <span className="text-[#00FF88] text-6xl">◈</span>
          <h1 className="text-4xl sm:text-5xl font-bold text-[#F0F2F5] tracking-tight leading-tight">
            Açıkça tahmin et.<br />
            <span className="text-[#00FF88]">Özgürce oyna.</span>
          </h1>
          <p className="text-base text-[#8892A4] max-w-lg leading-relaxed">
            Kalshi ve Polymarket&apos;ın tamamen ücretsiz simülasyon alternatifi.
            Gerçek para yok — sadece bilgi, strateji ve rekabet.
          </p>
        </div>

        <div className="flex gap-4 flex-wrap justify-center">
          <Link
            href="/register"
            className="bg-[#00FF88] text-[#08090C] font-bold px-8 py-3 rounded text-sm hover:bg-[#00CC6A] transition-colors accent-glow"
          >
            Şimdi Başla — ◈1,000 Kredi
          </Link>
          <Link
            href="/login"
            className="border border-[#1E2130] text-[#F0F2F5] px-8 py-3 rounded text-sm hover:border-[#00FF88] transition-colors"
          >
            Giriş Yap
          </Link>
        </div>

        {/* Features */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 max-w-3xl w-full">
          {features.map((f) => (
            <div key={f.title} className="bg-[#131620] border border-[#1E2130] rounded-lg p-4 text-left">
              <span className="text-2xl">{f.icon}</span>
              <p className="text-xs font-bold text-[#F0F2F5] mt-2">{f.title}</p>
              <p className="text-[10px] text-[#8892A4] mt-1 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Disclaimer */}
        <p className="text-[10px] text-[#4B5563] max-w-sm">
          AçıkBazaar bir simülasyon platformudur. Hiçbir zaman gerçek para veya finansal ürün içermez.
        </p>
      </main>
    </div>
  );
}
