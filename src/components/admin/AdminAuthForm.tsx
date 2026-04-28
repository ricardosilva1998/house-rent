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

  return (
    <form onSubmit={submit} className="space-y-7">
      <label className="block">
        <span className="field-label">Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          autoFocus
          className="field"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label className="block">
        <span className="field-label">Palavra-passe</span>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="current-password"
          className="field"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error && (
        <p className="dateline" style={{ color: 'var(--ember)' }}>
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full justify-center disabled:opacity-60"
        style={{ display: 'flex' }}
      >
        {loading ? 'A iniciar sessão…' : 'Entrar no painel'}
        <span aria-hidden="true">→</span>
      </button>
    </form>
  );
}
