"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error || "Sign in failed");
        return;
      }
      router.push("/admin");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const input =
    "w-full rounded-lg border bg-[var(--surface-2,#111214)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]";

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input className={input} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input className={input} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      {error && <p className="text-sm text-[#ef4444]">{error}</p>}
      <button type="submit" disabled={loading} className="w-full rounded-lg py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--accent)" }}>
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
