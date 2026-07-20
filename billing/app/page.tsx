"use client";

import { useState } from "react";
import { PLANS, type PlanId } from "@/lib/plans";

const ORDER: PlanId[] = ["trial", "starter", "growth", "business", "enterprise"];

function priceLabel(amount: number | null): string {
  if (amount === null) return "Custom";
  if (amount === 0) return "$0";
  return `$${(amount / 100).toLocaleString()}`;
}

export default function Pricing() {
  const [loading, setLoading] = useState<PlanId | null>(null);

  async function subscribe(plan: PlanId) {
    setLoading(plan);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const body = await res.json();
      if (body.url) window.location.href = body.url;
      else alert(body.error || "Could not start checkout");
    } finally {
      setLoading(null);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <div className="mb-14 text-center">
        <div className="mb-3 inline-flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)] font-bold text-white">R</span>
          <span className="text-lg font-semibold">Runook RAG</span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Plans &amp; pricing</h1>
        <p className="mt-3 text-[var(--muted)]">Private, grounded AI over your documents. Cancel anytime.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3 xl:grid-cols-5">
        {ORDER.map((id) => {
          const p = PLANS[id];
          const featured = id === "growth";
          return (
            <div
              key={id}
              className="flex flex-col rounded-2xl border bg-[var(--surface)] p-6"
              style={featured ? { borderColor: "var(--accent)", boxShadow: "0 0 0 1px var(--accent)" } : undefined}
            >
              <h3 className="text-sm font-medium text-[var(--muted)]">{p.name}</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-semibold">{priceLabel(p.amount)}</span>
                {p.amount && p.amount > 0 ? <span className="text-sm text-[var(--muted)]">/mo</span> : null}
              </div>
              <ul className="mt-5 flex-1 space-y-2 text-sm">
                {p.highlights.map((h) => (
                  <li key={h} className="flex gap-2">
                    <span style={{ color: "var(--accent)" }}>✓</span>
                    <span className="text-[var(--muted)]">{h}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                {p.cta === "subscribe" && (
                  <button
                    onClick={() => subscribe(id)}
                    disabled={loading === id}
                    className="w-full rounded-lg py-2 text-sm font-medium text-white disabled:opacity-50"
                    style={{ background: "var(--accent)" }}
                  >
                    {loading === id ? "Redirecting…" : "Subscribe"}
                  </button>
                )}
                {p.cta === "trial" && (
                  <a
                    href="https://rag.runook.com/login"
                    className="block w-full rounded-lg border py-2 text-center text-sm font-medium"
                  >
                    Start free
                  </a>
                )}
                {p.cta === "contact" && (
                  <a
                    href="mailto:info@runook.com?subject=Runook%20RAG%20Enterprise"
                    className="block w-full rounded-lg border py-2 text-center text-sm font-medium"
                  >
                    Contact sales
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-10 text-center text-xs text-[var(--muted)]">
        Prices in USD. After subscribing you&apos;ll get access at rag.runook.com.
      </p>
    </main>
  );
}
