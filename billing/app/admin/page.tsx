import { getStore } from "@/lib/store";
import { config } from "@/lib/config";
import { PLANS } from "@/lib/plans";

export const dynamic = "force-dynamic";

// Simple shared-token gate: /admin?token=XXXX (set RUNOOK_ADMIN_DASH_TOKEN).
export default async function Admin({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!config.adminToken || token !== config.adminToken) {
    return (
      <main className="mx-auto max-w-md p-16 text-center">
        <h1 className="text-xl font-semibold">Runook RAG — Admin</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">Append ?token=… to access.</p>
      </main>
    );
  }

  const customers = await getStore().list();
  const mrr = customers
    .filter((c) => c.status === "active")
    .reduce((sum, c) => sum + (PLANS[c.plan].amount ?? 0), 0);

  return (
    <main className="mx-auto max-w-5xl p-8">
      <h1 className="text-2xl font-semibold">Runook RAG — Admin</h1>
      <div className="mt-4 grid grid-cols-3 gap-4">
        <Stat label="Customers" value={String(customers.length)} />
        <Stat label="Active" value={String(customers.filter((c) => c.status === "active").length)} />
        <Stat label="MRR (test)" value={`$${(mrr / 100).toLocaleString()}`} />
      </div>

      <table className="mt-8 w-full text-left text-sm">
        <thead className="text-[var(--muted)]">
          <tr>
            <th className="py-2">Email</th>
            <th>Plan</th>
            <th>Status</th>
            <th>Tenant</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((c) => (
            <tr key={c.id} className="border-t">
              <td className="py-2">{c.email}</td>
              <td>{PLANS[c.plan].name}</td>
              <td>{c.status}</td>
              <td className="font-mono text-xs">{c.ragflowTenantId?.slice(0, 8) ?? "—"}</td>
              <td className="text-[var(--muted)]">{c.createdAt.slice(0, 10)}</td>
            </tr>
          ))}
          {customers.length === 0 && (
            <tr>
              <td colSpan={5} className="py-6 text-center text-[var(--muted)]">
                No customers yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-[var(--surface)] p-4">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
