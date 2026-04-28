import { useState } from 'react';

interface Props {
  next?: string;
}

export default function AdminAuthForm({ next }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        if (j.error === 'forbidden') setError('Esta conta não tem permissões de administração.');
        else if (j.error === 'invalid_credentials') setError('Credenciais inválidas.');
        else setError('Não foi possível iniciar sessão. Tente novamente.');
        return;
      }
      window.location.href = next ?? '/admin';
    } catch {
      setError('Erro de rede. Verifique a ligação.');
    } finally {
      setLoading(false);
    }
  }

  const input = 'w-full rounded-md border border-stone-300 px-3 py-2.5 text-sm bg-white focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 focus:outline-none transition';

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="block text-xs font-medium text-stone-600 uppercase tracking-wider mb-1.5">Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          autoFocus
          className={input}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label className="block">
        <span className="block text-xs font-medium text-stone-600 uppercase tracking-wider mb-1.5">Palavra-passe</span>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="current-password"
          className={input}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error && (
        <p className="text-sm rounded-md bg-red-50 text-red-700 border border-red-200 px-3 py-2">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-stone-900 text-white py-2.5 text-sm font-medium hover:bg-stone-800 disabled:opacity-60 transition"
      >
        {loading ? 'A iniciar sessão…' : 'Entrar no painel'}
      </button>
    </form>
  );
}
