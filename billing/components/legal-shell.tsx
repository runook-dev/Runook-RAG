import type { ReactNode } from "react";
import { LEGAL } from "@/lib/legal";
import { SiteFooter } from "./site-footer";

/** Shared chrome + typography for legal/policy pages. */
export function LegalShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <main className="mx-auto max-w-3xl px-6 py-14">
        <a href="/" className="mb-8 inline-flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg font-bold text-white" style={{ background: "var(--accent)" }}>R</span>
          <span className="font-semibold">{LEGAL.productName}</span>
        </a>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Effective date: {LEGAL.effectiveDate}</p>
        <div className="legal-body mt-8 space-y-6 text-[var(--muted)] leading-relaxed">{children}</div>
      </main>
      <SiteFooter />
    </>
  );
}

/** A titled policy section. */
export function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold text-[var(--fg)]">
        {n}. {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
