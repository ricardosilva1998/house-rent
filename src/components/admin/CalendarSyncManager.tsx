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
        <section className="admin-card p-4">
          <h3 className="font-medium mb-2">Feed de exportação</h3>
          <p className="text-sm mb-2" style={{ color: 'var(--ink-muted)' }}>
            Adicione este URL ao Airbnb / Booking para sincronizar as nossas reservas com essas plataformas.
          </p>
          <div className="flex gap-2 items-center">
            <code
              className="flex-1 px-3 py-2 text-sm break-all"
              style={{ background: 'color-mix(in oklab, var(--ink) 4%, var(--paper))', border: '1px solid var(--rule)', borderRadius: '2px' }}
            >
              {exportUrl}
            </code>
            <button onClick={() => navigator.clipboard.writeText(exportUrl)} className="btn-action">
              Copiar
            </button>
          </div>
        </section>
      )}

      <section className="admin-card p-4">
        <h3 className="font-medium mb-3">Feeds importados (Airbnb, Booking, etc.)</h3>
        <div className="grid md:grid-cols-3 gap-2 mb-4">
          <input
            className="admin-input"
            placeholder="Nome (ex: Airbnb)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            className="admin-input md:col-span-2"
            placeholder="URL .ics"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
          />
          <div className="md:col-span-3 flex justify-between items-center">
            <button onClick={() => runImport()} disabled={running !== null} className="btn-action">
              {running === 'all' ? '…' : 'Importar todos agora'}
            </button>
            <button
              onClick={add}
              disabled={busy || !form.name || !form.url}
              className="btn-action"
              style={{ background: 'var(--ink)', color: 'var(--paper)', borderColor: 'var(--ink)' }}
            >
              + Adicionar
            </button>
          </div>
        </div>
        {flash && <p className="text-sm mb-3" style={{ color: 'var(--ink-muted)' }}>{flash}</p>}
        <table className="admin-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>URL</th>
              <th>Última sinc.</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {feeds.length === 0 && (
              <tr><td colSpan={5} className="muted py-3">—</td></tr>
            )}
            {feeds.map((f) => (
              <tr key={f.id}>
                <td>{f.name}</td>
                <td className="meta truncate" style={{ maxWidth: '18rem' }}>{f.url}</td>
                <td>{f.lastSyncedAt ? new Date(f.lastSyncedAt).toLocaleString('pt-PT') : '—'}</td>
                <td>
                  <span style={{
                    color: f.lastStatus === 'ok'
                      ? 'var(--color-sage-600)'
                      : f.lastStatus === 'error'
                        ? 'var(--color-ember-600)'
                        : 'var(--ink-muted)'
                  }}>
                    {f.lastStatus ?? '—'}
                  </span>
                  {f.lastError && (
                    <div className="text-xs truncate" style={{ maxWidth: '18rem', color: 'var(--color-ember-600)' }}>
                      {f.lastError}
                    </div>
                  )}
                </td>
                <td className="right" style={{ whiteSpace: 'nowrap' }}>
                  <div className="flex gap-1 justify-end">
                    <button onClick={() => runImport(f.id)} disabled={running !== null} className="btn-action">
                      {running === f.id ? '…' : 'Importar'}
                    </button>
                    <button onClick={() => toggle(f)} className="btn-action">
                      {f.isActive ? 'Desativar' : 'Ativar'}
                    </button>
                    <button onClick={() => remove(f.id)} className="btn-action btn-action-danger">Remover</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section
        className="admin-card p-4"
        style={{
          borderColor: 'color-mix(in oklab, var(--color-ember-500) 40%, var(--rule))',
          background: 'color-mix(in oklab, var(--color-ember-500) 6%, var(--paper))'
        }}
      >
        <h3 className="font-medium mb-2" style={{ color: 'var(--color-ember-700)' }}>
          Conflitos detectados ({conflicts.length})
        </h3>
        {conflicts.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--color-sage-600)' }}>
            Sem conflitos entre os feeds e as reservas internas.
          </p>
        ) : (
          <ul className="text-sm space-y-2">
            {conflicts.map((c, i) => (
              <li key={i} className="admin-card p-3">
                <p>
                  <strong>{c.feedName}</strong>: {c.blockStart} → {c.blockEnd}
                  {' '}· bloco "{c.blockSummary ?? '—'}"
                </p>
                <p style={{ color: 'var(--ink-muted)' }}>
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
