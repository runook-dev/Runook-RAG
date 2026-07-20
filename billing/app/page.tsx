"use client";

import { useState } from "react";
import { PLANS, type PlanId } from "@/lib/plans";

const ORDER: PlanId[] = ["trial", "starter", "growth", "business", "enterprise"];
const FEATURED: PlanId = "growth";

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
    <main className="relative mx-auto max-w-6xl px-6 pb-24">
      {/* ambient gradient */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
        style={{
          background:
            "radial-gradient(60% 100% at 50% 0%, rgba(45,212,255,.18), rgba(0,102,255,.06) 45%, transparent 70%)",
        }}
      />

      <header className="relative flex items-center justify-between py-6">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg font-bold text-white" style={{ background: "var(--accent)" }}>
            R
          </span>
          <span className="text-lg font-semibold">Runook RAG</span>
        </div>
        <a href="https://rag.runook.com/login" className="text-sm text-[var(--muted)] hover:text-[var(--fg)]">
          Sign in →
        </a>
      </header>

      <div className="relative mb-16 pt-10 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Scale your business with{" "}
          <span
            style={{
              background: "linear-gradient(90deg,#2dd4ff,#0066ff)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Runook RAG
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-[var(--muted)]">
          Private, grounded AI over your documents. Bring your own model provider.
          Simple monthly plans — cancel anytime.
        </p>
      </div>

      <div className="relative grid grid-cols-1 gap-5 md:grid-cols-3 xl:grid-cols-5">
        {ORDER.map((id) => {
          const p = PLANS[id];
          const featured = id === FEATURED;
          return (
            <div
              key={id}
              className="relative flex flex-col rounded-2xl border bg-[var(--surface)] p-6"
              style={
                featured
                  ? { borderColor: "var(--accent)", boxShadow: "0 0 0 1px var(--accent), 0 20px 60px -20px rgba(0,181,255,.5)" }
                  : undefined
              }
            >
              {featured && (
                <span
                  className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-semibold text-white"
                  style={{ background: "linear-gradient(135deg,#2dd4ff,#0066ff)" }}
                >
                  Most popular
                </span>
              )}
              <h3 className="text-sm font-medium text-[var(--muted)]">{p.name}</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-semibold">{priceLabel(p.amount)}</span>
                {p.amount && p.amount > 0 ? <span className="text-sm text-[var(--muted)]">/mo</span> : null}
              </div>
              <ul className="mt-5 flex-1 space-y-2.5 text-sm">
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
                    className="w-full rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                    style={{ background: featured ? "linear-gradient(135deg,#2dd4ff,#0066ff)" : "var(--accent)" }}
                  >
                    {loading === id ? "Redirecting…" : "Upgrade now"}
                  </button>
                )}
                {p.cta === "trial" && (
                  <a
                    href="https://rag.runook.com/login"
                    className="block w-full rounded-lg border py-2.5 text-center text-sm font-medium hover:bg-[var(--surface-2)]"
                  >
                    Start free
                  </a>
                )}
                {p.cta === "contact" && (
                  <a
                    href="mailto:info@runook.com?subject=Runook%20RAG%20Enterprise"
                    className="block w-full rounded-lg border py-2.5 text-center text-sm font-medium hover:bg-[var(--surface-2)]"
                  >
                    Contact sales
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* How billing works */}
      <section className="relative mx-auto mt-20 max-w-3xl">
        <h2 className="mb-6 text-center text-2xl font-semibold">How billing works</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[
            ["Monthly billing", "Plans are billed monthly in USD and renew automatically. Cancel or change anytime from the customer portal."],
            ["Bring your own model", "You add your own LLM provider (Gemini, OpenAI, and more) under Model providers — you're never locked to one vendor."],
            ["Usage quotas", "Each plan includes storage, parsing credits, knowledge bases, and seats. Track usage anytime on your in-app Billing page."],
            ["Upgrades & downgrades", "Upgrades apply immediately and are prorated. Downgrades take effect at the next cycle. No refunds for the current cycle."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-xl border bg-[var(--surface)] p-5">
              <h3 className="font-medium">{t}</h3>
              <p className="mt-1.5 text-sm text-[var(--muted)]">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <p className="relative mt-12 text-center text-xs text-[var(--muted)]">
        Prices in USD. After subscribing you&apos;ll get access at rag.runook.com.
      </p>
    </main>
  );
}
