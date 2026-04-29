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

  return (
    <div className="space-y-6">
      <section className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-card-title">Casas ({list.length})</h2>
          <button onClick={() => setShowCreate(!showCreate)} className="btn-action">
            {showCreate ? 'Cancelar' : '+ Nova casa'}
          </button>
        </div>

        {showCreate && (
          <form onSubmit={create} className="px-4 py-4 grid md:grid-cols-4 gap-2 border-b" style={{ borderColor: 'var(--rule)' }}>
            <input required className="admin-input" placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="admin-input" placeholder="Cidade" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <input className="admin-input" placeholder="Região" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
            <div className="flex gap-2">
              <input className="admin-input" style={{ width: '5rem' }} placeholder="País" value={form.country} maxLength={2} onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })} />
              <button
                type="submit"
                disabled={creating}
                className="btn-action"
                style={{ background: 'var(--ink)', color: 'var(--paper)', borderColor: 'var(--ink)' }}
              >
                {creating ? '…' : 'Criar'}
              </button>
            </div>
          </form>
        )}

        {flash && (
          <p className="px-4 py-2 text-sm border-b" style={{ background: 'color-mix(in oklab, var(--ember) 10%, var(--paper))', color: 'var(--color-ember-700)', borderColor: 'color-mix(in oklab, var(--ember) 20%, var(--paper))' }}>
            {flash}
          </p>
        )}

        {loading ? (
          <p className="p-4 text-sm" style={{ color: 'var(--ink-muted)' }}>A carregar…</p>
        ) : list.length === 0 ? (
          <p className="p-4 text-sm" style={{ color: 'var(--ink-muted)' }}>Sem casas. Crie a primeira acima.</p>
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--rule)' }}>
            {list.map((p) => (
              <li
                key={p.id}
                className="px-4 py-3 flex items-center justify-between"
                style={activeId === p.id ? { background: 'color-mix(in oklab, var(--ink) 4%, var(--paper))' } : {}}
              >
                <button onClick={() => setActiveId(p.id)} className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-medium" style={{ color: 'var(--ink)' }}>{p.name}</span>
                    {p.isDefault && <span className="chip chip-confirmed">Pública</span>}
                    {activeId === p.id && <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>· em edição</span>}
                  </div>
                  <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>
                    {[p.city, p.region, p.country].filter(Boolean).join(' · ')} · {p.basePrice.toFixed(0)} {p.currency}
                  </p>
                </button>
                {!p.isDefault && (
                  <button onClick={() => remove(p.id)} className="btn-action btn-action-danger ml-3">Remover</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {activeId && (
        <section>
          <p className="text-xs uppercase tracking-wider mb-3" style={{ color: 'var(--ink-muted)' }}>
            A editar: {list.find((p) => p.id === activeId)?.name}
          </p>
          <PropertyEditor key={activeId} propertyId={activeId} />
        </section>
      )}
    </div>
  );
}
