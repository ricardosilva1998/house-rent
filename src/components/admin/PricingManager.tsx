import { useEffect, useMemo, useState } from 'react';

interface Period {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  nightlyRate: number;
  weekendRate: number | null;
  minStay: number;
}

interface Target {
  id: string;
  url: string;
  label: string | null;
  scrapeFrequency: 'daily' | 'weekly';
  selectorStrategy: 'auto' | 'manual';
  selectorRecipe: string | null;
  lastScrapedAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
  isActive: boolean;
}

interface Suggestion {
  id: string;
  date: string;
  suggestedPrice: number;
  acceptedPrice: number | null;
  reasoning: string | null;
  comparatorSummary: string | null;
}

const todayIso = () => new Date().toISOString().slice(0, 10);
const addDays = (iso: string, days: number) => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export default function PricingManager() {
  const [tab, setTab] = useState<'periods' | 'suggestions' | 'targets'>('periods');
  const input = 'rounded-md border border-stone-300 px-3 py-2 text-sm';

  return (
    <div>
      <nav className="flex gap-1 border-b border-stone-200 mb-4">
        {([
          ['periods', 'Períodos sazonais'],
          ['suggestions', 'Sugestões IA'],
          ['targets', 'Concorrentes']
        ] as const).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm border-b-2 -mb-px ${tab === k ? 'border-stone-900 text-stone-900' : 'border-transparent text-stone-500 hover:text-stone-900'}`}
          >
            {l}
          </button>
        ))}
      </nav>
      {tab === 'periods' && <PeriodsTab input={input} />}
      {tab === 'targets' && <TargetsTab input={input} />}
      {tab === 'suggestions' && <SuggestionsTab input={input} />}
    </div>
  );
}

function PeriodsTab({ input }: { input: string }) {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [form, setForm] = useState({ name: '', startDate: '', endDate: '', nightlyRate: 100, weekendRate: '', minStay: 1 });
  const [busy, setBusy] = useState(false);

  async function load() {
    const j = await fetch('/api/admin/pricing-periods').then((r) => r.json());
    if (j.ok) setPeriods(j.periods);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    setBusy(true);
    try {
      await fetch('/api/admin/pricing-periods', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...form,
          weekendRate: form.weekendRate ? Number(form.weekendRate) : null,
          nightlyRate: Number(form.nightlyRate),
          minStay: Number(form.minStay)
        })
      });
      setForm({ name: '', startDate: '', endDate: '', nightlyRate: 100, weekendRate: '', minStay: 1 });
      load();
    } finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (!confirm('Remover período?')) return;
    await fetch(`/api/admin/pricing-periods/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div>
      <div className="rounded-lg border border-stone-200 bg-white p-4 mb-4">
        <h3 className="font-medium mb-3">Novo período</h3>
        <div className="grid md:grid-cols-6 gap-2 items-end">
          <input className={input} placeholder="Nome (ex: Alta época)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className={input} type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          <input className={input} type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          <input className={input} type="number" step="0.01" placeholder="€/noite" value={form.nightlyRate} onChange={(e) => setForm({ ...form, nightlyRate: Number(e.target.value) })} />
          <input className={input} type="number" step="0.01" placeholder="€/noite (fim-de-semana)" value={form.weekendRate} onChange={(e) => setForm({ ...form, weekendRate: e.target.value })} />
          <div className="flex gap-2">
            <input className={input + ' w-20'} type="number" min={1} placeholder="Mín." value={form.minStay} onChange={(e) => setForm({ ...form, minStay: Number(e.target.value) })} />
            <button onClick={add} disabled={busy || !form.name || !form.startDate || !form.endDate} className="rounded-md bg-stone-900 text-white px-4 py-2 text-sm">+ Add</button>
          </div>
        </div>
      </div>
      <table className="w-full text-sm rounded-lg overflow-hidden bg-white border border-stone-200">
        <thead className="text-left text-stone-500 bg-stone-50">
          <tr>
            <th className="px-3 py-2">Nome</th><th>Início</th><th>Fim</th><th>Noite</th><th>Fim-sem.</th><th>Mín.</th><th></th>
          </tr>
        </thead>
        <tbody>
          {periods.length === 0 && <tr><td colSpan={7} className="px-3 py-4 text-stone-500">—</td></tr>}
          {periods.map((p) => (
            <tr key={p.id} className="border-t border-stone-100">
              <td className="px-3 py-2">{p.name}</td>
              <td>{p.startDate}</td>
              <td>{p.endDate}</td>
              <td>{p.nightlyRate.toFixed(2)} €</td>
              <td>{p.weekendRate != null ? `${p.weekendRate.toFixed(2)} €` : '—'}</td>
              <td>{p.minStay} noites</td>
              <td className="text-right pr-3"><button onClick={() => remove(p.id)} className="text-xs text-red-600 underline">Remover</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TargetsTab({ input }: { input: string }) {
  const [targets, setTargets] = useState<Target[]>([]);
  const [form, setForm] = useState({ url: '', label: '', scrapeFrequency: 'daily', selectorStrategy: 'auto', selectorRecipe: '' });
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  async function load() {
    const j = await fetch('/api/admin/competitor-targets').then((r) => r.json());
    if (j.ok) setTargets(j.targets);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/competitor-targets', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          url: form.url,
          label: form.label || null,
          scrapeFrequency: form.scrapeFrequency,
          selectorStrategy: form.selectorStrategy,
          selectorRecipe: form.selectorRecipe || null
        })
      });
      const j = await res.json();
      if (!j.ok) setFlash(j.error ?? 'erro');
      else {
        setForm({ url: '', label: '', scrapeFrequency: 'daily', selectorStrategy: 'auto', selectorRecipe: '' });
        load();
      }
    } finally { setBusy(false); }
  }

  async function runNow(targetId?: string) {
    setRunning(targetId ?? 'all');
    setFlash(null);
    try {
      const res = await fetch('/api/admin/run-scrape', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(targetId ? { targetId } : {})
      });
      const j = await res.json();
      if (j.ok) {
        setFlash(`OK — ${j.results.map((r: any) => `${r.status}${r.prices ? ` (${r.prices.length} preços)` : ''}`).join(', ')}`);
        load();
      } else {
        setFlash('Erro: ' + (j.error ?? '—'));
      }
    } finally { setRunning(null); }
  }

  async function toggle(t: Target) {
    await fetch(`/api/admin/competitor-targets/${t.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ isActive: !t.isActive })
    });
    load();
  }

  async function remove(id: string) {
    if (!confirm('Remover concorrente?')) return;
    await fetch(`/api/admin/competitor-targets/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div>
      <div className="rounded-lg border border-stone-200 bg-white p-4 mb-4">
        <h3 className="font-medium mb-3">Adicionar concorrente</h3>
        <div className="grid md:grid-cols-2 gap-2">
          <input className={input + ' md:col-span-2'} placeholder="URL (https://…)" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
          <input className={input} placeholder="Etiqueta opcional" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          <select className={input} value={form.scrapeFrequency} onChange={(e) => setForm({ ...form, scrapeFrequency: e.target.value })}>
            <option value="daily">Diário</option>
            <option value="weekly">Semanal</option>
          </select>
          <select className={input} value={form.selectorStrategy} onChange={(e) => setForm({ ...form, selectorStrategy: e.target.value })}>
            <option value="auto">Auto (JSON-LD + meta)</option>
            <option value="manual">Manual (regex)</option>
          </select>
          {form.selectorStrategy === 'manual' && (
            <textarea className={input + ' md:col-span-2'} rows={3} placeholder="regex:/€\\s?(\\d{2,4}(?:[\\.,]\\d{2})?)/g" value={form.selectorRecipe} onChange={(e) => setForm({ ...form, selectorRecipe: e.target.value })} />
          )}
          <div className="md:col-span-2 flex justify-between items-center gap-3">
            <button onClick={() => runNow()} disabled={running !== null} className="text-sm underline">{running === 'all' ? '…' : 'Correr todos agora'}</button>
            <button onClick={add} disabled={busy || !form.url} className="rounded-md bg-stone-900 text-white px-4 py-2 text-sm">+ Adicionar</button>
          </div>
        </div>
        {flash && <p className="mt-2 text-xs text-stone-600">{flash}</p>}
      </div>
      <table className="w-full text-sm rounded-lg overflow-hidden bg-white border border-stone-200">
        <thead className="text-left text-stone-500 bg-stone-50">
          <tr>
            <th className="px-3 py-2">URL</th><th>Frequência</th><th>Última recolha</th><th>Estado</th><th></th>
          </tr>
        </thead>
        <tbody>
          {targets.length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-stone-500">—</td></tr>}
          {targets.map((t) => (
            <tr key={t.id} className="border-t border-stone-100">
              <td className="px-3 py-2">
                <a href={t.url} target="_blank" rel="noopener" className="underline">{t.label ?? t.url.slice(0, 60)}</a>
                <div className="text-xs text-stone-500 truncate max-w-md">{t.url}</div>
              </td>
              <td>{t.scrapeFrequency}</td>
              <td>{t.lastScrapedAt ? new Date(t.lastScrapedAt).toLocaleString('pt-PT') : '—'}</td>
              <td>
                <span className={t.lastStatus === 'ok' ? 'text-emerald-700' : t.lastStatus === 'error' ? 'text-red-600' : 'text-stone-500'}>
                  {t.lastStatus ?? '—'}
                </span>
                {t.lastError && <div className="text-xs text-red-600 truncate max-w-xs">{t.lastError}</div>}
              </td>
              <td className="text-right pr-3 space-x-2 whitespace-nowrap">
                <button onClick={() => runNow(t.id)} disabled={running !== null} className="text-xs underline text-stone-700">{running === t.id ? '…' : 'Correr'}</button>
                <button onClick={() => toggle(t)} className="text-xs underline text-stone-700">{t.isActive ? 'Desativar' : 'Ativar'}</button>
                <button onClick={() => remove(t.id)} className="text-xs underline text-red-600">Remover</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SuggestionsTab({ input }: { input: string }) {
  const today = todayIso();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(addDays(today, 30));
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/admin/price-suggestions?from=${from}&to=${to}`);
    const j = await res.json();
    if (j.ok) setItems(j.suggestions);
    setLoading(false);
  }
  useEffect(() => { load(); }, [from, to]);

  async function suggest() {
    setRunning(true);
    setFlash(null);
    const res = await fetch('/api/admin/run-suggest', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fromDate: from, toDate: to })
    });
    const j = await res.json();
    setFlash(j.ok ? `${j.count} sugestões geradas.` : `Erro: ${j.error ?? '—'}`);
    if (j.ok) await load();
    setRunning(false);
  }

  async function accept(date: string, price: number | null) {
    await fetch('/api/admin/price-suggestions', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ date, acceptedPrice: price })
    });
    load();
  }

  const max = useMemo(() => items.reduce((m, s) => Math.max(m, s.suggestedPrice, s.acceptedPrice ?? 0), 0) || 1, [items]);

  return (
    <div>
      <div className="flex flex-wrap gap-3 items-end mb-4">
        <div>
          <label className="block text-xs text-stone-500 mb-1">De</label>
          <input className={input} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-stone-500 mb-1">A</label>
          <input className={input} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <button onClick={suggest} disabled={running} className="rounded-md bg-stone-900 text-white px-4 py-2 text-sm">{running ? '…' : 'Sugerir agora (IA)'}</button>
        {flash && <p className="text-sm text-stone-600">{flash}</p>}
      </div>

      {loading ? <p className="text-sm text-stone-500">A carregar…</p> : (
        <div className="rounded-lg border border-stone-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-left text-stone-500 bg-stone-50">
              <tr>
                <th className="px-3 py-2">Data</th>
                <th>Sugerido</th>
                <th>Aceite</th>
                <th>Razão</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-stone-500">Sem sugestões. Carregue em "Sugerir agora".</td></tr>}
              {items.map((s) => {
                const w = Math.round((s.suggestedPrice / max) * 100);
                const aw = s.acceptedPrice != null ? Math.round((s.acceptedPrice / max) * 100) : 0;
                return (
                  <tr key={s.id} className="border-t border-stone-100">
                    <td className="px-3 py-2 font-mono text-xs">{s.date}</td>
                    <td className="w-48">
                      <div className="flex items-center gap-2">
                        <div className="bg-stone-200 rounded h-2 flex-1"><div className="bg-stone-700 h-2 rounded" style={{ width: `${w}%` }} /></div>
                        <span className="text-stone-700 w-12 text-right">{s.suggestedPrice.toFixed(0)} €</span>
                      </div>
                    </td>
                    <td className="w-48">
                      {s.acceptedPrice != null ? (
                        <div className="flex items-center gap-2">
                          <div className="bg-stone-200 rounded h-2 flex-1"><div className="bg-emerald-600 h-2 rounded" style={{ width: `${aw}%` }} /></div>
                          <span className="text-emerald-700 w-12 text-right">{s.acceptedPrice.toFixed(0)} €</span>
                        </div>
                      ) : <span className="text-stone-400">—</span>}
                    </td>
                    <td className="text-xs text-stone-600 max-w-md">{s.reasoning ?? ''}</td>
                    <td className="text-right pr-3 space-x-2 whitespace-nowrap">
                      <button onClick={() => accept(s.date, s.suggestedPrice)} className="text-xs underline text-stone-700">Usar</button>
                      <button onClick={() => {
                        const v = prompt('Preço (€):', s.acceptedPrice?.toString() ?? s.suggestedPrice.toString());
                        if (v) accept(s.date, Number(v));
                      }} className="text-xs underline text-stone-700">Override</button>
                      {s.acceptedPrice != null && (
                        <button onClick={() => accept(s.date, null)} className="text-xs underline text-red-600">Limpar</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
