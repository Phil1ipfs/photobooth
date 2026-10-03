import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AppLayout, { PageHeader } from '../components/layout/AppLayout';
import Icon from '../components/common/Icon';
import Button from '../components/common/Button';
import { EmptyState, Skeleton } from '../components/common/misc';
import TimeSeriesChart from '../components/admin/TimeSeriesChart';
import { useEntitlements } from '../context/EntitlementsContext';
import { supabase } from '../lib/supabase';
import { getTemplate } from '../templates/data';
import { formatDate } from '../lib/format';

const RANGES = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7 days', days: 7 },
  { id: '30d', label: '30 days', days: 30 },
  { id: '90d', label: '90 days', days: 90 },
  { id: 'all', label: 'All time' },
];

const fromFor = (range) => {
  if (range.id === 'all') return null;
  const d = new Date();
  if (range.id === 'today') d.setHours(0, 0, 0, 0);
  else d.setDate(d.getDate() - range.days);
  return d.toISOString();
};

const num = (n) => new Intl.NumberFormat().format(n ?? 0);
const money = (minor, currency) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'PHP', maximumFractionDigits: 0 }).format((minor || 0) / 100);

function Stat({ label, value, hint, icon }) {
  return (
    <div className="stat-tile card">
      <span className="stat-label">
        {icon && <Icon name={icon} size={15} />}
        {label}
      </span>
      <strong className="stat-value">{value}</strong>
      {hint && <small className="stat-hint">{hint}</small>}
    </div>
  );
}

export default function Admin() {
  const { isAdmin, ready } = useEntitlements();
  const [rangeId, setRangeId] = useState('30d');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const range = RANGES.find((r) => r.id === rangeId);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data: d, error: e } = await supabase.rpc('admin_metrics', { p_from: fromFor(range) });
    if (e) setError(e.message.includes('forbidden') ? 'You don’t have access to analytics.' : e.message);
    else setData(d);
    setLoading(false);
  }, [range]);

  useEffect(() => {
    if (ready && isAdmin) load();
  }, [ready, isAdmin, load]);

  const k = data?.kpis || {};
  const series = data?.series || [];
  const status = useMemo(() => Object.entries(data?.subscriptionStatus || {}).sort((a, b) => b[1] - a[1]), [data]);
  const topMax = Math.max(1, ...(data?.topTemplates || []).map((t) => t.count));

  if (!ready) {
    return (
      <AppLayout>
        <Skeleton height={400} radius={20} />
      </AppLayout>
    );
  }

  if (!isAdmin) {
    return (
      <AppLayout>
        <EmptyState icon="lock" title="Admins only" action={<Button to="/dashboard">Back to dashboard</Button>}>
          This area is only available to PhotoBooth administrators.
        </EmptyState>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader title="Analytics" subtitle="How people use PhotoBooth — anonymous, aggregated, admins only.">
        <Button variant="outline" icon="refresh" size="sm" onClick={load} loading={loading}>
          Refresh
        </Button>
      </PageHeader>

      <div className="segmented admin-range" role="group" aria-label="Time range">
        {RANGES.map((r) => (
          <button key={r.id} aria-pressed={r.id === rangeId} onClick={() => setRangeId(r.id)}>
            {r.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="form-alert" role="alert">
          <Icon name="alert" size={18} />
          {error}
        </div>
      )}

      {!data && loading ? (
        <div className="stat-grid">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} height={104} radius={18} />
          ))}
        </div>
      ) : data ? (
        <div className={`admin-body${loading ? ' is-refreshing' : ''}`} aria-busy={loading}>
          <h2 className="admin-group">People</h2>
          <div className="stat-grid">
            <Stat icon="users" label="Total users" value={num(k.totalUsers)} hint={`${num(k.newUsers)} new in range`} />
            <Stat icon="user" label="Active users" value={num(k.activeUsers)} hint="Signed-in users with activity" />
            <Stat icon="globe" label="Unique visitors" value={num(k.visitors)} hint={`${num(k.returningVisitors)} returning`} />
            <Stat icon="layers" label="Sessions" value={num(k.sessions)} hint={`${num(k.pageViews)} page views`} />
            <Stat icon="plus" label="Signups" value={num(k.signups)} hint={`${num(k.logins)} logins`} />
          </div>

          <h2 className="admin-group">Creating</h2>
          <div className="stat-grid">
            <Stat icon="camera" label="Photobooth opened" value={num(k.photoboothOpened)} hint={`${num(k.photosCaptured)} photos captured`} />
            <Stat icon="templates" label="Photostrips created" value={num(k.stripsCreated)} />
            <Stat icon="download" label="Downloads" value={num(k.downloads)} />
            <Stat icon="save" label="Saved strips" value={num(k.stripsSaved)} />
          </div>

          <h2 className="admin-group">Premium</h2>
          <div className="stat-grid">
            <Stat icon="sparkle" label="Premium subscribers" value={num(k.premiumSubscribers)} hint={`${num(k.freeUsers)} on Free`} />
            <Stat icon="chart" label="Free → Premium" value={`${k.conversionRate ?? 0}%`} hint="Of all accounts" />
            <Stat icon="card" label="Revenue" value={money(k.revenue, k.currency)} hint={`${money(k.revenueAllTime, k.currency)} all time`} />
            <Stat icon="arrow-right" label="Checkouts started" value={num(k.checkoutsStarted)} hint={`${num(k.newSubscriptions)} new subscriptions`} />
            <Stat icon="x" label="Cancellations" value={num(k.cancellations)} hint={`${num(k.paymentFailures)} failed payments`} />
          </div>

          <h2 className="admin-group">Over time</h2>
          <div className="chart-grid">
            <TimeSeriesChart title="Visitors" subtitle={`Unique visitors per ${data.bucket}`} data={series} valueKey="visitors" bucket={data.bucket} />
            <TimeSeriesChart title="Signups" subtitle={`New accounts per ${data.bucket}`} data={series} valueKey="signups" bucket={data.bucket} />
            <TimeSeriesChart title="Photostrips created" subtitle={`Per ${data.bucket}`} data={series} valueKey="strips" bucket={data.bucket} />
            <TimeSeriesChart title="Downloads" subtitle={`Per ${data.bucket}`} data={series} valueKey="downloads" bucket={data.bucket} />
            <TimeSeriesChart title="Premium subscriptions" subtitle={`Started per ${data.bucket}`} data={series} valueKey="subscriptions" bucket={data.bucket} />
          </div>

          <div className="admin-split">
            <section className="card admin-panel" aria-labelledby="top-tpl">
              <h2 id="top-tpl">Top templates</h2>
              {data.topTemplates?.length ? (
                <ul className="bar-list">
                  {data.topTemplates.map((t) => (
                    <li key={t.template}>
                      <span className="bar-label">{getTemplate(t.template)?.id === t.template ? getTemplate(t.template).name : t.template}</span>
                      <span className="bar-track">
                        <span className="bar-fill" style={{ width: `${(t.count / topMax) * 100}%` }} />
                      </span>
                      <span className="bar-value">{num(t.count)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No strips created in this range yet.</p>
              )}
            </section>

            <section className="card admin-panel" aria-labelledby="sub-status">
              <h2 id="sub-status">Subscription status</h2>
              {status.length ? (
                <ul className="status-list">
                  {status.map(([s, n]) => (
                    <li key={s}>
                      <span className={`billing-status status-${s}`}>{s.replace('_', ' ')}</span>
                      <strong>{num(n)}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No subscriptions yet.</p>
              )}
            </section>
          </div>

          <section className="card admin-panel" aria-labelledby="recent">
            <h2 id="recent">Recent signups</h2>
            <div className="table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Email</th>
                    <th scope="col">Method</th>
                    <th scope="col">Plan</th>
                    <th scope="col">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.recentSignups || []).map((u, i) => (
                    <tr key={i}>
                      <td>{u.name}</td>
                      <td className="muted">{u.email}</td>
                      <td>{u.provider === 'google' ? 'Google' : 'Email'}</td>
                      <td>
                        <span className={`plan-chip plan-${u.plan}`}>{u.plan}</span>
                      </td>
                      <td>{formatDate(u.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <small className="muted">Emails are masked. Payment details are never shown here — use the Stripe Dashboard.</small>
          </section>
        </div>
      ) : null}
    </AppLayout>
  );
}
