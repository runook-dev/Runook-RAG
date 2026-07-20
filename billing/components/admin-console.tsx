"use client";

import { useCallback, useEffect, useState } from "react";

interface RosterEntry {
  email: string;
  nickname?: string;
  tenantId: string;
  loginChannel?: string;
  isSuperuser: boolean;
  active: boolean;
  source: string;
  plan?: string;
  billingStatus?: string;
  authorized: boolean;
}

const PLANS = ["trial", "starter", "growth", "business", "enterprise"];

export default function AdminConsole({ token }: { token: string }) {
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users?token=${encodeURIComponent(token)}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "failed");
      setRoster(body.roster ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(action: string, entry: RosterEntry, plan?: string) {
    setBusy(entry.email + action);
    try {
      await fetch(`/api/admin/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action, email: entry.email, tenantId: entry.tenantId, plan }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  }

  const stats = {
    total: roster.length,
    authorized: roster.filter((r) => r.authorized).length,
    paying: roster.filter((r) => r.source === "billing").length,
    suspended: roster.filter((r) => !r.active).length,
  };

  return (
    <main className="mx-auto max-w-6xl p-8">
      <h1 className="text-2xl font-semibold">Runook RAG — Accounts</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Every workspace, its plan/billing status, and whether it&apos;s authorized. Unauthorized accounts are
        auto-suspended hourly.
      </p>

      <div className="mt-4 grid grid-cols-4 gap-3">
        <Stat label="Accounts" value={stats.total} />
        <Stat label="Authorized" value={stats.authorized} />
        <Stat label="Paying" value={stats.paying} />
        <Stat label="Suspended" value={stats.suspended} />
      </div>

      {error && <p className="mt-4 text-sm text-[var(--danger,#ef4444)]">{error}</p>}
      <button onClick={load} className="mt-4 rounded-lg border px-3 py-1.5 text-sm">
        Refresh
      </button>

      {loading ? (
        <p className="mt-6 text-sm text-[var(--muted)]">Loading…</p>
      ) : (
        <table className="mt-4 w-full text-left text-sm">
          <thead className="text-[var(--muted)]">
            <tr>
              <th className="py-2">Email</th>
              <th>Login</th>
              <th>Source</th>
              <th>Plan</th>
              <th>Active</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {roster.map((r) => (
              <tr key={r.tenantId} className="border-t align-middle">
                <td className="py-2">
                  {r.email}
                  {r.isSuperuser && <span className="ml-1 text-xs text-[var(--accent)]">(admin)</span>}
                </td>
                <td className="text-[var(--muted)]">{r.loginChannel || "—"}</td>
                <td>
                  <span className={r.authorized ? "text-[var(--accent)]" : "text-[var(--muted)]"}>{r.source}</span>
                </td>
                <td>{r.plan || "—"}</td>
                <td>{r.active ? "✓" : <span className="text-[var(--muted)]">suspended</span>}</td>
                <td className="flex flex-wrap items-center gap-2 py-2">
                  {!r.isSuperuser && (
                    <>
                      <select
                        defaultValue={r.plan || "trial"}
                        onChange={(e) => act("grant", r, e.target.value)}
                        className="rounded border bg-transparent px-1 py-0.5 text-xs"
                        title="Grant access with plan"
                      >
                        {PLANS.map((p) => (
                          <option key={p} value={p}>
                            grant: {p}
                          </option>
                        ))}
                      </select>
                      {r.source === "allowlist" && (
                        <button onClick={() => act("revoke", r)} disabled={!!busy} className="text-xs text-[var(--muted)] hover:underline">
                          revoke
                        </button>
                      )}
                      {r.active ? (
                        <button onClick={() => act("suspend", r)} disabled={!!busy} className="text-xs text-[var(--muted)] hover:underline">
                          suspend
                        </button>
                      ) : (
                        <button onClick={() => act("activate", r)} disabled={!!busy} className="text-xs text-[var(--accent)] hover:underline">
                          activate
                        </button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
            {roster.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-[var(--muted)]">
                  No accounts.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-[var(--surface)] p-4">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
