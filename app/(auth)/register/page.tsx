'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    if (username.length < 3) {
      setError('Kullanıcı adı en az 3 karakter olmalı.');
      setLoading(false);
      return;
    }
    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email, password, options: { data: { username } },
    });
    if (signUpError) { setError(signUpError.message); setLoading(false); return; }
    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id, username, balance: 1000, total_bets: 0, total_won: 0,
      });
      if (profileError) { setError('Profil oluşturulamadı: ' + profileError.message); setLoading(false); return; }
    }
    router.push('/markets');
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

        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-[#111827] mb-1">Kayıt Ol</h2>
          <p className="text-sm text-[#6B7280] mb-5">Başlangıç kredisi: <span className="font-semibold text-[#16A34A]">◈1,000</span></p>

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

            <Button type="submit" size="lg" disabled={loading} className="w-full mt-1">
              {loading ? 'Hesap oluşturuluyor...' : 'Kayıt Ol & Başla'}
            </Button>
          </form>

          <p className="text-center text-sm text-[#6B7280] mt-4">
            Zaten hesabın var mı?{' '}
            <Link href="/login" className="text-[#16A34A] font-semibold hover:underline">
              Giriş Yap
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
