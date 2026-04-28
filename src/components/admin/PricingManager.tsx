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

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y!.slice(2)}`;
};

const fmtDateLong = (iso: string) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export default function PricingManager() {
  const [tab, setTab] = useState<'periods' | 'suggestions' | 'targets'>('periods');

  return (
    <div className="space-y-5">
      <nav className="admin-card flex gap-1 p-1 w-fit">
        {([
          ['periods', 'Períodos sazonais'],
          ['suggestions', 'Sugestões IA'],
          ['targets', 'Concorrentes']
        ] as const).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className="px-4 py-2 text-sm cursor-pointer transition-colors"
            style={
              tab === k
                ? { background: 'var(--ink)', color: 'var(--paper)', borderRadius: '2px', fontFamily: 'var(--font-serif)', fontWeight: 500 }
                : { color: 'var(--ink-muted)', fontFamily: 'var(--font-serif)' }
            }
          >
            {l}
          </button>
        ))}
      </nav>

      {tab === 'periods' && <PeriodsTab />}
      {tab === 'targets' && <TargetsTab />}
      {tab === 'suggestions' && <SuggestionsTab />}
    </div>
  );
}

function PeriodsTab() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', startDate: '', endDate: '', nightlyRate: 100, weekendRate: '', minStay: 1 });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const j = await fetch('/api/admin/pricing-periods').then((r) => r.json());
    if (j.ok) setPeriods(j.periods);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
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
      setShowCreate(false);
      load();
    } finally { setBusy(false); }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Remover o período "${name}"?`)) return;
    await fetch(`/api/admin/pricing-periods/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="space-y-5">
      <div className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-card-title">Períodos sazonais {loading ? '' : `· ${periods.length}`}</h2>
          <button onClick={() => setShowCreate(!showCreate)} className="btn-action cursor-pointer">
            {showCreate ? 'Cancelar' : '+ Novo período'}
          </button>
        </div>

        {showCreate && (
          <form onSubmit={add} className="p-4 grid md:grid-cols-6 gap-3" style={{ borderBottom: '1px solid var(--rule)', background: 'var(--paper)' }}>
            <div className="md:col-span-2">
              <label className="admin-label">Nome</label>
              <input className="admin-input" required placeholder="Alta época" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="admin-label">Início</label>
              <input className="admin-input" required type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <label className="admin-label">Fim</label>
              <input className="admin-input" required type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
            <div>
              <label className="admin-label">€ / noite</label>
              <input className="admin-input" type="number" step="0.01" value={form.nightlyRate} onChange={(e) => setForm({ ...form, nightlyRate: Number(e.target.value) })} />
            </div>
            <div>
              <label className="admin-label">Mínimo</label>
              <input className="admin-input" type="number" min={1} value={form.minStay} onChange={(e) => setForm({ ...form, minStay: Number(e.target.value) })} />
            </div>
            <div className="md:col-span-2">
              <label className="admin-label">€ / noite (fim-de-semana)</label>
              <input className="admin-input" type="number" step="0.01" placeholder="opcional" value={form.weekendRate} onChange={(e) => setForm({ ...form, weekendRate: e.target.value })} />
            </div>
            <div className="md:col-span-4 flex justify-end items-end">
              <button type="submit" disabled={busy} className="btn-action cursor-pointer" style={{ background: 'var(--ink)', color: 'var(--paper)', borderColor: 'var(--ink)' }}>
                {busy ? 'A guardar…' : 'Adicionar período →'}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="admin-empty">A carregar…</div>
        ) : periods.length === 0 ? (
          <div className="admin-empty">Sem períodos sazonais. Adicione o primeiro acima.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Período</th>
                  <th>Datas</th>
                  <th className="right">Noite</th>
                  <th className="right">Fim-de-semana</th>
                  <th className="right">Mín. estadia</th>
                  <th className="right">Acções</th>
                </tr>
              </thead>
              <tbody>
                {periods.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{p.name}</div>
                    </td>
                    <td>
                      <div className="num">{fmtDate(p.startDate)} → {fmtDate(p.endDate)}</div>
                    </td>
                    <td className="right num" style={{ fontWeight: 500 }}>
                      {p.nightlyRate.toFixed(0)} <span className="meta">€</span>
                    </td>
                    <td className="right num">
                      {p.weekendRate != null ? (
                        <span style={{ color: 'var(--color-ember-700)' }}>
                          {p.weekendRate.toFixed(0)} <span className="meta">€</span>
                        </span>
                      ) : <span className="meta">—</span>}
                    </td>
                    <td className="right num">
                      {p.minStay} <span className="meta">noites</span>
                    </td>
                    <td className="right">
                      <button onClick={() => remove(p.id, p.name)} className="btn-action btn-action-danger cursor-pointer">
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function TargetsTab() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ url: '', label: '', scrapeFrequency: 'daily', selectorStrategy: 'auto', selectorRecipe: '' });
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const j = await fetch('/api/admin/competitor-targets').then((r) => r.json());
    if (j.ok) setTargets(j.targets);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
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
      if (!j.ok) {
        setFlash(j.error ?? 'erro');
      } else {
        setForm({ url: '', label: '', scrapeFrequency: 'daily', selectorStrategy: 'auto', selectorRecipe: '' });
        setShowCreate(false);
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

  async function remove(t: Target) {
    if (!confirm(`Remover o concorrente "${t.label ?? t.url}"?`)) return;
    await fetch(`/api/admin/competitor-targets/${t.id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="admin-card">
      <div className="admin-card-header">
        <h2 className="admin-card-title">Concorrentes {loading ? '' : `· ${targets.length}`}</h2>
        <div className="flex gap-2">
          <button onClick={() => runNow()} disabled={running !== null} className="btn-action cursor-pointer">
            {running === 'all' ? 'A correr…' : 'Correr todos'}
          </button>
          <button onClick={() => setShowCreate(!showCreate)} className="btn-action cursor-pointer">
            {showCreate ? 'Cancelar' : '+ Adicionar'}
          </button>
        </div>
      </div>

      {showCreate && (
        <form onSubmit={add} className="p-4 grid md:grid-cols-2 gap-3" style={{ borderBottom: '1px solid var(--rule)', background: 'var(--paper)' }}>
          <div className="md:col-span-2">
            <label className="admin-label">URL do concorrente</label>
            <input className="admin-input" required type="url" placeholder="https://…" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
          </div>
          <div>
            <label className="admin-label">Etiqueta</label>
            <input className="admin-input" placeholder="opcional" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          </div>
          <div>
            <label className="admin-label">Frequência</label>
            <select className="admin-select cursor-pointer" value={form.scrapeFrequency} onChange={(e) => setForm({ ...form, scrapeFrequency: e.target.value })}>
              <option value="daily">Diário</option>
              <option value="weekly">Semanal</option>
            </select>
          </div>
          <div>
            <label className="admin-label">Estratégia</label>
            <select className="admin-select cursor-pointer" value={form.selectorStrategy} onChange={(e) => setForm({ ...form, selectorStrategy: e.target.value })}>
              <option value="auto">Auto (JSON-LD + meta)</option>
              <option value="manual">Manual (regex)</option>
            </select>
          </div>
          {form.selectorStrategy === 'manual' && (
            <div className="md:col-span-2">
              <label className="admin-label">Receita (regex)</label>
              <textarea className="admin-textarea" rows={3} placeholder="regex:/€\s?(\d{2,4}(?:[\.,]\d{2})?)/g" value={form.selectorRecipe} onChange={(e) => setForm({ ...form, selectorRecipe: e.target.value })} />
            </div>
          )}
          <div className="md:col-span-2 flex justify-end">
            <button type="submit" disabled={busy} className="btn-action cursor-pointer" style={{ background: 'var(--ink)', color: 'var(--paper)', borderColor: 'var(--ink)' }}>
              {busy ? 'A guardar…' : 'Adicionar →'}
            </button>
          </div>
        </form>
      )}

      {flash && <p className="px-4 py-2 dateline" style={{ color: 'var(--ink-muted)', borderBottom: '1px solid var(--rule)' }}>{flash}</p>}

      {loading ? (
        <div className="admin-empty">A carregar…</div>
      ) : targets.length === 0 ? (
        <div className="admin-empty">Sem concorrentes registados.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Etiqueta / URL</th>
                <th>Frequência</th>
                <th>Estado</th>
                <th>Última recolha</th>
                <th className="right">Acções</th>
              </tr>
            </thead>
            <tbody>
              {targets.map((t) => (
                <tr key={t.id} style={!t.isActive ? { opacity: 0.55 } : undefined}>
                  <td>
                    <a href={t.url} target="_blank" rel="noopener" style={{ fontWeight: 500, color: 'var(--ink)' }}>
                      {t.label ?? new URL(t.url).hostname}
                    </a>
                    <div className="meta truncate" style={{ maxWidth: '36ch' }}>{t.url}</div>
                  </td>
                  <td>
                    <span className="dateline" style={{ color: 'var(--ink-muted)' }}>{t.scrapeFrequency}</span>
                  </td>
                  <td>
                    {t.lastStatus === 'ok' ? (
                      <span className="chip chip-confirmed">ok</span>
                    ) : t.lastStatus === 'error' ? (
                      <span className="chip chip-no_show">erro</span>
                    ) : (
                      <span className="meta">—</span>
                    )}
                    {t.lastError && <div className="meta mt-1" style={{ color: 'var(--color-ember-700)', maxWidth: '32ch' }}>{t.lastError.slice(0, 80)}</div>}
                  </td>
                  <td className="meta">{fmtDateLong(t.lastScrapedAt ?? '')}</td>
                  <td className="right">
                    <div className="inline-flex gap-1.5 justify-end">
                      <button onClick={() => runNow(t.id)} disabled={running !== null} className="btn-action cursor-pointer">
                        {running === t.id ? '…' : 'Correr'}
                      </button>
                      <button onClick={() => toggle(t)} className="btn-action cursor-pointer">
                        {t.isActive ? 'Desactivar' : 'Activar'}
                      </button>
                      <button onClick={() => remove(t)} className="btn-action btn-action-danger cursor-pointer">
                        Remover
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SuggestionsTab() {
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
    <div className="admin-card">
      <div className="admin-card-header">
        <div className="flex flex-wrap gap-3 items-end flex-1">
          <div>
            <label className="admin-label">De</label>
            <input className="admin-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="admin-label">A</label>
            <input className="admin-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <button onClick={suggest} disabled={running} className="btn-action cursor-pointer" style={{ background: 'var(--ink)', color: 'var(--paper)', borderColor: 'var(--ink)' }}>
          {running ? 'A pensar…' : 'Sugerir agora (IA) →'}
        </button>
      </div>

      {flash && <p className="px-4 py-2 dateline" style={{ color: 'var(--ink-muted)', borderBottom: '1px solid var(--rule)' }}>{flash}</p>}

      {loading ? (
        <div className="admin-empty">A carregar…</div>
      ) : items.length === 0 ? (
        <div className="admin-empty">Sem sugestões. Carregue em "Sugerir agora".</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Sugerido</th>
                <th>Aceite</th>
                <th>Razão</th>
                <th className="right">Acções</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => {
                const w = Math.round((s.suggestedPrice / max) * 100);
                const aw = s.acceptedPrice != null ? Math.round((s.acceptedPrice / max) * 100) : 0;
                return (
                  <tr key={s.id}>
                    <td className="num">{fmtDate(s.date)}</td>
                    <td style={{ width: 220 }}>
                      <div className="flex items-center gap-3">
                        <div style={{ flex: 1, height: 4, background: 'var(--rule)', borderRadius: 2 }}>
                          <div style={{ width: `${w}%`, height: '100%', background: 'var(--ink)', borderRadius: 2 }} />
                        </div>
                        <span className="num" style={{ width: 56, textAlign: 'right' }}>{s.suggestedPrice.toFixed(0)} <span className="meta">€</span></span>
                      </div>
                    </td>
                    <td style={{ width: 220 }}>
                      {s.acceptedPrice != null ? (
                        <div className="flex items-center gap-3">
                          <div style={{ flex: 1, height: 4, background: 'var(--rule)', borderRadius: 2 }}>
                            <div style={{ width: `${aw}%`, height: '100%', background: 'var(--color-sage-600)', borderRadius: 2 }} />
                          </div>
                          <span className="num" style={{ width: 56, textAlign: 'right', color: 'var(--color-sage-600)' }}>{s.acceptedPrice.toFixed(0)} <span className="meta">€</span></span>
                        </div>
                      ) : <span className="meta">—</span>}
                    </td>
                    <td>
                      <p className="meta" style={{ maxWidth: '50ch', color: 'var(--ink)', fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 13 }}>
                        {s.reasoning ?? ''}
                      </p>
                    </td>
                    <td className="right">
                      <div className="inline-flex gap-1.5 justify-end">
                        <button onClick={() => accept(s.date, s.suggestedPrice)} className="btn-action cursor-pointer">Usar</button>
                        <button
                          onClick={() => {
                            const v = prompt('Preço (€):', s.acceptedPrice?.toString() ?? s.suggestedPrice.toString());
                            if (v) accept(s.date, Number(v));
                          }}
                          className="btn-action cursor-pointer"
                        >
                          Override
                        </button>
                        {s.acceptedPrice != null && (
                          <button onClick={() => accept(s.date, null)} className="btn-action btn-action-danger cursor-pointer">
                            Limpar
                          </button>
                        )}
                      </div>
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
