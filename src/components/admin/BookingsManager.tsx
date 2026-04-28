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
  { v: '', l: 'Todos' },
  { v: 'confirmed', l: 'Confirmadas' },
  { v: 'cancelled', l: 'Canceladas' },
  { v: 'completed', l: 'Concluídas' },
  { v: 'no_show', l: 'Não-comparência' }
];

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

  useEffect(() => {
    load();
  }, [status, search]);

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
      const body: any = {
        ...form,
        numGuests: Number(form.numGuests)
      };
      if (form.override_price) body.override_price = Number(form.override_price);
      const res = await fetch('/api/admin/bookings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setCreateError(j.error ?? 'erro');
        return;
      }
      setShowCreate(false);
      setForm({ email: '', name: '', checkIn: '', checkOut: '', numGuests: 2, source: 'admin', specialRequests: '', override_price: '' });
      load();
    } finally {
      setCreating(false);
    }
  }

  const input = 'w-full rounded-md border border-stone-300 px-3 py-2 text-sm';

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <div>
          <label className="block text-xs text-stone-500 mb-1">Estado</label>
          <select className={input + ' w-44'} value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s.v} value={s.v}>
                {s.l}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs text-stone-500 mb-1">Pesquisa (código, email, nome)</label>
          <input className={input} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-md bg-stone-900 text-white px-4 py-2 text-sm"
        >
          + Nova reserva
        </button>
      </div>

      {showCreate && (
        <form onSubmit={create} className="rounded-lg border border-stone-200 bg-white p-4 mb-6 grid md:grid-cols-3 gap-3">
          <input className={input} required type="email" placeholder="Email do hóspede" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className={input} required placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className={input} required type="number" min={1} placeholder="Hóspedes" value={form.numGuests} onChange={(e) => setForm({ ...form, numGuests: Number(e.target.value) })} />
          <input className={input} required type="date" value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} />
          <input className={input} required type="date" value={form.checkOut} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} />
          <input className={input} placeholder="Origem (admin / direct / airbnb)" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
          <input className={input + ' md:col-span-2'} placeholder="Pedidos especiais" value={form.specialRequests} onChange={(e) => setForm({ ...form, specialRequests: e.target.value })} />
          <input className={input} type="number" step="0.01" placeholder="Preço total (override)" value={form.override_price} onChange={(e) => setForm({ ...form, override_price: e.target.value })} />
          {createError && <p className="md:col-span-3 text-sm text-red-600">{createError === 'dates_taken' ? 'Datas indisponíveis' : createError}</p>}
          <div className="md:col-span-3 flex gap-2 justify-end">
            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm">Cancelar</button>
            <button type="submit" disabled={creating} className="rounded-md bg-stone-900 text-white px-4 py-2 text-sm">{creating ? '…' : 'Criar'}</button>
          </div>
        </form>
      )}

      <section className="rounded-lg border border-stone-200 bg-white">
        {loading ? (
          <p className="p-4 text-sm text-stone-500">A carregar…</p>
        ) : items.length === 0 ? (
          <p className="p-4 text-sm text-stone-500">Sem reservas.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-stone-500 border-b border-stone-100">
              <tr>
                <th className="px-3 py-2">Código</th>
                <th>Hóspede</th>
                <th>Check-in</th>
                <th>Check-out</th>
                <th>Pax</th>
                <th>Total</th>
                <th>Estado</th>
                <th>Pagamento</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((b) => (
                <tr key={b.id} className="border-t border-stone-100">
                  <td className="px-3 py-2 font-mono text-stone-600">{b.confirmationCode}</td>
                  <td>
                    <div>{b.userName ?? '—'}</div>
                    <div className="text-xs text-stone-500">{b.userEmail}</div>
                  </td>
                  <td>{b.checkIn}</td>
                  <td>{b.checkOut}</td>
                  <td>{b.numGuests}</td>
                  <td>{b.quotedPrice.toFixed(2)} {b.currency}</td>
                  <td>
                    <span className={[
                      'px-2 py-0.5 rounded text-xs',
                      b.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' :
                      b.status === 'cancelled' ? 'bg-stone-200 text-stone-600' :
                      b.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                      'bg-amber-100 text-amber-800'
                    ].join(' ')}>{b.status}</span>
                  </td>
                  <td className="text-xs text-stone-600">
                    {b.paymentStatus ?? '—'}
                    {b.paidAmount != null ? ` (${b.paidAmount.toFixed(2)})` : ''}
                  </td>
                  <td className="px-3 py-2 text-right space-x-1 whitespace-nowrap">
                    <a target="_blank" rel="noopener" href={`/api/bookings/${b.id}/voucher`} className="text-xs underline text-stone-700">PDF</a>
                    {b.status === 'confirmed' && (
                      <>
                        <button onClick={() => patch(b.id, { status: 'completed' })} className="text-xs underline text-stone-700">✔ Concluir</button>
                        <button onClick={() => patch(b.id, { status: 'no_show' })} className="text-xs underline text-amber-700">No-show</button>
                        <button
                          onClick={() => {
                            const reason = prompt('Motivo do cancelamento') ?? 'admin_cancelled';
                            patch(b.id, { status: 'cancelled', cancelledReason: reason });
                          }}
                          className="text-xs underline text-red-600"
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
                        className="text-xs underline text-emerald-700"
                      >
                        Marcar pago
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
