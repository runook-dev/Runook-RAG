"use client";

import { useEffect, useState } from "react";

interface Usage {
  plan: string | null;
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
      <div className="mb-1 flex justify-between text-sm">
        <span>{label}</span>
        <span className="text-[var(--muted)]">{unlimited ? "unlimited" : `${used} / ${limit}`}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-2,#111214)]">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: pct > 90 ? "#ef4444" : "linear-gradient(90deg,#2dd4ff,#0066ff)" }}
        />
      </div>
    </div>
  );
}

export default function AccountView({ email }: { email: string }) {
  const [data, setData] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/runook/usage?email=${encodeURIComponent(email)}`);
        setData(await res.json());
      } finally {
        setLoading(false);
      }
    })();
  }, [email]);

  async function manage() {
    const r = await fetch(`/runook/portal?email=${encodeURIComponent(email)}`);
    const d = await r.json();
    if (d.url) window.location.href = d.url;
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-14">
      <div className="mb-8 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)] font-bold text-white">R</span>
        <span className="text-lg font-semibold">Runook RAG — Billing</span>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      ) : !data?.plan ? (
        <div className="rounded-2xl border bg-[var(--surface)] p-6">
          <h1 className="text-xl font-semibold">No active plan</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {email ? `Signed in as ${email}.` : ""} Choose a plan to unlock full limits.
          </p>
          <a
            href="https://pay.runook.com"
            className="mt-5 inline-block rounded-lg px-4 py-2 text-sm font-medium text-white"
            style={{ background: "var(--accent)" }}
          >
            View plans
          </a>
        </div>
      ) : (
        <div className="rounded-2xl border bg-[var(--surface)] p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--muted)]">Current plan</p>
              <p className="text-2xl font-semibold">{data.label}</p>
            </div>
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold text-white"
              style={{ background: "linear-gradient(135deg,#2dd4ff,#0066ff)" }}
            >
              {data.label}
            </span>
          </div>

          <Bar label="Credits this month" used={data.usage!.credits} limit={data.limits!.credits} />
          <Bar label="Knowledge bases" used={data.usage!.knowledge_bases} limit={data.limits!.knowledge_bases} />
          <Bar label="Storage (GB)" used={data.usage!.storage_gb} limit={data.limits!.storage_gb} />
          <Bar label="Seats" used={data.usage!.seats} limit={data.limits!.seats} />

          <div className="mt-6 flex gap-3">
            {data.manageable ? (
              <button
                onClick={manage}
                className="flex-1 rounded-lg px-4 py-2 text-sm font-medium text-white"
                style={{ background: "var(--accent)" }}
              >
                Manage subscription
              </button>
            ) : null}
            <a
              href="https://pay.runook.com"
              className="flex-1 rounded-lg border px-4 py-2 text-center text-sm font-medium"
            >
              {data.plan === "business" || data.plan === "enterprise" ? "View plans" : "Upgrade plan"}
            </a>
          </div>
        </div>
      )}
    </main>
  );
}
