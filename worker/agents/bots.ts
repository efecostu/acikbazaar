import { randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PERSONAS } from '@/lib/botVoice';

/**
 * lib/botVoice.ts'teki her persona için bot hesabı olduğundan emin olur (admin "Botları eşitle" ile aynı iş).
 * Worker açılışında ve günlük ops'ta çalışır.
 */
export async function syncBots(db: SupabaseClient): Promise<{ created: string[]; flagged: string[]; errors: string[] }> {
  const { data: existing, error } = await db.from('profiles').select('id, username, is_bot');
  if (error) throw new Error(`profiles: ${error.message}`);
  const byName = new Map((existing ?? []).map((p) => [p.username.toLowerCase(), p]));

  const created: string[] = [];
  const flagged: string[] = [];
  const errors: string[] = [];

  for (const username of Object.keys(PERSONAS)) {
    const found = byName.get(username.toLowerCase());
    if (found) {
      if (!found.is_bot || found.username !== username) {
        const { error: e } = await db.from('profiles').update({ is_bot: true, username }).eq('id', found.id);
        if (e) errors.push(`${username}: ${e.message}`); else flagged.push(username);
      }
      continue;
    }
    const { data, error: ce } = await db.auth.admin.createUser({
      email: `${username.toLowerCase()}@bots.acikbazaar.com`,
      password: randomBytes(24).toString('base64url'),
      email_confirm: true,
      user_metadata: { username },
    });
    if (ce || !data.user) { errors.push(`${username}: ${ce?.message ?? 'createUser failed'}`); continue; }
    const { error: ue } = await db.from('profiles').upsert({ id: data.user.id, username, is_bot: true, balance: 100000 }, { onConflict: 'id' });
    if (ue) errors.push(`${username}: ${ue.message}`); else created.push(username);
  }
  return { created, flagged, errors };
}
