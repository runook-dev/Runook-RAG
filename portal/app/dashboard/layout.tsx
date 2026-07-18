import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentCustomer } from "@/lib/auth";
import { Logo } from "@/components/ui";
import LogoutButton from "@/components/logout-button";
import { PLAN_LIMITS } from "@/lib/config";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/");

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 flex-col border-r border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="mb-8 px-2">
          <Logo />
        </div>
        <nav className="flex flex-1 flex-col gap-1 text-sm">
          <NavLink href="/dashboard" label="Overview" />
          <NavLink href="/dashboard/knowledge" label="Knowledge bases" />
          <NavLink href="/dashboard/chat" label="Chat" />
        </nav>
        <div className="mt-auto border-t border-[var(--border)] pt-4">
          <div className="mb-3 px-2">
            <p className="truncate text-sm font-medium">{customer.name}</p>
            <p className="truncate text-xs text-[var(--muted)]">{customer.email}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">{PLAN_LIMITS[customer.plan].label} plan</p>
          </div>
          <LogoutButton />
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-lg px-3 py-2 text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
    >
      {label}
    </Link>
  );
}
