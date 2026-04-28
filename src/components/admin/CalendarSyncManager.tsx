import { useEffect, useState } from 'react';

interface Feed {
  id: string;
  name: string;
  url: string;
  lastSyncedAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
  isActive: boolean;
}

interface Conflict {
  blockId: string;
  feedName: string;
  blockStart: string;
  blockEnd: string;
  blockSummary: string | null;
  bookingId: string;
  confirmationCode: string;
  bookingCheckIn: string;
  bookingCheckOut: string;
}

export default function CalendarSyncManager() {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [exportToken, setExportToken] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [form, setForm] = useState({ name: '', url: '' });
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const input = 'rounded-md border border-stone-300 px-3 py-2 text-sm';

  async function load() {
    const [a, b] = await Promise.all([
      fetch('/api/admin/ical-feeds').then((r) => r.json()),
      fetch('/api/admin/ical-conflicts').then((r) => r.json())
    ]);
    if (a.ok) {
      setFeeds(a.feeds);
      setExportToken(a.exportToken);
    }
    if (b.ok) setConflicts(b.conflicts);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!form.name || !form.url) return;
    setBusy(true);
    try {
      await fetch('/api/admin/ical-feeds', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form)
      });
      setForm({ name: '', url: '' });
      load();
    } finally { setBusy(false); }
  }

  async function runImport(feedId?: string) {
    setRunning(feedId ?? 'all');
    setFlash(null);
    try {
      const res = await fetch('/api/admin/run-ical-import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(feedId ? { feedId } : {})
      });
      const j = await res.json();
      if (j.ok) {
        setFlash('Importação concluída.');
        load();
      } else {
        setFlash('Erro: ' + (j.error ?? '—'));
      }
    } finally { setRunning(null); }
  }

  async function toggle(f: Feed) {
    await fetch(`/api/admin/ical-feeds/${f.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ isActive: !f.isActive })
    });
    load();
  }

  async function remove(id: string) {
    if (!confirm('Remover feed?')) return;
    await fetch(`/api/admin/ical-feeds/${id}`, { method: 'DELETE' });
    load();
  }

  const exportUrl = exportToken
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/ical/${exportToken}.ics`
    : '';

  return (
    <div className="space-y-6">
      {exportToken && (
        <section className="rounded-lg border border-stone-200 bg-white p-4">
          <h3 className="font-medium mb-2">Feed de exportação</h3>
          <p className="text-sm text-stone-600 mb-2">Adicione este URL ao Airbnb / Booking para sincronizar as nossas reservas com essas plataformas.</p>
          <div className="flex gap-2 items-center">
            <code className="flex-1 px-3 py-2 bg-stone-50 rounded border border-stone-200 text-sm break-all">{exportUrl}</code>
            <button
              onClick={() => navigator.clipboard.writeText(exportUrl)}
              className="rounded-md border border-stone-300 px-3 py-2 text-sm"
            >
              Copiar
            </button>
          </div>
        </section>
      )}

      <section className="rounded-lg border border-stone-200 bg-white p-4">
        <h3 className="font-medium mb-3">Feeds importados (Airbnb, Booking, etc.)</h3>
        <div className="grid md:grid-cols-3 gap-2 mb-4">
          <input className={input} placeholder="Nome (ex: Airbnb)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className={input + ' md:col-span-2'} placeholder="URL .ics" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
          <div className="md:col-span-3 flex justify-between items-center">
            <button onClick={() => runImport()} disabled={running !== null} className="text-sm underline">
              {running === 'all' ? '…' : 'Importar todos agora'}
            </button>
            <button onClick={add} disabled={busy || !form.name || !form.url} className="rounded-md bg-stone-900 text-white px-4 py-2 text-sm">+ Adicionar</button>
          </div>
        </div>
        {flash && <p className="text-sm text-stone-600 mb-3">{flash}</p>}
        <table className="w-full text-sm">
          <thead className="text-left text-stone-500">
            <tr><th className="py-2">Nome</th><th>URL</th><th>Última sinc.</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            {feeds.length === 0 && <tr><td colSpan={5} className="py-3 text-stone-500">—</td></tr>}
            {feeds.map((f) => (
              <tr key={f.id} className="border-t border-stone-100">
                <td className="py-2">{f.name}</td>
                <td className="text-xs text-stone-500 truncate max-w-xs">{f.url}</td>
                <td>{f.lastSyncedAt ? new Date(f.lastSyncedAt).toLocaleString('pt-PT') : '—'}</td>
                <td className={f.lastStatus === 'ok' ? 'text-emerald-700' : f.lastStatus === 'error' ? 'text-red-600' : 'text-stone-500'}>
                  {f.lastStatus ?? '—'}
                  {f.lastError && <div className="text-xs text-red-600 truncate max-w-xs">{f.lastError}</div>}
                </td>
                <td className="text-right space-x-2 whitespace-nowrap">
                  <button onClick={() => runImport(f.id)} disabled={running !== null} className="text-xs underline">{running === f.id ? '…' : 'Importar'}</button>
                  <button onClick={() => toggle(f)} className="text-xs underline">{f.isActive ? 'Desativar' : 'Ativar'}</button>
                  <button onClick={() => remove(f.id)} className="text-xs underline text-red-600">Remover</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-lg border border-amber-300 bg-amber-50 p-4">
        <h3 className="font-medium text-amber-900 mb-2">Conflitos detectados ({conflicts.length})</h3>
        {conflicts.length === 0 ? (
          <p className="text-sm text-amber-900/80">Sem conflitos entre os feeds e as reservas internas. ✔</p>
        ) : (
          <ul className="text-sm space-y-2">
            {conflicts.map((c, i) => (
              <li key={i} className="rounded-md bg-white border border-amber-200 p-3">
                <p>
                  <strong>{c.feedName}</strong>: {c.blockStart} → {c.blockEnd}
                  {' '}· bloco "{c.blockSummary ?? '—'}"
                </p>
                <p className="text-stone-700">
                  vs reserva <code className="font-mono">{c.confirmationCode}</code> · {c.bookingCheckIn} → {c.bookingCheckOut}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
