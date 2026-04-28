import { useEffect, useState } from 'react';

interface Booking {
  id: string;
  confirmationCode: string;
  checkIn: string;
  checkOut: string;
  numGuests: number;
  quotedPrice: number;
  currency: string;
  status: 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  source: string;
  paymentStatus: string | null;
  paidAmount: number | null;
  specialRequests: string | null;
  userName: string | null;
  userEmail: string | null;
  createdAt: string;
}

const STATUSES = [
  { v: '', l: 'Todos os estados' },
  { v: 'confirmed', l: 'Confirmadas' },
  { v: 'completed', l: 'Concluídas' },
  { v: 'cancelled', l: 'Canceladas' },
  { v: 'no_show', l: 'Não-comparência' }
];

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y!.slice(2)}`;
};

const nights = (checkIn: string, checkOut: string) => {
  const a = new Date(checkIn + 'T00:00:00Z').getTime();
  const b = new Date(checkOut + 'T00:00:00Z').getTime();
  return Math.round((b - a) / (24 * 3600 * 1000));
};

export default function BookingsManager() {
  const [items, setItems] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: '',
    name: '',
    checkIn: '',
    checkOut: '',
    numGuests: 2,
    source: 'admin',
    specialRequests: '',
    override_price: ''
  });

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (search) params.set('search', search);
    const res = await fetch(`/api/admin/bookings?${params.toString()}`);
    const json = await res.json();
    if (json.ok) setItems(json.bookings);
    setLoading(false);
  }
  useEffect(() => { load(); }, [status, search]);

  async function patch(id: string, body: any) {
    const res = await fetch(`/api/admin/bookings/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    const j = await res.json();
    if (j.ok) load();
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const body: any = { ...form, numGuests: Number(form.numGuests) };
      if (form.override_price) body.override_price = Number(form.override_price);
      const res = await fetch('/api/admin/bookings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setCreateError(j.error === 'dates_taken' ? 'Datas indisponíveis' : (j.error ?? 'erro'));
        return;
      }
      setShowCreate(false);
      setForm({ email: '', name: '', checkIn: '', checkOut: '', numGuests: 2, source: 'admin', specialRequests: '', override_price: '' });
      load();
    } finally { setCreating(false); }
  }

  return (
    <div className="space-y-5">
      {/* Filter / search bar */}
      <div className="admin-card">
        <div className="p-4 flex flex-wrap gap-3 items-end">
          <div className="w-48">
            <label className="admin-label">Estado</label>
            <select className="admin-select cursor-pointer" value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUSES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[220px]">
            <label className="admin-label">Pesquisar</label>
            <input
              className="admin-input"
              placeholder="Código, email, nome…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button onClick={() => setShowCreate(!showCreate)} className="btn-action cursor-pointer">
            {showCreate ? 'Cancelar' : '+ Nova reserva'}
          </button>
        </div>

        {showCreate && (
          <form onSubmit={create} className="px-4 pb-5 pt-1 grid md:grid-cols-3 gap-3" style={{ borderTop: '1px solid var(--rule)' }}>
            <div className="md:col-span-2">
              <label className="admin-label">Email do hóspede</label>
              <input className="admin-input" required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="admin-label">Nome</label>
              <input className="admin-input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="admin-label">Check-in</label>
              <input className="admin-input" required type="date" value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} />
            </div>
            <div>
              <label className="admin-label">Check-out</label>
              <input className="admin-input" required type="date" value={form.checkOut} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} />
            </div>
            <div>
              <label className="admin-label">Hóspedes</label>
              <input className="admin-input" required type="number" min={1} value={form.numGuests} onChange={(e) => setForm({ ...form, numGuests: Number(e.target.value) })} />
            </div>
            <div>
              <label className="admin-label">Origem</label>
              <input className="admin-input" placeholder="admin / direct / airbnb" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className="admin-label">Pedidos especiais</label>
              <input className="admin-input" value={form.specialRequests} onChange={(e) => setForm({ ...form, specialRequests: e.target.value })} />
            </div>
            <div>
              <label className="admin-label">Preço total (override)</label>
              <input className="admin-input" type="number" step="0.01" placeholder="auto" value={form.override_price} onChange={(e) => setForm({ ...form, override_price: e.target.value })} />
            </div>
            {createError && (
              <p className="md:col-span-3 dateline" style={{ color: 'var(--color-ember-600)' }}>{createError}</p>
            )}
            <div className="md:col-span-3 flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowCreate(false)} className="btn-action cursor-pointer">Cancelar</button>
              <button type="submit" disabled={creating} className="btn-action cursor-pointer" style={{ background: 'var(--ink)', color: 'var(--paper)', borderColor: 'var(--ink)' }}>
                {creating ? 'A criar…' : 'Criar reserva →'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Table */}
      <div className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-card-title">Reservas {loading ? '' : `· ${items.length}`}</h2>
          <p className="serial" style={{ color: 'var(--ink-faint)' }}>{status ? STATUSES.find((s) => s.v === status)?.l : 'todas'}</p>
        </div>
        {loading ? (
          <div className="admin-empty">A carregar…</div>
        ) : items.length === 0 ? (
          <div className="admin-empty">Sem reservas.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Hóspede</th>
                  <th>Datas</th>
                  <th className="right">Pax</th>
                  <th className="right">Total</th>
                  <th>Estado</th>
                  <th>Pagamento</th>
                  <th>Origem</th>
                  <th className="right">Acções</th>
                </tr>
              </thead>
              <tbody>
                {items.map((b) => (
                  <tr key={b.id}>
                    <td className="num" style={{ color: 'var(--ink)' }}>{b.confirmationCode}</td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{b.userName ?? '—'}</div>
                      <div className="meta">{b.userEmail}</div>
                    </td>
                    <td>
                      <div className="num">{fmtDate(b.checkIn)} → {fmtDate(b.checkOut)}</div>
                      <div className="meta">{nights(b.checkIn, b.checkOut)} noites</div>
                    </td>
                    <td className="right num">{b.numGuests}</td>
                    <td className="right num" style={{ fontWeight: 500 }}>
                      {b.quotedPrice.toFixed(0)} <span className="meta">{b.currency}</span>
                    </td>
                    <td>
                      <span className={`chip chip-${b.status}`}>{b.status.replace('_', ' ')}</span>
                    </td>
                    <td>
                      {b.paymentStatus ? (
                        <span className={`chip chip-${b.paymentStatus}`}>
                          {b.paymentStatus}
                          {b.paidAmount != null ? ` · ${b.paidAmount.toFixed(0)}` : ''}
                        </span>
                      ) : <span className="meta">—</span>}
                    </td>
                    <td className="meta">{b.source}</td>
                    <td className="right">
                      <div className="inline-flex gap-1.5 flex-wrap justify-end">
                        <a target="_blank" rel="noopener" href={`/api/bookings/${b.id}/voucher`} className="btn-action cursor-pointer">PDF</a>
                        {b.status === 'confirmed' && (
                          <>
                            <button onClick={() => patch(b.id, { status: 'completed' })} className="btn-action cursor-pointer">Concluir</button>
                            <button onClick={() => patch(b.id, { status: 'no_show' })} className="btn-action btn-action-danger cursor-pointer">No-show</button>
                            <button
                              onClick={() => {
                                const reason = prompt('Motivo do cancelamento') ?? 'admin_cancelled';
                                patch(b.id, { status: 'cancelled', cancelledReason: reason });
                              }}
                              className="btn-action btn-action-danger cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </>
                        )}
                        {b.paymentStatus !== 'paid' && b.status !== 'cancelled' && (
                          <button
                            onClick={() => {
                              const v = prompt(`Valor pago (${b.currency})`, String(b.quotedPrice));
                              if (!v) return;
                              patch(b.id, { paymentStatus: 'paid', paidAmount: Number(v) });
                            }}
                            className="btn-action cursor-pointer"
                          >
                            Marcar pago
                          </button>
                        )}
                      </div>
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
