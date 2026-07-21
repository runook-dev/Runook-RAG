// Runook billing page — rendered natively inside RAGFlow's settings layout.
// Overview shows plan + usage across every quota dimension; Billing history
// lists Stripe invoices. Data is fetched same-origin from the billing service
// (Caddy routes /runook/* -> billing). Part of the web bundle, so it hydrates.
import { useFetchUserInfo } from '@/hooks/use-user-setting-request';
import { getAuthorization } from '@/utils/authorization-util';
import { useEffect, useState, type ReactNode } from 'react';

// All /runook/* calls prove identity with the RAGFlow session token; the
// billing service resolves the caller's email from it (never a query param).
const authHeaders = (): HeadersInit => ({ Authorization: getAuthorization() });

interface Usage {
  plan?: string | null;
  label?: string;
  manageable?: boolean;
  limits?: { credits: number; knowledge_bases: number; seats: number; storage_gb: number };
  usage?: { credits: number; knowledge_bases: number; seats: number; storage_gb: number };
}

interface Invoice {
  id: string;
  number?: string | null;
  created: number;
  amount: number;
  currency: string;
  status: string;
  url?: string | null;
}

function fmt(n: number) {
  return n % 1 === 0 ? n.toLocaleString() : n.toFixed(2);
}

function MetricCard({
  icon,
  title,
  used,
  limit,
  unit,
}: {
  icon: ReactNode;
  title: string;
  used: number;
  limit: number;
  unit?: string;
}) {
  const unlimited = !limit || limit <= 0;
  const pct = unlimited ? 6 : Math.min(100, Math.round((used / limit) * 100));
  const danger = !unlimited && pct >= 90;
  return (
    <div className="rounded-xl border bg-bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-text-secondary">
          <span className="opacity-80">{icon}</span>
          <span className="text-sm">{title}</span>
        </div>
        <span className="text-sm font-medium text-text-primary">
          {unlimited ? `${fmt(used)}${unit ? ' ' + unit : ''}` : `${fmt(used)} / ${fmt(limit)}${unit ? ' ' + unit : ''}`}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-bg-base">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: pct + '%',
            background: danger ? '#ef4444' : 'linear-gradient(90deg,#2dd4ff,#0066ff)',
          }}
        />
      </div>
      <p className="mt-2 text-xs text-text-secondary">
        {unlimited ? 'Unlimited on your plan' : `${pct}% used`}
      </p>
    </div>
  );
}

const ICON = {
  storage: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-4"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"></path></svg>
  ),
  credits: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-4"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5z"></path><path d="M14 2v6h6"></path></svg>
  ),
  kb: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-4"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
  ),
  seats: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-4"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
  ),
};

export default function Billing() {
  const { data: userInfo } = useFetchUserInfo();
  const email = ((userInfo as { email?: string })?.email || '').toLowerCase();
  const [d, setD] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'history'>('overview');
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);

  useEffect(() => {
    if (!email) {
      setLoading(false);
      return;
    }
    fetch('/runook/usage', { headers: authHeaders() })
      .then((r) => r.json())
      .then(setD)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [email]);

  useEffect(() => {
    if (tab !== 'history' || invoices !== null || !email) return;
    fetch('/runook/invoices', { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => setInvoices(j.invoices || []))
      .catch(() => setInvoices([]));
  }, [tab, invoices, email]);

  async function manage() {
    const r = await fetch('/runook/portal', { headers: authHeaders() });
    const j = await r.json();
    if (j.url) window.location.href = j.url;
  }

  const plan = d?.plan || 'trial';
  const label = d?.label || 'Free';
  const isPaid = plan !== 'trial';
  const isEnterprise = plan === 'enterprise';

  return (
    <section className="mx-auto w-full max-w-4xl p-6 md:p-10">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-text-primary">{label} Plan</h1>
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold text-white"
              style={{ background: isPaid ? 'linear-gradient(135deg,#2dd4ff,#0066ff)' : 'rgba(148,163,184,.25)' }}
            >
              {isPaid ? 'Active' : 'Free'}
            </span>
          </div>
          <p className="mt-1 text-sm text-text-secondary">
            {isPaid ? 'Usage resets monthly · billed securely via Stripe' : 'Free evaluation · upgrade anytime for more capacity'}
          </p>
        </div>
        <div className="flex gap-3">
          {d?.manageable ? (
            <button
              onClick={manage}
              className="rounded-lg border px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-card"
            >
              Manage payment methods
            </button>
          ) : null}
          {!isEnterprise ? (
            <a
              href="https://pay.runook.com"
              target="_blank"
              rel="noreferrer"
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
              style={{ background: '#00b5ff' }}
            >
              {isPaid ? 'Change plan' : 'Upgrade now'}
            </a>
          ) : null}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-6 border-b">
        {(['overview', 'history'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              'relative pb-3 text-sm font-medium ' +
              (tab === t ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary')
            }
          >
            {t === 'overview' ? 'Overview' : 'Billing history'}
            {tab === t ? (
              <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full" style={{ background: '#00b5ff' }} />
            ) : null}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-text-secondary">Loading…</p>
      ) : tab === 'overview' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <MetricCard icon={ICON.storage} title="Storage" used={d?.usage?.storage_gb ?? 0} limit={d?.limits?.storage_gb ?? 0} unit="GB" />
          <MetricCard icon={ICON.credits} title="Document parsing credits" used={d?.usage?.credits ?? 0} limit={d?.limits?.credits ?? 0} unit="pts" />
          <MetricCard icon={ICON.kb} title="Knowledge bases" used={d?.usage?.knowledge_bases ?? 0} limit={d?.limits?.knowledge_bases ?? 0} />
          <MetricCard icon={ICON.seats} title="Team members" used={d?.usage?.seats ?? 0} limit={d?.limits?.seats ?? 0} />
        </div>
      ) : (
        <div className="rounded-xl border bg-bg-card">
          {invoices === null ? (
            <p className="p-6 text-text-secondary">Loading…</p>
          ) : invoices.length === 0 ? (
            <div className="p-12 text-center text-text-secondary">
              <p className="text-sm">No invoices yet</p>
              <p className="mt-1 text-xs">Invoices will appear here after your first payment.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-text-secondary">
                <tr className="border-b">
                  <th className="px-4 py-3 text-left font-medium">Invoice</th>
                  <th className="px-4 py-3 text-left font-medium">Date</th>
                  <th className="px-4 py-3 text-left font-medium">Amount</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody className="text-text-primary">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b last:border-0">
                    <td className="px-4 py-3">{inv.number || inv.id.slice(-8)}</td>
                    <td className="px-4 py-3">{new Date(inv.created * 1000).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      {(inv.amount / 100).toLocaleString(undefined, { style: 'currency', currency: (inv.currency || 'usd').toUpperCase() })}
                    </td>
                    <td className="px-4 py-3 capitalize">{inv.status}</td>
                    <td className="px-4 py-3 text-right">
                      {inv.url ? (
                        <a href={inv.url} target="_blank" rel="noreferrer" style={{ color: '#00b5ff' }}>
                          View
                        </a>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}
