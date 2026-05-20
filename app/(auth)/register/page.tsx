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
      email,
      password,
      options: { data: { username } },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        username,
        balance: 1000,
        total_bets: 0,
        total_won: 0,
      });

      if (profileError) {
        setError('Profil oluşturulamadı: ' + profileError.message);
        setLoading(false);
        return;
      }
    }

    router.push('/markets');
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-[#00FF88] text-3xl">◈</span>
          <h1 className="text-lg font-bold mt-2 text-[#F0F2F5]">AçıkBazaar</h1>
          <p className="text-xs text-[#8892A4] mt-1">Predict openly. Play freely.</p>
        </div>

        <div className="bg-[#131620] border border-[#1E2130] rounded-lg p-6">
          <h2 className="text-sm font-bold text-[#F0F2F5] mb-1">Kayıt Ol</h2>
          <p className="text-xs text-[#8892A4] mb-5">Başlangıç kredisi: ◈1,000</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              id="username"
              type="text"
              label="Kullanıcı Adı"
              placeholder="tahmincu42"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
              required
            />
            <Input
              id="email"
              type="email"
              label="E-posta"
              placeholder="kullanici@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              id="password"
              type="password"
              label="Şifre"
              placeholder="En az 8 karakter"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
                {error}
              </p>
            )}

            <Button type="submit" size="lg" disabled={loading} className="w-full mt-1">
              {loading ? 'Hesap oluşturuluyor...' : 'Kayıt Ol & Başla'}
            </Button>
          </form>

          <p className="text-center text-xs text-[#8892A4] mt-4">
            Zaten hesabın var mı?{' '}
            <Link href="/login" className="text-[#00FF88] hover:underline">
              Giriş Yap
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
