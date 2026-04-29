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

  return (
    <form onSubmit={submit} className="space-y-7">
      {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
        <label className="block">
          <span className="field-label">{labels.email}</span>
          <input type="email" required className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
      )}
      {mode === 'register' && (
        <>
          <label className="block">
            <span className="field-label">{labels.name}</span>
            <input required className="field" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-6">
            <label className="block">
              <span className="field-label">{labels.phone}</span>
              <input className="field" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
            <label className="block">
              <span className="field-label">{labels.country}</span>
              <input className="field" value={country} onChange={(e) => setCountry(e.target.value)} />
            </label>
          </div>
        </>
      )}
      {(mode === 'login' || mode === 'register' || mode === 'reset') && (
        <label className="block">
          <span className="field-label">
            {mode === 'reset' ? labels.new_password : labels.password}
          </span>
          <input type="password" required minLength={8} className="field" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
      )}
      {mode === 'reset' && !initialToken && (
        <label className="block">
          <span className="field-label">Token</span>
          <input required className="field" value={token} onChange={(e) => setToken(e.target.value)} />
        </label>
      )}
      {error && <p role="alert" className="dateline" style={{ color: 'var(--ember)' }}>{error}</p>}
      {done && <p role="alert" className="dateline" style={{ color: 'var(--sage)' }}>{done}</p>}
      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full justify-center disabled:opacity-60"
        style={{ display: 'flex' }}
      >
        {loading ? '…' : labels.submit} <span aria-hidden="true">→</span>
      </button>
    </form>
  );
}
