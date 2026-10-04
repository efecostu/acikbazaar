'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setAgentsEnabled, setAgentPaused } from '@/app/admin/_actions';

export function MasterSwitch({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => start(async () => { await setAgentsEnabled(!enabled); router.refresh(); })}
      className={`px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 ${enabled ? 'bg-red-500 hover:bg-red-600' : 'bg-[#16A34A] hover:bg-[#15803D]'}`}
    >
      {pending ? '…' : enabled ? 'Tüm ajanları durdur' : 'Ajanları başlat'}
    </button>
  );
}

export function PauseToggle({ agent, paused }: { agent: string; paused: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => start(async () => { await setAgentPaused(agent, !paused); router.refresh(); })}
      className="text-xs px-2.5 py-1 rounded-md border border-[#E5E7EB] text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-50"
    >
      {pending ? '…' : paused ? 'Devam ettir' : 'Duraklat'}
    </button>
  );
}
