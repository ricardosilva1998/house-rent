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

  const input = 'rounded-md border border-stone-300 px-3 py-2 text-sm';

  return (
    <div>
      <div className="flex flex-wrap gap-3 items-end mb-5">
        <div>
          <label className="block text-xs text-stone-500 mb-1">Tipo</label>
          <select className={input + ' w-44'} value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">Todos</option>
            <option value="guest">Hóspedes</option>
            <option value="admin">Admins</option>
          </select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs text-stone-500 mb-1">Pesquisa (email, nome)</label>
          <input className={input + ' w-full'} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <section className="rounded-lg border border-stone-200 bg-white">
        {loading ? (
          <p className="p-4 text-sm text-stone-500">A carregar…</p>
        ) : items.length === 0 ? (
          <p className="p-4 text-sm text-stone-500">Sem utilizadores.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-stone-500 border-b border-stone-100">
              <tr>
                <th className="px-3 py-2">Nome</th>
                <th>Email</th>
                <th>País</th>
                <th>Role</th>
                <th>Reservas</th>
                <th>Verificado</th>
                <th>Criado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id} className="border-t border-stone-100">
                  <td className="px-3 py-2">{u.name}</td>
                  <td className="text-stone-700">{u.email}</td>
                  <td>{u.country ?? '—'}</td>
                  <td>
                    <span className={`px-2 py-0.5 rounded text-xs ${u.role === 'admin' ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-700'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="numeral">{u.bookings}</td>
                  <td className="text-xs text-stone-500">{u.emailVerifiedAt ? '✓' : '—'}</td>
                  <td className="text-xs text-stone-500">{new Date(u.createdAt).toLocaleDateString('pt-PT')}</td>
                  <td className="text-right pr-3">
                    <button onClick={() => toggleRole(u)} className="text-xs underline text-stone-700">
                      {u.role === 'admin' ? 'Revogar admin' : 'Promover admin'}
                    </button>
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
