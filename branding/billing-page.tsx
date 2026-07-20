// Runook billing page — rendered natively inside RAGFlow's settings layout.
// Fetches plan/usage same-origin from the billing service (Caddy routes
// /runook/* -> billing). Part of the web bundle, so it hydrates normally.
import { useFetchUserInfo } from '@/hooks/use-user-setting-request';
import { useEffect, useState } from 'react';

interface Usage {
  plan?: string | null;
  label?: string;
  manageable?: boolean;
  limits?: { credits: number; knowledge_bases: number; seats: number; storage_gb: number };
  usage?: { credits: number; knowledge_bases: number; seats: number; storage_gb: number };
}

function Bar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const unlimited = !limit || limit <= 0;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / limit) * 100));
  return (
    <div className="mb-4">
      <div className="flex justify-between text-sm text-text-secondary mb-1">
        <span>{label}</span>
        <span>{unlimited ? 'unlimited' : `${used} / ${limit}`}</span>
      </div>
      <div className="h-2 rounded-full bg-bg-card overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: pct + '%', background: pct > 90 ? '#ef4444' : 'linear-gradient(90deg,#2dd4ff,#0066ff)' }}
        />
      </div>
    </div>
  );
}

export default function Billing() {
  const { data: userInfo } = useFetchUserInfo();
  const email = (userInfo?.email || '').toLowerCase();
  const [d, setD] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!email) {
      setLoading(false);
      return;
    }
    fetch('/runook/usage?email=' + encodeURIComponent(email))
      .then((r) => r.json())
      .then(setD)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [email]);

  async function manage() {
    const r = await fetch('/runook/portal?email=' + encodeURIComponent(email));
    const j = await r.json();
    if (j.url) window.location.href = j.url;
  }

  return (
    <section className="p-6 md:p-10 max-w-2xl">
      <h1 className="text-2xl font-semibold text-text-primary mb-1">Billing</h1>
      <p className="text-sm text-text-secondary mb-6">Your plan, usage, and subscription.</p>

      {loading ? (
        <p className="text-text-secondary">Loading…</p>
      ) : !d || !d.plan ? (
        <div className="rounded-xl border p-6">
          <p className="text-text-primary font-medium mb-2">No active plan</p>
          <a href="https://pay.runook.com" target="_blank" rel="noreferrer" className="text-accent-primary text-sm">
            View plans →
          </a>
        </div>
      ) : (
        <div className="rounded-xl border p-6 bg-bg-card">
          <div className="flex justify-between items-center mb-5">
            <div>
              <p className="text-xs text-text-secondary">Current plan</p>
              <p className="text-2xl font-semibold text-text-primary">{d.label}</p>
            </div>
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold text-white"
              style={{ background: 'linear-gradient(135deg,#2dd4ff,#0066ff)' }}
            >
              {d.label}
            </span>
          </div>
          <Bar label="Credits this month" used={d.usage!.credits} limit={d.limits!.credits} />
          <Bar label="Knowledge bases" used={d.usage!.knowledge_bases} limit={d.limits!.knowledge_bases} />
          <Bar label="Storage (GB)" used={d.usage!.storage_gb} limit={d.limits!.storage_gb} />
          <Bar label="Seats" used={d.usage!.seats} limit={d.limits!.seats} />
          <div className="flex gap-3 mt-6">
            {d.manageable ? (
              <button
                onClick={manage}
                className="rounded-lg px-4 py-2 text-sm font-medium text-white"
                style={{ background: '#00b5ff' }}
              >
                Manage subscription
              </button>
            ) : null}
            <a
              href="https://pay.runook.com"
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border px-4 py-2 text-sm font-medium text-text-primary"
            >
              {d.plan === 'business' || d.plan === 'enterprise' ? 'View plans' : 'Upgrade plan'}
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
