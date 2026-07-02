'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createMarket, createMultiMarket, generateMarketWithAI } from '@/app/admin/_actions';

const CATEGORIES = ['economy', 'sports', 'politics', 'tech', 'world', 'entertainment', 'weather'];

export default function NewMarketPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [aiLoading, setAiLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const [form, setForm] = useState({
    title_en: '', title_tr: '',
    description_en: '', description_tr: '',
    category: 'economy', region: 'turkey',
    yes_prob: 50, ends_at: '', tag: '',
    simulated_volume: 20000,
  });
  const [kind, setKind] = useState<'binary' | 'multi'>('binary');
  const [multiOptions, setMultiOptions] = useState([
    { label_tr: '', weight: 50 },
    { label_tr: '', weight: 50 },
  ]);

  function setOption(i: number, key: 'label_tr' | 'weight', value: string | number) {
    setMultiOptions((opts) => opts.map((o, j) => j === i ? { ...o, [key]: value } : o));
  }

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function handleCreate() {
    if (!form.title_en || !form.title_tr || !form.ends_at) {
      setMsg('Başlık (EN/TR) ve kapanış tarihi zorunlu.');
      return;
    }
    if (kind === 'multi') {
      const valid = multiOptions.filter((o) => o.label_tr.trim());
      if (valid.length < 2) { setMsg('En az 2 seçenek gerekli.'); return; }
      startTransition(async () => {
        await createMultiMarket({
          title_en: form.title_en,
          title_tr: form.title_tr,
          category: form.category,
          region: form.region,
          ends_at: new Date(form.ends_at).toISOString(),
          options: valid.map((o) => ({ label_tr: o.label_tr.trim(), label_en: o.label_tr.trim(), weight: Number(o.weight) || 1 })),
          simulated_volume: form.simulated_volume,
        });
        router.push('/admin/markets');
      });
      return;
    }
    startTransition(async () => {
      await createMarket({
        title_en: form.title_en,
        title_tr: form.title_tr,
        description_en: form.description_en || null,
        description_tr: form.description_tr || null,
        category: form.category,
        region: form.region,
        yes_prob: form.yes_prob / 100,
        ends_at: new Date(form.ends_at).toISOString(),
        tag: form.tag || null,
        simulated_volume: form.simulated_volume,
      });
      router.push('/admin/markets');
    });
  }

  async function handleAI() {
    setAiLoading(true); setMsg('');
    try {
      const data = await generateMarketWithAI(form.category, form.region);
      if (data.markets?.length > 0) {
        setMsg(`✓ ${data.markets.length} market üretildi ve kaydedildi.`);
        setTimeout(() => router.push('/admin/markets'), 1200);
      } else {
        setMsg('Market üretilemedi. Tekrar dene.');
      }
    } catch {
      setMsg('Hata oluştu.');
    }
    setAiLoading(false);
  }

  const inputCls = "w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-sm text-[#111827] outline-none focus:border-[#16A34A] focus:ring-1 focus:ring-[#16A34A]/20 bg-white transition-all";
  const labelCls = "text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1.5 block";

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <button onClick={() => router.back()} className="text-xs text-[#9CA3AF] hover:text-[#374151] mb-2 block transition-colors">
          ← Geri
        </button>
        <h1 className="text-2xl font-bold text-[#111827]">Yeni Market</h1>
      </div>

      {/* AI Generate */}
      <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl p-5">
        <div className="text-sm font-bold text-[#16A34A] mb-1">🤖 Claude ile Otomatik Üret</div>
        <p className="text-xs text-[#6B7280] mb-4">
          Kategori ve bölge seç, Claude güncel bir market oluştursun ve doğrudan kaydetsin.
        </p>
        <div className="flex gap-2">
          <select value={form.category} onChange={e => set('category', e.target.value)}
            className="flex-1 border border-[#BBF7D0] rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-[#16A34A] transition-all">
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={form.region} onChange={e => set('region', e.target.value)}
            className="border border-[#BBF7D0] rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-[#16A34A] transition-all">
            <option value="turkey">🇹🇷 Turkey</option>
            <option value="global">🌐 Global</option>
          </select>
          <button onClick={handleAI} disabled={aiLoading}
            className="bg-[#16A34A] text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-[#15803D] disabled:opacity-50 transition-colors whitespace-nowrap">
            {aiLoading ? 'Üretiliyor...' : 'Üret & Kaydet'}
          </button>
        </div>
        {msg && (
          <p className={`text-xs mt-3 font-medium ${msg.startsWith('✓') ? 'text-[#16A34A]' : 'text-red-500'}`}>
            {msg}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-[#E5E7EB]" />
        <span className="text-xs text-[#9CA3AF] font-medium">ya da manuel oluştur</span>
        <div className="flex-1 h-px bg-[#E5E7EB]" />
      </div>

      {/* Manual Form */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 flex flex-col gap-4">
        {/* Tür seçimi */}
        <div className="flex gap-2">
          {(['binary', 'multi'] as const).map((k) => (
            <button key={k} onClick={() => setKind(k)}
              className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-semibold transition-colors ${
                kind === k ? 'border-[#16A34A] bg-[#F0FDF4] text-[#16A34A]' : 'border-[#E5E7EB] text-[#6B7280]'
              }`}>
              {k === 'binary' ? 'EVET / HAYIR' : 'Çoklu Seçenek'}
            </button>
          ))}
        </div>

        <div>
          <label className={labelCls}>Başlık (EN) *</label>
          <input value={form.title_en} onChange={e => set('title_en', e.target.value)}
            placeholder="Will X happen before Y?" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Başlık (TR) *</label>
          <input value={form.title_tr} onChange={e => set('title_tr', e.target.value)}
            placeholder="X, Y tarihinden önce olur mu?" className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Açıklama (EN)</label>
            <input value={form.description_en} onChange={e => set('description_en', e.target.value)}
              placeholder="Resolution criteria" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Açıklama (TR)</label>
            <input value={form.description_tr} onChange={e => set('description_tr', e.target.value)}
              placeholder="Çözüm kriteri" className={inputCls} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Kategori</label>
            <select value={form.category} onChange={e => set('category', e.target.value)} className={inputCls}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Bölge</label>
            <select value={form.region} onChange={e => set('region', e.target.value)} className={inputCls}>
              <option value="turkey">🇹🇷 Turkey</option>
              <option value="global">🌐 Global</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Etiket</label>
            <select value={form.tag} onChange={e => set('tag', e.target.value)} className={inputCls}>
              <option value="">—</option>
              <option value="hot">hot</option>
              <option value="trending">trending</option>
              <option value="🔥">🔥</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Kapanış Tarihi *</label>
            <input type="date" value={form.ends_at} onChange={e => set('ends_at', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Simüle Hacim (◈)</label>
            <input type="number" value={form.simulated_volume} min={1000} step={1000}
              onChange={e => set('simulated_volume', Number(e.target.value))} className={inputCls} />
          </div>
        </div>
        {kind === 'multi' && (
          <div className="flex flex-col gap-2">
            <label className={labelCls}>Seçenekler (ağırlık = başlangıç havuz payı)</label>
            {multiOptions.map((o, i) => (
              <div key={i} className="flex gap-2">
                <input value={o.label_tr} onChange={(e) => setOption(i, 'label_tr', e.target.value)}
                  placeholder={`Seçenek ${i + 1} (örn: Galatasaray)`} className={inputCls} />
                <input type="number" min={1} max={100} value={o.weight}
                  onChange={(e) => setOption(i, 'weight', Number(e.target.value))}
                  className={`${inputCls} !w-24`} title="Ağırlık" />
                {multiOptions.length > 2 && (
                  <button onClick={() => setMultiOptions((opts) => opts.filter((_, j) => j !== i))}
                    className="text-red-500 text-sm px-2">✗</button>
                )}
              </div>
            ))}
            {multiOptions.length < 6 && (
              <button onClick={() => setMultiOptions((opts) => [...opts, { label_tr: '', weight: 20 }])}
                className="text-xs font-semibold text-[#16A34A] self-start hover:underline">
                + Seçenek ekle
              </button>
            )}
          </div>
        )}

        {kind === 'binary' && (
        <div>
          <label className={labelCls}>EVET Olasılığı: %{form.yes_prob}</label>
          <input type="range" min={5} max={95} value={form.yes_prob}
            onChange={e => set('yes_prob', Number(e.target.value))}
            className="w-full accent-[#16A34A]" />
          <div className="flex justify-between text-[10px] text-[#9CA3AF] mt-0.5">
            <span>%5 (HAYIR favori)</span>
            <span>%95 (EVET favori)</span>
          </div>
        </div>
        )}

        <button onClick={handleCreate}
          disabled={isPending || !form.title_en || !form.title_tr || !form.ends_at}
          className="w-full bg-[#16A34A] text-white text-sm font-semibold py-3 rounded-lg hover:bg-[#15803D] disabled:opacity-50 transition-colors">
          {isPending ? 'Oluşturuluyor...' : 'Market Oluştur'}
        </button>
      </div>
    </div>
  );
}
