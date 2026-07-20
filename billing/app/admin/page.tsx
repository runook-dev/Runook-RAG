import AdminConsole from "@/components/admin-console";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

// Shared-token gate: /admin?token=XXXX (set RUNOOK_ADMIN_DASH_TOKEN).
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
  return <AdminConsole token={token} />;
}
