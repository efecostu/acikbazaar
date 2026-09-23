import { timingSafeEqual } from 'node:crypto';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

/** /admin'e girebilen hesap(lar). Virgülle birden fazla e-posta verilebilir. */
export const ADMIN_EMAILS = (process.env.ADMIN_EMAIL ?? 'efecostu01@gmail.com')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/** Sabit zamanlı karşılaştırma — secret'lar zamanlama farkıyla tahmin edilemesin. */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** İstek `x-admin-secret: <ADMIN_SECRET>` taşıyor mu (manuel cron/generate/settle çağrıları). */
export async function hasAdminSecret(): Promise<boolean> {
  const h = await headers();
  return safeEqual(h.get('x-admin-secret'), process.env.ADMIN_SECRET);
}

/** Vercel Cron isteği mi (`Authorization: Bearer <CRON_SECRET>`). */
export async function isCronRequest(): Promise<boolean> {
  const h = await headers();
  const token = h.get('authorization')?.replace(/^Bearer\s+/i, '');
  return safeEqual(token, process.env.CRON_SECRET);
}

/** Oturumdaki kullanıcı admin mi? */
export async function isAdminUser(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase();
  return !!email && ADMIN_EMAILS.includes(email);
}

/**
 * Server action'lar herkese açık POST uç noktalarıdır — /admin layout'undaki
 * yönlendirme onları korumaz. Her admin action'ı bununla başlamalı.
 */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdminUser())) throw new Error('Unauthorized');
}

export function unauthorized(hint?: string) {
  return Response.json({ error: 'Unauthorized', ...(hint ? { hint } : {}) }, { status: 401 });
}
