import { useEffect, useState } from 'react';
import PropertyEditor from './PropertyEditor';

interface PropertyRow {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  region: string | null;
  country: string;
  basePrice: number;
  currency: string;
  isDefault: boolean;
  createdAt: string;
}

export default function PropertiesManager() {
  const [list, setList] = useState<PropertyRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', city: '', region: '', country: 'PT' });
  const [flash, setFlash] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const j = await fetch('/api/admin/property').then((r) => r.json());
    if (j.ok) {
      setList(j.properties);
      if (!activeId && j.properties.length) setActiveId(j.properties[0].id);
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name) return;
    setCreating(true);
    setFlash(null);
    try {
      const res = await fetch('/api/admin/property', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form)
      });
      const j = await res.json();
      if (!j.ok) {
        setFlash('Erro: ' + (j.error ?? '—'));
        return;
      }
      setShowCreate(false);
      setForm({ name: '', city: '', region: '', country: 'PT' });
      setActiveId(j.property.id);
      load();
    } finally { setCreating(false); }
  }

  async function remove(id: string) {
    const p = list.find((x) => x.id === id);
    if (!p) return;
    if (!confirm(`Remover "${p.name}"? Esta acção não pode ser desfeita.`)) return;
    const res = await fetch(`/api/admin/property?id=${id}`, { method: 'DELETE' });
    const j = await res.json();
    if (!j.ok) {
      if (j.error === 'has_bookings') {
        setFlash(`Não é possível remover: tem ${j.bookings} reserva(s) associadas.`);
      } else {
        setFlash('Erro: ' + (j.error ?? '—'));
      }
      return;
    }
    if (activeId === id) setActiveId(null);
    load();
  }

  const input = 'rounded-md border border-stone-300 px-3 py-2 text-sm';

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-stone-200 bg-white">
        <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
          <h2 className="font-medium text-stone-900">Casas ({list.length})</h2>
          <button onClick={() => setShowCreate(!showCreate)} className="text-xs underline">
            {showCreate ? 'Cancelar' : '+ Nova casa'}
          </button>
        </div>

        {showCreate && (
          <form onSubmit={create} className="px-4 py-4 grid md:grid-cols-4 gap-2 border-b border-stone-100">
            <input required className={input} placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className={input} placeholder="Cidade" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <input className={input} placeholder="Região" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
            <div className="flex gap-2">
              <input className={input + ' w-20'} placeholder="País" value={form.country} maxLength={2} onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })} />
              <button type="submit" disabled={creating} className="rounded-md bg-stone-900 text-white px-4 py-2 text-sm">{creating ? '…' : 'Criar'}</button>
            </div>
          </form>
        )}

        {flash && <p className="px-4 py-2 text-sm bg-amber-50 text-amber-900 border-b border-amber-100">{flash}</p>}

        {loading ? (
          <p className="p-4 text-sm text-stone-500">A carregar…</p>
        ) : list.length === 0 ? (
          <p className="p-4 text-sm text-stone-500">Sem casas. Crie a primeira acima.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {list.map((p) => (
              <li key={p.id} className={`px-4 py-3 flex items-center justify-between ${activeId === p.id ? 'bg-stone-50' : ''}`}>
                <button onClick={() => setActiveId(p.id)} className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-stone-900">{p.name}</span>
                    {p.isDefault && <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider bg-emerald-100 text-emerald-800 rounded">Pública</span>}
                    {activeId === p.id && <span className="text-stone-400 text-xs">· em edição</span>}
                  </div>
                  <p className="text-xs text-stone-500">
                    {[p.city, p.region, p.country].filter(Boolean).join(' · ')} · {p.basePrice.toFixed(0)} {p.currency}
                  </p>
                </button>
                {!p.isDefault && (
                  <button onClick={() => remove(p.id)} className="text-xs text-red-600 underline ml-3">Remover</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {activeId && (
        <section>
          <p className="text-xs uppercase tracking-wider text-stone-500 mb-3">A editar: {list.find((p) => p.id === activeId)?.name}</p>
          <PropertyEditor key={activeId} propertyId={activeId} />
        </section>
      )}
    </div>
  );
}
