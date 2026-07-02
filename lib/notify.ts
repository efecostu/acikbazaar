import { Resend } from 'resend';
import type { SupabaseClient } from '@supabase/supabase-js';

interface WinInfo {
  userId: string;
  marketTitle: string;
  amount: number;
  payout: number;
  pick: string;
}

/**
 * Kazanan kullanıcılara e-posta gönderir. Hata durumunda sessizce geçer —
 * bildirim, resolve akışını asla bloke etmemeli.
 */
export async function sendWinEmails(admin: SupabaseClient, wins: WinInfo[]) {
  if (!process.env.RESEND_API_KEY || wins.length === 0) return;
  const resend = new Resend(process.env.RESEND_API_KEY);

  for (const win of wins) {
    try {
      const { data } = await admin.auth.admin.getUserById(win.userId);
      const email = data?.user?.email;
      if (!email || email.endsWith('@bots.acikbazaar.com')) continue;

      const profit = win.payout - win.amount;
      await resend.emails.send({
        from: 'AçıkBazaar <rapor@acikbazaar.com>',
        to: email,
        subject: `🎉 Kazandın! ◈${win.payout.toLocaleString('tr-TR')} hesabında`,
        html: `
<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;padding:24px 16px;color:#171D1A">
  <div style="font-size:22px;font-weight:800;color:#0BA05F;margin-bottom:4px">◈ AçıkBazaar</div>
  <div style="background:#0C1F16;border-radius:16px;padding:28px;text-align:center;margin:16px 0">
    <div style="color:#7C9B8A;font-size:11px;letter-spacing:2px;text-transform:uppercase">tahminin tuttu</div>
    <div style="color:#2FD588;font-size:44px;font-weight:800;margin:8px 0">+◈${win.payout.toLocaleString('tr-TR')}</div>
    <div style="color:#7C9B8A;font-size:13px">◈${win.amount.toLocaleString('tr-TR')} yatırdın · net kâr ◈${profit.toLocaleString('tr-TR')}</div>
  </div>
  <p style="font-size:14px;line-height:1.6;color:#5C6660">
    <strong style="color:#171D1A">"${win.marketTitle}"</strong> marketinde
    <strong style="color:#0BA05F">${win.pick}</strong> demiştin — haklı çıktın.
    Kazancın hesabına eklendi.
  </p>
  <a href="https://acikbazaar.com/markets"
     style="display:inline-block;background:#0BA05F;color:#fff;font-weight:600;font-size:14px;padding:12px 24px;border-radius:12px;text-decoration:none;margin-top:8px">
    Yeni tahmin yap →
  </a>
  <p style="font-size:11px;color:#98A29B;margin-top:24px">
    AçıkBazaar bir simülasyondur, gerçek para içermez.
  </p>
</div>`,
      });
    } catch {
      // tek bir email hatası diğerlerini durdurmasın
    }
  }
}
