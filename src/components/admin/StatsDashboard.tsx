import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

interface Stats {
  range: { from: string; to: string; nights: number };
  occupancyRate: number;
  bookedNights: number;
  revenue: number;
  adr: number;
  bookingsCount: number;
  averageLeadTime: number;
  averageLengthOfStay: number;
  guestsByCountry: { country: string; count: number; bookings: number }[];
  repeatRate: number;
  monthly: { month: string; bookedNights: number; revenue: number }[];
}

const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;
const todayIso = () => new Date().toISOString().slice(0, 10);
const addDays = (iso: string, days: number) => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

// Mapped to --color-schist-900/700, --color-ember-500, --color-sage-500, --color-bone-300/200
const COLORS = ['#1F1A14', '#3A3530', '#B5532A', '#6B7556', '#DBD2C2', '#ECE5DA'];

interface Props {
  defaultFrom?: string;
  defaultTo?: string;
}

export default function StatsDashboard({ defaultFrom, defaultTo }: Props) {
  const today = todayIso();
  const [from, setFrom] = useState(defaultFrom ?? addDays(today, -365));
  const [to, setTo] = useState(defaultTo ?? today);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/stats?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((j) => setStats(j.ok ? j.stats : null))
      .finally(() => setLoading(false));
  }, [from, to]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="admin-label">De</label>
          <input className="admin-input" style={{ width: 'auto' }} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="admin-label">A</label>
          <input className="admin-input" style={{ width: 'auto' }} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="flex gap-1">
          {[
            { l: '30d', d: 30 },
            { l: '90d', d: 90 },
            { l: '1a', d: 365 },
            { l: 'YTD', d: -1 }
          ].map((p) => (
            <button
              key={p.l}
              onClick={() => {
                if (p.d === -1) {
                  setFrom(`${new Date().getUTCFullYear()}-01-01`);
                  setTo(today);
                } else {
                  setFrom(addDays(today, -p.d));
                  setTo(today);
                }
              }}
              className="btn-action"
            >
              {p.l}
            </button>
          ))}
        </div>
      </div>

      {loading || !stats ? (
        <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>A calcular…</p>
      ) : (
        <>
          <section className="grid md:grid-cols-4 gap-4">
            <article className="admin-card p-5">
              <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>Ocupação</p>
              <p className="text-3xl font-semibold mt-1">{fmtPct(stats.occupancyRate)}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>{stats.bookedNights} / {stats.range.nights} noites</p>
            </article>
            <article className="admin-card p-5">
              <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>Receita</p>
              <p className="text-3xl font-semibold mt-1">{stats.revenue.toFixed(0)} €</p>
              <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>{stats.bookingsCount} reservas</p>
            </article>
            <article className="admin-card p-5">
              <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>ADR (preço médio/noite)</p>
              <p className="text-3xl font-semibold mt-1">{stats.adr.toFixed(0)} €</p>
            </article>
            <article className="admin-card p-5">
              <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>Hóspedes que voltam</p>
              <p className="text-3xl font-semibold mt-1">{fmtPct(stats.repeatRate)}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>Lead time {stats.averageLeadTime}d · LOS {stats.averageLengthOfStay.toFixed(1)}n</p>
            </article>
          </section>

          <section className="admin-card p-5" style={{ height: '18rem' }}>
            <p className="text-sm font-medium mb-3">Receita & noites por mês</p>
            {stats.monthly.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>—</p>
            ) : (
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={stats.monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="bookedNights" name="Noites" fill={COLORS[0]} />
                  <Bar yAxisId="right" dataKey="revenue" name="Receita (€)" fill={COLORS[2]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </section>

          <section className="grid md:grid-cols-2 gap-4">
            <article className="admin-card p-5" style={{ height: '18rem' }}>
              <p className="text-sm font-medium mb-3">Origem dos hóspedes</p>
              {stats.guestsByCountry.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>—</p>
              ) : (
                <ResponsiveContainer width="100%" height="90%">
                  <PieChart>
                    <Pie
                      data={stats.guestsByCountry.slice(0, 6)}
                      dataKey="bookings"
                      nameKey="country"
                      outerRadius={80}
                      label={(d: any) => d.country}
                    >
                      {stats.guestsByCountry.slice(0, 6).map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </article>

            <article className="admin-card p-5">
              <p className="text-sm font-medium mb-3">Resumo</p>
              <ul className="text-sm space-y-1" style={{ color: 'var(--ink-muted)' }}>
                <li>Período: {stats.range.from} → {stats.range.to} ({stats.range.nights} noites)</li>
                <li>Reservas: {stats.bookingsCount}</li>
                <li>Noites ocupadas: {stats.bookedNights}</li>
                <li>Lead time médio: {stats.averageLeadTime} dias</li>
                <li>Estadia média: {stats.averageLengthOfStay.toFixed(1)} noites</li>
                <li>Países distintos: {stats.guestsByCountry.length}</li>
              </ul>
            </article>
          </section>
        </>
      )}
    </div>
  );
}
