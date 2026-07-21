import { LEGAL } from "@/lib/legal";

/** Global footer with legal links. Used on the pricing + legal pages. */
export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-20 border-t pt-8 pb-10 text-sm text-[var(--muted)]">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 sm:flex-row sm:justify-between">
        <span>
          © {year} {LEGAL.legalEntity}. All rights reserved.
        </span>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <a href="/legal/terms" className="hover:text-[var(--fg)]">Terms of Service</a>
          <a href="/legal/privacy" className="hover:text-[var(--fg)]">Privacy Policy</a>
          <a href="/legal/refund" className="hover:text-[var(--fg)]">Refund Policy</a>
          <a href={`mailto:${LEGAL.contactEmail}`} className="hover:text-[var(--fg)]">Contact</a>
        </nav>
      </div>
    </footer>
  );
}
