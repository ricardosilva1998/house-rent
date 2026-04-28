import { useEffect, useMemo, useState } from 'react';

interface Labels {
  select_dates: string;
  check_in: string;
  check_out: string;
  guests: string;
  nights: (n: number) => string;
  total: string;
  confirm: string;
  no_dates: string;
  unavailable: string;
  min_stay: (n: number) => string;
  login_required: string;
  email_not_verified: string;
  cta_login: string;
  special_requests: string;
}

type InitialUser = {
  id: string;
  name: string;
  emailVerified: boolean;
} | null;

interface Props {
  loginPath: string;
  accountPath: string;
  initialUser: InitialUser;
  maxGuests: number;
  currency: string;
  labels: Labels;
}

interface NightlyPrice {
  date: string;
  price: number;
  source: 'suggestion' | 'period' | 'base';
}

const todayIso = () => new Date().toISOString().slice(0, 10);
const addDays = (iso: string, days: number) => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const monthStart = (iso: string) => iso.slice(0, 8) + '01';
const monthName = (iso: string, locale = 'pt-PT') =>
  new Date(iso + 'T00:00:00Z').toLocaleDateString(locale, { month: 'long', year: 'numeric' });
const startOfMonthGrid = (iso: string) => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(1);
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(1 - dow);
  return d.toISOString().slice(0, 10);
};

export default function BookingFlow({
  loginPath,
  accountPath,
  initialUser,
  maxGuests,
  currency,
  labels
}: Props) {
  const [month, setMonth] = useState<string>(monthStart(todayIso()));
  const [taken, setTaken] = useState<Set<string>>(new Set());
  const [checkIn, setCheckIn] = useState<string | null>(null);
  const [checkOut, setCheckOut] = useState<string | null>(null);
  const [guests, setGuests] = useState(2);
  const [special, setSpecial] = useState('');
  const [quote, setQuote] = useState<{
    total: number;
    nightly: NightlyPrice[];
    minStay: number;
    available: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ confirmationCode: string } | null>(null);

  // Load 90-day availability window
  useEffect(() => {
    (async () => {
      const from = todayIso();
      const to = addDays(from, 365);
      const res = await fetch(`/api/availability?from=${from}&to=${to}`);
      const json = await res.json();
      if (json.ok) setTaken(new Set(json.takenDates));
    })();
  }, []);

  // Fetch quote when range changes
  useEffect(() => {
    if (!checkIn || !checkOut) {
      setQuote(null);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`/api/quote?from=${checkIn}&to=${checkOut}&guests=${guests}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setQuote({ total: j.total, nightly: j.nightly, minStay: j.minStay, available: j.available });
        else setError(j.error);
      })
      .finally(() => setLoading(false));
  }, [checkIn, checkOut, guests]);

  const days = useMemo(() => {
    const start = startOfMonthGrid(month);
    const arr: { date: string; thisMonth: boolean }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = addDays(start, i);
      arr.push({ date: d, thisMonth: d.slice(0, 7) === month.slice(0, 7) });
    }
    return arr;
  }, [month]);

  function selectDay(date: string) {
    if (date < todayIso() || taken.has(date)) return;
    if (!checkIn || (checkIn && checkOut)) {
      setCheckIn(date);
      setCheckOut(null);
      return;
    }
    if (date <= checkIn) {
      setCheckIn(date);
      setCheckOut(null);
      return;
    }
    // Validate that no taken date falls between checkIn and date
    let cursor = checkIn;
    while (cursor < date) {
      cursor = addDays(cursor, 1);
      if (cursor < date && taken.has(cursor)) {
        setCheckIn(date);
        setCheckOut(null);
        return;
      }
    }
    setCheckOut(date);
  }

  function isBetween(date: string) {
    if (!checkIn || !checkOut) return false;
    return date > checkIn && date < checkOut;
  }

  async function submitBooking() {
    if (!checkIn || !checkOut) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          checkIn,
          checkOut,
          numGuests: guests,
          specialRequests: special || undefined
        })
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setError(j.error ?? 'generic');
        if (j.error === 'dates_taken') {
          // refresh availability
          const r = await fetch(`/api/availability?from=${todayIso()}&to=${addDays(todayIso(), 365)}`);
          const a = await r.json();
          if (a.ok) setTaken(new Set(a.takenDates));
        }
        return;
      }
      setSuccess({ confirmationCode: j.booking.confirmationCode });
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-center">
        <h2 className="text-xl font-semibold text-emerald-900">✔ {labels.confirm}</h2>
        <p className="mt-2 text-emerald-900">
          {checkIn} → {checkOut}
        </p>
        <p className="mt-1 font-mono text-emerald-800">{success.confirmationCode}</p>
        <a href={accountPath} className="mt-4 inline-block underline text-emerald-900">
          {accountPath}
        </a>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-2">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{labels.select_dates}</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setMonth(addDays(month, -28).slice(0, 8) + '01')}
              className="px-3 py-1 text-sm rounded border border-stone-300"
            >
              ←
            </button>
            <span className="px-3 py-1 text-sm">{monthName(month)}</span>
            <button
              onClick={() => setMonth(addDays(addDays(month, 32), -1).slice(0, 8) + '01')}
              className="px-3 py-1 text-sm rounded border border-stone-300"
            >
              →
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-sm">
          {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((d, i) => (
            <div key={i} className="text-center text-xs text-stone-500 py-1">{d}</div>
          ))}
          {days.map(({ date, thisMonth }) => {
            const isTaken = taken.has(date);
            const past = date < todayIso();
            const selected = date === checkIn || date === checkOut;
            const between = isBetween(date);
            const disabled = isTaken || past;
            return (
              <button
                key={date}
                onClick={() => selectDay(date)}
                disabled={disabled}
                className={[
                  'aspect-square rounded text-sm relative',
                  !thisMonth ? 'text-stone-300' : '',
                  disabled ? 'line-through text-stone-300 cursor-not-allowed' : 'hover:bg-stone-100',
                  selected ? 'bg-stone-900 text-white hover:bg-stone-900' : '',
                  between ? 'bg-stone-200' : ''
                ].join(' ')}
                title={isTaken ? labels.unavailable : ''}
              >
                {Number(date.slice(8))}
              </button>
            );
          })}
        </div>
      </div>

      <aside className="rounded-lg border border-stone-200 bg-white p-5 h-fit md:sticky md:top-20">
        {!initialUser ? (
          <>
            <p className="text-sm text-stone-600 mb-3">{labels.login_required}</p>
            <a href={loginPath} className="block text-center rounded-md bg-stone-900 text-white px-4 py-2 text-sm">
              {labels.cta_login}
            </a>
          </>
        ) : !initialUser.emailVerified ? (
          <p className="text-sm text-amber-700">{labels.email_not_verified}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="block text-stone-500">{labels.check_in}</span>
                <span className="font-medium">{checkIn ?? '—'}</span>
              </div>
              <div>
                <span className="block text-stone-500">{labels.check_out}</span>
                <span className="font-medium">{checkOut ?? '—'}</span>
              </div>
            </div>
            <label className="block mt-4">
              <span className="block text-sm text-stone-500 mb-1">{labels.guests}</span>
              <input
                type="number"
                min={1}
                max={maxGuests}
                value={guests}
                onChange={(e) => setGuests(Math.min(maxGuests, Math.max(1, Number(e.target.value))))}
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block mt-3">
              <span className="block text-sm text-stone-500 mb-1">{labels.special_requests}</span>
              <textarea
                rows={2}
                value={special}
                onChange={(e) => setSpecial(e.target.value)}
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
              />
            </label>

            {!checkIn || !checkOut ? (
              <p className="mt-4 text-sm text-stone-500">{labels.no_dates}</p>
            ) : loading ? (
              <p className="mt-4 text-sm text-stone-500">…</p>
            ) : !quote ? (
              <p className="mt-4 text-sm text-red-600">{labels.unavailable}</p>
            ) : (
              <>
                <ul className="mt-4 max-h-32 overflow-y-auto text-xs text-stone-600 space-y-0.5">
                  {quote.nightly.map((n) => (
                    <li key={n.date} className="flex justify-between">
                      <span>{n.date}</span>
                      <span>{n.price.toFixed(2)} {currency}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex justify-between font-medium">
                  <span>{labels.total} ({labels.nights(quote.nightly.length)})</span>
                  <span>{quote.total.toFixed(2)} {currency}</span>
                </div>
                {quote.minStay > quote.nightly.length && (
                  <p className="mt-2 text-sm text-amber-700">{labels.min_stay(quote.minStay)}</p>
                )}
                {error && (
                  <p className="mt-2 text-sm text-red-600">
                    {error === 'dates_taken' ? labels.unavailable : error}
                  </p>
                )}
                <button
                  onClick={submitBooking}
                  disabled={submitting || !quote.available || quote.minStay > quote.nightly.length}
                  className="mt-4 w-full rounded-md bg-stone-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {submitting ? '…' : labels.confirm}
                </button>
              </>
            )}
          </>
        )}
      </aside>
    </div>
  );
}
