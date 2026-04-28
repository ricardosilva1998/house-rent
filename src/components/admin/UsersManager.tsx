import { useEffect, useState } from 'react';

interface UserRow {
  id: string;
  email: string;
  name: string;
  country: string | null;
  role: 'guest' | 'admin';
  emailVerifiedAt: string | null;
  createdAt: string;
  bookings: number;
}

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
};

const flag = (country: string | null) => {
  if (!country) return '—';
  const flags: Record<string, string> = { PT: '🇵🇹', ES: '🇪🇸', FR: '🇫🇷', DE: '🇩🇪', GB: '🇬🇧', IT: '🇮🇹', US: '🇺🇸' };
  return `${flags[country] ?? ''} ${country}`.trim();
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '?';

export default function UsersManager() {
  const [items, setItems] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState('');
  const [search, setSearch] = useState('');

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (role) params.set('role', role);
    if (search) params.set('search', search);
    const j = await fetch(`/api/admin/users?${params.toString()}`).then((r) => r.json());
    if (j.ok) setItems(j.users);
    setLoading(false);
  }
  useEffect(() => { load(); }, [role, search]);

  async function toggleRole(u: UserRow) {
    const next = u.role === 'admin' ? 'guest' : 'admin';
    if (!confirm(next === 'admin' ? `Promover ${u.email} a admin?` : `Revogar admin a ${u.email}?`)) return;
    const res = await fetch(`/api/admin/users?id=${u.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role: next })
    });
    if (res.ok) load();
  }

  const totals = {
    all: items.length,
    admins: items.filter((u) => u.role === 'admin').length,
    guests: items.filter((u) => u.role === 'guest').length,
    repeats: items.filter((u) => u.bookings > 1).length
  };

  return (
    <div className="space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: totals.all },
          { label: 'Hóspedes', value: totals.guests },
          { label: 'Admins', value: totals.admins },
          { label: 'Repetentes', value: totals.repeats }
        ].map((s) => (
          <div key={s.label} className="admin-card p-4">
            <p className="serial" style={{ color: 'var(--ink-faint)' }}>{s.label}</p>
            <p className="display-tight text-[34px] mt-1" style={{ color: 'var(--ink)' }}>
              <span className="num">{s.value}</span>
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="admin-card p-4 flex flex-wrap gap-3 items-end">
        <div className="w-44">
          <label className="admin-label">Tipo</label>
          <select className="admin-select cursor-pointer" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">Todos</option>
            <option value="guest">Hóspedes</option>
            <option value="admin">Admins</option>
          </select>
        </div>
        <div className="flex-1 min-w-[220px]">
          <label className="admin-label">Pesquisar</label>
          <input
            className="admin-input"
            placeholder="Email, nome…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-card-title">Utilizadores {loading ? '' : `· ${items.length}`}</h2>
        </div>
        {loading ? (
          <div className="admin-empty">A carregar…</div>
        ) : items.length === 0 ? (
          <div className="admin-empty">Sem utilizadores.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Utilizador</th>
                  <th>País</th>
                  <th>Role</th>
                  <th className="right">Reservas</th>
                  <th>Verificado</th>
                  <th>Registado</th>
                  <th className="right">Acções</th>
                </tr>
              </thead>
              <tbody>
                {items.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center"
                          style={{
                            background: u.role === 'admin' ? 'var(--ink)' : 'var(--paper-elevated)',
                            color: u.role === 'admin' ? 'var(--paper)' : 'var(--ink)',
                            border: u.role === 'admin' ? 'none' : '1px solid var(--rule)',
                            fontFamily: 'var(--font-display)',
                            fontVariationSettings: '"opsz" 36, "wght" 540',
                            fontSize: '13px'
                          }}
                          aria-hidden="true"
                        >
                          {initials(u.name)}
                        </div>
                        <div className="min-w-0">
                          <div style={{ fontWeight: 500 }}>{u.name}</div>
                          <div className="meta truncate">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="num">{flag(u.country)}</td>
                    <td>
                      <span className={`chip chip-${u.role}`}>{u.role}</span>
                    </td>
                    <td className="right num" style={{ fontWeight: u.bookings > 1 ? 500 : 400 }}>
                      {u.bookings}
                      {u.bookings > 1 && <span className="meta ml-1">×</span>}
                    </td>
                    <td>
                      {u.emailVerifiedAt ? (
                        <span className="dateline" style={{ color: 'var(--color-sage-600)' }}>✓ verificado</span>
                      ) : (
                        <span className="dateline" style={{ color: 'var(--color-ember-600)' }}>○ pendente</span>
                      )}
                    </td>
                    <td className="meta">{fmtDate(u.createdAt)}</td>
                    <td className="right">
                      <button
                        onClick={() => toggleRole(u)}
                        className={`btn-action cursor-pointer ${u.role === 'admin' ? 'btn-action-danger' : ''}`}
                      >
                        {u.role === 'admin' ? 'Revogar admin' : 'Promover admin'}
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
