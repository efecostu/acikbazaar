'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/markets');
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="text-[#16A34A] font-bold text-2xl">◈</span>
            <span className="text-xl font-bold text-[#111827]">AçıkBazaar</span>
          </Link>
          <p className="text-sm text-[#6B7280] mt-2">Açıkça tahmin et. Özgürce oyna.</p>
        </div>

        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-[#111827] mb-5">Giriş Yap</h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input id="email" type="email" label="E-posta" placeholder="kullanici@email.com"
              value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input id="password" type="password" label="Şifre" placeholder="••••••••"
              value={password} onChange={(e) => setPassword(e.target.value)} required />

            {error && (
              <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button type="submit" size="lg" disabled={loading} className="w-full mt-1">
              {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
            </Button>
          </form>

          <p className="text-center text-sm text-[#6B7280] mt-4">
            Hesabın yok mu?{' '}
            <Link href="/register" className="text-[#16A34A] font-semibold hover:underline">
              Kayıt Ol
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
