'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState<boolean | null>(null);

  // Sıfırlama linkinden gelen oturum var mı?
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => setReady(!!data.session));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setError('Şifre en az 8 karakter olmalı.'); return; }
    if (password !== confirm) { setError('Şifreler eşleşmiyor.'); return; }
    setLoading(true); setError('');
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { setError('Şifre güncellenemedi. Bağlantının süresi dolmuş olabilir; yeni bağlantı iste.'); return; }
    router.push('/markets');
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="text-[var(--rise)] font-bold text-2xl">◈</span>
            <span className="font-display text-xl font-bold text-[var(--ink)]">AçıkBazaar</span>
          </Link>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-sm">
          <h2 className="font-display text-lg font-bold text-[var(--ink)] mb-1">Yeni Şifre</h2>
          <p className="text-sm text-[var(--ink-2)] mb-5">Hesabın için yeni bir şifre belirle.</p>

          {ready === false ? (
            <div className="text-sm text-[var(--fall)] bg-[var(--fall-soft)] border border-[var(--fall-line)] rounded-lg px-3 py-3">
              Bu sayfaya e-postandaki sıfırlama bağlantısıyla gelmen gerekiyor.{' '}
              <Link href="/forgot-password" className="font-semibold underline">Yeni bağlantı iste</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input id="password" type="password" label="Yeni Şifre" placeholder="En az 8 karakter"
                value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
              <Input id="confirm" type="password" label="Şifre (tekrar)" placeholder="••••••••"
                value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={8} required />
              {error && (
                <p className="text-sm text-[var(--fall)] bg-[var(--fall-soft)] border border-[var(--fall-line)] rounded-lg px-3 py-2">{error}</p>
              )}
              <Button type="submit" size="lg" disabled={loading || ready === null} className="w-full mt-1">
                {loading ? 'Kaydediliyor...' : 'Şifreyi Güncelle'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
