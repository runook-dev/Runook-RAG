"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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

export default function AdminConsole() {
  const router = useRouter();
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newPlan, setNewPlan] = useState("starter");
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users");
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "failed");
      setRoster(body.roster ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(payload: Record<string, unknown>, key: string) {
    setBusy(key);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice(`Error: ${body.error || res.status}`);
        return;
      }
      if (body.tempPassword) setNotice(`Opened ${payload.email}. Temp password: ${body.tempPassword} (or they can use Google sign-in).`);
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  const stats = {
    total: roster.length,
    authorized: roster.filter((r) => r.authorized).length,
    paying: roster.filter((r) => r.source === "billing").length,
    suspended: roster.filter((r) => !r.active).length,
  };

  return (
    <main className="mx-auto max-w-6xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Runook RAG — Accounts</h1>
        <button onClick={logout} className="rounded-lg border px-3 py-1.5 text-sm">
          Sign out
        </button>
      </div>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Every workspace, its plan and status. Unauthorized accounts are auto-suspended hourly.
      </p>

      <div className="mt-4 grid grid-cols-4 gap-3">
        <Stat label="Accounts" value={stats.total} />
        <Stat label="Authorized" value={stats.authorized} />
        <Stat label="Paying" value={stats.paying} />
        <Stat label="Suspended" value={stats.suspended} />
      </div>

      {/* Open a new account */}
      <div className="mt-6 flex flex-wrap items-end gap-2 rounded-xl border bg-[var(--surface)] p-4">
        <div>
          <label className="block text-xs text-[var(--muted)]">Open account (email)</label>
          <input
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="customer@company.com"
            className="mt-1 w-64 rounded-lg border bg-transparent px-3 py-1.5 text-sm"
          />
        </div>
        <select value={newPlan} onChange={(e) => setNewPlan(e.target.value)} className="rounded-lg border bg-transparent px-2 py-1.5 text-sm">
          {PLANS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <button
          onClick={() => newEmail && act({ action: "open", email: newEmail, plan: newPlan }, "open")}
          disabled={busy === "open" || !newEmail}
          className="rounded-lg px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          style={{ background: "var(--accent)" }}
        >
          {busy === "open" ? "Opening…" : "Open account"}
        </button>
      </div>

      {notice && <p className="mt-3 rounded-lg border border-[var(--accent)] p-2 text-sm">{notice}</p>}
      {error && <p className="mt-3 text-sm text-[#ef4444]">{error}</p>}
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
              <th>Status</th>
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
                <td>
                  {r.isSuperuser ? (
                    "—"
                  ) : (
                    <select
                      defaultValue={r.plan || "trial"}
                      onChange={(e) => act({ action: "grant", email: r.email, tenantId: r.tenantId, plan: e.target.value }, r.email + "plan")}
                      className="rounded border bg-transparent px-1 py-0.5 text-xs"
                      title="Set plan / grant access"
                    >
                      {PLANS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td>{r.active ? <span className="text-[var(--accent)]">active</span> : <span className="text-[var(--muted)]">suspended</span>}</td>
                <td className="flex flex-wrap items-center gap-3 py-2">
                  {!r.isSuperuser && (
                    <>
                      {r.active ? (
                        <button onClick={() => act({ action: "suspend", tenantId: r.tenantId }, r.email + "s")} disabled={!!busy} className="text-xs text-[var(--muted)] hover:underline">
                          suspend
                        </button>
                      ) : (
                        <button onClick={() => act({ action: "activate", tenantId: r.tenantId }, r.email + "a")} disabled={!!busy} className="text-xs text-[var(--accent)] hover:underline">
                          activate
                        </button>
                      )}
                      {r.source === "allowlist" && (
                        <button onClick={() => act({ action: "revoke", email: r.email, tenantId: r.tenantId }, r.email + "r")} disabled={!!busy} className="text-xs text-[#ef4444] hover:underline">
                          revoke
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
