'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setLoading(false);
    if (error) {
      setError(/rate limit/i.test(error.message) ? 'Çok fazla deneme yaptın. Biraz bekleyip tekrar dene.' : 'Bağlantı gönderilemedi. E-posta adresini kontrol et.');
      return;
    }
    setSent(true);
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
          <h2 className="font-display text-lg font-bold text-[var(--ink)] mb-1">Şifremi Unuttum</h2>
          <p className="text-sm text-[var(--ink-2)] mb-5">E-posta adresine sıfırlama bağlantısı gönderelim.</p>

          {sent ? (
            <div className="text-sm text-[var(--rise)] bg-[var(--rise-soft)] border border-[var(--rise-line)] rounded-lg px-3 py-3">
              ✉️ Bu adrese kayıtlı bir hesap varsa sıfırlama bağlantısı gönderildi. Gelen kutunu (ve spam klasörünü) kontrol et.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input id="email" type="email" label="E-posta" placeholder="kullanici@email.com"
                value={email} onChange={(e) => setEmail(e.target.value)} required />
              {error && (
                <p className="text-sm text-[var(--fall)] bg-[var(--fall-soft)] border border-[var(--fall-line)] rounded-lg px-3 py-2">{error}</p>
              )}
              <Button type="submit" size="lg" disabled={loading} className="w-full mt-1">
                {loading ? 'Gönderiliyor...' : 'Bağlantı Gönder'}
              </Button>
            </form>
          )}

          <p className="text-center text-sm text-[var(--ink-2)] mt-4">
            <Link href="/login" className="text-[var(--rise)] font-semibold hover:underline">← Giriş sayfasına dön</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
