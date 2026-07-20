/**
 * Customer billing/usage page, opened same-origin from the product
 * (rag.runook.com/runook/account?email=…). Rendered fully server-side so it
 * works even though the product's /_next/* asset path is routed to RAGFlow,
 * not to this billing app (i.e. no client hydration required here).
 */
import { getStore } from "@/lib/store";
import { getAllow } from "@/lib/allowlist";
import { getMetrics, getTenantIdByEmail } from "@/lib/metrics";
import { PLANS, type PlanId } from "@/lib/plans";

export const dynamic = "force-dynamic";

function Bar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const unlimited = !limit || limit <= 0;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / limit) * 100));
  return (
    <div style={{ margin: "14px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#a1a1aa" }}>
        <span>{label}</span>
        <span>{unlimited ? "unlimited" : `${used} / ${limit}`}</span>
      </div>
      <div style={{ height: 8, background: "#111214", borderRadius: 999, marginTop: 5, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: pct > 90 ? "#ef4444" : "linear-gradient(90deg,#2dd4ff,#0066ff)" }} />
      </div>
    </div>
  );
}

export default async function Account({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email: raw } = await searchParams;
  const email = (raw || "").toLowerCase();

  const override = email ? await getAllow(email) : null;
  const billing = email ? await getStore().getByEmail(email) : null;
  const plan: PlanId = override?.plan ?? (billing?.status === "active" ? billing.plan : "trial");
  const manageable = !override && billing?.status === "active" && !!billing.stripeCustomerId;
  const tenantId = billing?.ragflowTenantId ?? (email ? await getTenantIdByEmail(email) : null);
  const usage = tenantId ? await getMetrics(tenantId) : null;
  const limits = PLANS[plan].limits;
  const u = usage ?? { credits: 0, knowledge_bases: 0, seats: 0, storage_gb: 0 };

  const wrap: React.CSSProperties = {
    maxWidth: 520,
    margin: "0 auto",
    padding: "56px 24px",
    fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,sans-serif",
  };
  const card: React.CSSProperties = { background: "#0a0a0a", border: "1px solid #1f2023", borderRadius: 16, padding: 24 };
  const btn: React.CSSProperties = {
    display: "inline-block", padding: "9px 16px", borderRadius: 8, fontSize: 14, fontWeight: 600,
    textDecoration: "none", textAlign: "center", flex: 1,
  };

  return (
    <html lang="en">
      <body style={{ background: "#000", color: "#fafafa", margin: 0 }}>
        <main style={wrap}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 28 }}>
            <span style={{ display: "flex", height: 32, width: 32, alignItems: "center", justifyContent: "center", borderRadius: 8, background: "#00b5ff", fontWeight: 700 }}>R</span>
            <span style={{ fontSize: 18, fontWeight: 600 }}>Runook RAG — Billing</span>
          </div>

          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <p style={{ margin: 0, fontSize: 12, color: "#a1a1aa" }}>Current plan</p>
                <p style={{ margin: "4px 0 0", fontSize: 26, fontWeight: 700 }}>{PLANS[plan].name}</p>
                {email ? <p style={{ margin: "4px 0 0", fontSize: 12, color: "#71717a" }}>{email}</p> : null}
              </div>
              <span style={{ borderRadius: 999, padding: "4px 12px", fontSize: 12, fontWeight: 700, color: "#fff", background: "linear-gradient(135deg,#2dd4ff,#0066ff)" }}>
                {PLANS[plan].name}
              </span>
            </div>

            <Bar label="Credits this month" used={u.credits} limit={limits.monthlyCredits} />
            <Bar label="Knowledge bases" used={u.knowledge_bases} limit={limits.knowledgeBases} />
            <Bar label="Storage (GB)" used={u.storage_gb} limit={limits.storageGB} />
            <Bar label="Seats" used={u.seats} limit={limits.seats} />

            <div style={{ display: "flex", gap: 12, marginTop: 22 }}>
              {manageable ? (
                <a href={`/runook/portal?email=${encodeURIComponent(email)}&redirect=1`} style={{ ...btn, color: "#fff", background: "#00b5ff" }}>
                  Manage subscription
                </a>
              ) : null}
              <a href="https://pay.runook.com" target="_blank" rel="noreferrer" style={{ ...btn, color: "#fafafa", border: "1px solid #1f2023" }}>
                {plan === "business" || plan === "enterprise" ? "View plans" : "Upgrade plan"}
              </a>
            </div>
          </div>

          <p style={{ marginTop: 18, textAlign: "center", fontSize: 12, color: "#71717a" }}>
            <a href="https://rag.runook.com" style={{ color: "#00b5ff" }}>← Back to Runook RAG</a>
          </p>
        </main>
      </body>
    </html>
  );
}
