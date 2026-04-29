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
  account: string;
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
  const dow = (d.getUTCDay() + 6) % 7;
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

  useEffect(() => {
    (async () => {
      const from = todayIso();
      const to = addDays(from, 365);
      const res = await fetch(`/api/availability?from=${from}&to=${to}`);
      const json = await res.json();
      if (json.ok) setTaken(new Set(json.takenDates));
    })();
  }, []);

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
      <div className="max-w-2xl mx-auto py-10 text-center reveal reveal-1">
        <p className="serial mb-4" style={{ color: 'var(--sage)' }}>Confirmado · Confirmed</p>
        <p className="display text-[clamp(40px,5vw,72px)]" style={{ color: 'var(--ink)' }}>
          {labels.confirm}
        </p>
        <hr className="rule-strong w-12 mx-auto mt-8 mb-6" />
        <p className="dateline">{checkIn} → {checkOut}</p>
        <p className="display-italic text-[36px] mt-3" style={{ color: 'var(--ember)' }}>
          {success.confirmationCode}
        </p>
        <a href={accountPath} className="mt-10 inline-flex items-center gap-3 btn-ghost">
          {labels.account} <span aria-hidden="true">→</span>
        </a>
      </div>
    );
  }

  const dayNames: { abbr: string; title: string }[] = [
    { abbr: 'S', title: 'Segunda-feira' },
    { abbr: 'T', title: 'Terça-feira' },
    { abbr: 'Q', title: 'Quarta-feira' },
    { abbr: 'Q', title: 'Quinta-feira' },
    { abbr: 'S', title: 'Sexta-feira' },
    { abbr: 'S', title: 'Sábado' },
    { abbr: 'D', title: 'Domingo' },
  ];

  return (
    <div className="grid lg:grid-cols-12 gap-x-10 gap-y-12">
      <div className="lg:col-span-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="serial mb-2" style={{ color: 'var(--ink-faint)' }}>Calendário</p>
            <p className="display-italic text-[36px] capitalize" style={{ color: 'var(--ink)' }}>
              {monthName(month)}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setMonth(addDays(month, -28).slice(0, 8) + '01')}
              className="w-10 h-10 inline-flex items-center justify-center transition-colors"
              style={{ border: '1px solid var(--rule)', color: 'var(--ink)' }}
              aria-label="Previous month"
            >
              ←
            </button>
            <button
              onClick={() => setMonth(addDays(addDays(month, 32), -1).slice(0, 8) + '01')}
              className="w-10 h-10 inline-flex items-center justify-center transition-colors"
              style={{ border: '1px solid var(--rule)', color: 'var(--ink)' }}
              aria-label="Next month"
            >
              →
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {dayNames.map((d, i) => (
            <div key={i} className="text-center serial py-2" style={{ color: 'var(--ink-faint)' }}>
              <abbr title={d.title} style={{ textDecoration: 'none' }}>{d.abbr}</abbr>
            </div>
          ))}
          {days.map(({ date, thisMonth }) => {
            const isTaken = taken.has(date);
            const past = date < todayIso();
            const selected = date === checkIn || date === checkOut;
            const between = isBetween(date);
            const disabled = isTaken || past;
            const day = Number(date.slice(8));
            return (
              <button
                key={date}
                onClick={() => selectDay(date)}
                disabled={disabled}
                className="aspect-square min-h-[44px] text-[15px] relative transition-all"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontVariationSettings: '"opsz" 36, "SOFT" 30, "wght" 380',
                  color: !thisMonth
                    ? 'var(--ink-faint)'
                    : disabled
                      ? 'var(--ink-faint)'
                      : selected
                        ? 'var(--paper)'
                        : 'var(--ink)',
                  background: selected
                    ? 'var(--ink)'
                    : between
                      ? 'var(--paper-elevated)'
                      : 'transparent',
                  textDecoration: isTaken ? 'line-through' : 'none',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  border: between || selected ? 'none' : '1px solid transparent',
                  borderTop: '1px solid var(--rule)',
                  opacity: disabled ? 0.45 : 1
                }}
                title={isTaken ? labels.unavailable : ''}
              >
                {day}
                {selected && (
                  <span
                    className="serial absolute top-1 left-1 text-[8px]"
                    style={{ color: 'rgba(245,241,235,0.7)' }}
                  >
                    {date === checkIn ? 'IN' : 'OUT'}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-8 flex flex-wrap gap-x-8 gap-y-2 dateline">
          <span className="flex items-center gap-2">
            <span style={{ width: 14, height: 14, background: 'var(--ink)', display: 'inline-block' }}></span>
            {labels.check_in} / {labels.check_out}
          </span>
          <span className="flex items-center gap-2">
            <span style={{ width: 14, height: 14, background: 'var(--paper-elevated)', border: '1px solid var(--rule)', display: 'inline-block' }}></span>
            {labels.total}
          </span>
          <span className="flex items-center gap-2" style={{ textDecoration: 'line-through', color: 'var(--ink-faint)' }}>
            {labels.unavailable}
          </span>
        </div>
      </div>

      <aside className="lg:col-span-4">
        <div className="lg:sticky lg:top-24 p-7" style={{ background: 'var(--paper-elevated)', border: '1px solid var(--rule)' }}>
          {!initialUser ? (
            <>
              <p className="dateline mb-3">{labels.login_required}</p>
              <a href={loginPath} className="btn-primary justify-center w-full" style={{ display: 'flex' }}>
                {labels.cta_login} <span aria-hidden="true">→</span>
              </a>
            </>
          ) : !initialUser.emailVerified ? (
            <p className="dateline" style={{ color: 'var(--ember)' }}>{labels.email_not_verified}</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <span className="field-label">{labels.check_in}</span>
                  <p className="display-italic text-[20px]" style={{ color: 'var(--ink)' }}>{checkIn ?? '—'}</p>
                </div>
                <div>
                  <span className="field-label">{labels.check_out}</span>
                  <p className="display-italic text-[20px]" style={{ color: 'var(--ink)' }}>{checkOut ?? '—'}</p>
                </div>
              </div>

              <label className="block mb-5">
                <span className="field-label">{labels.guests}</span>
                <input
                  type="number"
                  min={1}
                  max={maxGuests}
                  value={guests}
                  onChange={(e) => setGuests(Math.min(maxGuests, Math.max(1, Number(e.target.value))))}
                  className="field"
                />
              </label>

              <label className="block mb-5">
                <span className="field-label">{labels.special_requests}</span>
                <textarea
                  rows={2}
                  value={special}
                  onChange={(e) => setSpecial(e.target.value)}
                  className="field resize-none"
                />
              </label>

              {!checkIn || !checkOut ? (
                <p className="dateline" style={{ color: 'var(--ink-muted)' }}>{labels.no_dates}</p>
              ) : loading ? (
                <p className="dateline">…</p>
              ) : !quote ? (
                <p className="dateline" style={{ color: 'var(--ember)' }}>{labels.unavailable}</p>
              ) : (
                <>
                  <hr className="rule mb-4" />
                  <ul className="max-h-32 overflow-y-auto text-[13px] space-y-1 mb-4" style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-serif)' }}>
                    {quote.nightly.map((n) => (
                      <li key={n.date} className="flex justify-between">
                        <span className="numeral">{n.date}</span>
                        <span className="numeral">{n.price.toFixed(2)} {currency}</span>
                      </li>
                    ))}
                  </ul>
                  <hr className="rule-strong mb-4" />
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="dateline">{labels.total} · {labels.nights(quote.nightly.length)}</span>
                  </div>
                  <p className="display text-[40px]" style={{ color: 'var(--ink)' }}>
                    <span className="numeral">{quote.total.toFixed(0)}</span>
                    <span className="text-[14px] dateline ml-2">{currency}</span>
                  </p>
                  {quote.minStay > quote.nightly.length && (
                    <p className="dateline mt-3" style={{ color: 'var(--ember)' }}>{labels.min_stay(quote.minStay)}</p>
                  )}
                  {error && (
                    <p role="alert" className="dateline mt-3" style={{ color: 'var(--ember)' }}>
                      {error === 'dates_taken' ? labels.unavailable : error}
                    </p>
                  )}
                  <button
                    onClick={submitBooking}
                    disabled={submitting || !quote.available || quote.minStay > quote.nightly.length}
                    className="btn-primary justify-center w-full mt-6 disabled:opacity-50"
                    style={{ display: 'flex' }}
                  >
                    {submitting ? '…' : labels.confirm} <span aria-hidden="true">→</span>
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </aside>

      {/* Sticky bottom CTA bar — visible only below lg when dates + quote are ready */}
      {initialUser && initialUser.emailVerified && checkIn && checkOut && quote && (
        <div
          className="lg:hidden fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between gap-4 px-5 py-4"
          style={{ background: 'var(--paper-elevated)', borderTop: '1px solid var(--rule)', boxShadow: '0 -4px 20px rgba(31,26,20,0.10)' }}
        >
          <div>
            <p className="display text-[28px] leading-none" style={{ color: 'var(--ink)' }}>
              <span className="numeral">{quote.total.toFixed(0)}</span>
              <span className="text-[12px] dateline ml-1">{currency}</span>
            </p>
            <p className="dateline" style={{ color: 'var(--ink-muted)' }}>{labels.nights(quote.nightly.length)}</p>
          </div>
          <button
            onClick={submitBooking}
            disabled={submitting || !quote.available || quote.minStay > quote.nightly.length}
            className="btn-primary disabled:opacity-50"
            style={{ display: 'inline-flex' }}
          >
            {submitting ? '…' : labels.confirm} <span aria-hidden="true">→</span>
          </button>
        </div>
      )}
    </div>
  );
}
