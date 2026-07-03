'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const IS_DEMO = !process.env.NEXT_PUBLIC_SUPABASE_URL
  || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('demo.supabase.co');

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  // Supabase hata mesajlarını anlaşılır Türkçeye çevir
  const ERROR_MAP: [string, string][] = [
    ['already registered', 'Bu e-posta ile zaten bir hesap var. Giriş yapmayı dene.'],
    ['Database error', 'Kayıt sırasında bir sorun oluştu. Birkaç saniye sonra tekrar dene.'],
    ['Password should be', 'Şifre en az 8 karakter olmalı.'],
    ['invalid format', 'E-posta adresi geçersiz görünüyor.'],
    ['rate limit', 'Çok fazla deneme yaptın. Biraz bekleyip tekrar dene.'],
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (IS_DEMO) {
      setError('Demo moddasın — kayıt için gerçek bir Supabase projesi bağlaman gerekiyor. Aşağıdaki kurulum adımlarına bak.');
      return;
    }
    setLoading(true);
    setError(''); setInfo('');
    if (username.length < 3) {
      setError('Kullanıcı adı en az 3 karakter olmalı.');
      setLoading(false);
      return;
    }
    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email, password, options: { data: { username } },
    });
    if (signUpError) {
      const friendly = ERROR_MAP.find(([k]) => signUpError.message.includes(k));
      setError(friendly ? friendly[1] : signUpError.message);
      setLoading(false);
      return;
    }
    // Profil DB trigger'ı ile otomatik oluşur (client insert gerekmez).
    if (!data.session) {
      // E-posta doğrulama açıksa session gelmez — kullanıcıyı bilgilendir
      setInfo(`${email} adresine doğrulama linki gönderdik. Linke tıkladıktan sonra giriş yapabilirsin.`);
      setLoading(false);
      return;
    }
    router.push('/onboarding');
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="text-[#16A34A] font-bold text-2xl">◈</span>
            <span className="text-xl font-bold text-[#111827]">AçıkBazaar</span>
          </Link>
          <p className="text-sm text-[#6B7280] mt-2">Predict openly. Play freely.</p>
        </div>

        {IS_DEMO && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
            <p className="font-semibold text-amber-800 mb-2">⚠️ Demo modu aktif</p>
            <p className="text-amber-700 mb-3">Kayıt olmak için bir Supabase projesi bağlaman gerekiyor. Adımlar:</p>
            <ol className="text-amber-700 space-y-1 text-xs list-decimal list-inside">
              <li><a href="https://supabase.com" target="_blank" rel="noreferrer" className="underline font-medium">supabase.com</a>'da ücretsiz proje oluştur</li>
              <li>Project Settings → API'den URL ve anon key'i kopyala</li>
              <li><code className="bg-amber-100 px-1 rounded">.env.local</code> dosyasını güncelle</li>
              <li><code className="bg-amber-100 px-1 rounded">supabase-schema.sql</code>'i SQL Editor'da çalıştır</li>
              <li>Dev server'ı yeniden başlat</li>
            </ol>
          </div>
        )}

        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-[#111827] mb-1">Kayıt Ol</h2>
          <p className="text-sm text-[#6B7280] mb-5">Başlangıç kredisi: <span className="font-semibold text-[#16A34A]">◈100.000</span></p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input id="username" type="text" label="Kullanıcı Adı" placeholder="tahmincu42"
              value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))} required />
            <Input id="email" type="email" label="E-posta" placeholder="kullanici@email.com"
              value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input id="password" type="password" label="Şifre" placeholder="En az 8 karakter"
              value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />

            {error && (
              <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            {info && (
              <p className="text-sm text-[#15803D] bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg px-3 py-2">
                ✉️ {info}
              </p>
            )}

            <Button type="submit" size="lg" disabled={loading} className="w-full mt-1">
              {loading ? 'Hesap oluşturuluyor...' : IS_DEMO ? 'Kayıt Ol (Demo)' : 'Kayıt Ol & Başla'}
            </Button>
          </form>

          <p className="text-center text-sm text-[#6B7280] mt-4">
            Zaten hesabın var mı?{' '}
            <Link href="/login" className="text-[#16A34A] font-semibold hover:underline">Giriş Yap</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
