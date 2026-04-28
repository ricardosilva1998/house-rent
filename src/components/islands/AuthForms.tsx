import { useState } from 'react';

type Mode = 'login' | 'register' | 'forgot' | 'reset';

interface Props {
  mode: Mode;
  next?: string;
  initialToken?: string;
  labels: {
    email: string;
    password: string;
    name: string;
    phone: string;
    country: string;
    submit: string;
    forgot: string;
    new_password: string;
    error_invalid_credentials: string;
    error_email_exists: string;
    error_generic: string;
    success_check_email: string;
    success_password_reset: string;
  };
}

export default function AuthForms({ mode, next, initialToken, labels }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [token, setToken] = useState(initialToken ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const errFor = (code: string) =>
    code === 'invalid_credentials'
      ? labels.error_invalid_credentials
      : code === 'email_exists'
      ? labels.error_email_exists
      : labels.error_generic;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(null);
    setLoading(true);
    try {
      let res: Response;
      if (mode === 'login') {
        res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
      } else if (mode === 'register') {
        res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email, password, name, phone, country })
        });
      } else if (mode === 'forgot') {
        res = await fetch('/api/auth/request-password-reset', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email })
        });
      } else {
        res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token, password })
        });
      }
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(errFor(json.error ?? 'generic'));
        return;
      }
      if (mode === 'login' || mode === 'register') {
        window.location.href = next ?? '/conta';
        return;
      }
      if (mode === 'forgot') setDone(labels.success_check_email);
      if (mode === 'reset') setDone(labels.success_password_reset);
    } catch {
      setError(labels.error_generic);
    } finally {
      setLoading(false);
    }
  }

  const input =
    'w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-stone-900';

  return (
    <form onSubmit={submit} className="space-y-3 max-w-sm">
      {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
        <label className="block">
          <span className="text-sm font-medium text-stone-700">{labels.email}</span>
          <input type="email" required className={input} value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
      )}
      {mode === 'register' && (
        <>
          <label className="block">
            <span className="text-sm font-medium text-stone-700">{labels.name}</span>
            <input required className={input} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-stone-700">{labels.phone}</span>
            <input className={input} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-stone-700">{labels.country}</span>
            <input className={input} value={country} onChange={(e) => setCountry(e.target.value)} />
          </label>
        </>
      )}
      {(mode === 'login' || mode === 'register' || mode === 'reset') && (
        <label className="block">
          <span className="text-sm font-medium text-stone-700">
            {mode === 'reset' ? labels.new_password : labels.password}
          </span>
          <input type="password" required minLength={8} className={input} value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
      )}
      {mode === 'reset' && !initialToken && (
        <label className="block">
          <span className="text-sm font-medium text-stone-700">Token</span>
          <input required className={input} value={token} onChange={(e) => setToken(e.target.value)} />
        </label>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {done && <p className="text-sm text-emerald-700">{done}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-stone-900 text-white px-4 py-2 text-sm font-medium hover:bg-stone-800 disabled:opacity-60"
      >
        {loading ? '…' : labels.submit}
      </button>
    </form>
  );
}
