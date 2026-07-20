import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminRequest } from "@/lib/admin-auth";
import { grant, revoke, setBlocked } from "@/lib/allowlist";
import { setUserActive } from "@/lib/roster";
import { provisionTenant } from "@/lib/provision";
import type { PlanId } from "@/lib/plans";

export const dynamic = "force-dynamic";

const schema = z.object({
  action: z.enum(["open", "grant", "revoke", "suspend", "activate"]),
  email: z.string().email().optional(),
  tenantId: z.string().optional(),
  plan: z.enum(["trial", "starter", "growth", "business", "enterprise"]).optional(),
  note: z.string().optional(),
});

export async function POST(req: Request) {
  if (!(await isAdminRequest(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const { action, email, tenantId, plan, note } = body.data;
  try {
    switch (action) {
      case "open": {
        // Provision a brand-new workspace for an email + grant a plan.
        if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });
        const prov = await provisionTenant(email, email.split("@")[0]);
        if (!prov.ok) return NextResponse.json({ error: prov.error || "provision failed" }, { status: 502 });
        await grant(email, (plan as PlanId) ?? "trial", note);
        if (prov.tenantId) await setUserActive(prov.tenantId, true);
        return NextResponse.json({ ok: true, tenantId: prov.tenantId, tempPassword: prov.tempPassword });
      }
      case "grant":
        // Authoritative plan override (beats billing). Clears any block + activates.
        if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });
        await grant(email, (plan as PlanId) ?? "trial", note);
        if (tenantId) await setUserActive(tenantId, true);
        break;
      case "revoke":
        // Remove the override; account falls back to billing plan or trial.
        if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });
        await revoke(email);
        break;
      case "suspend":
        // Persistent block — reconciliation will keep it suspended.
        if (!email || !tenantId) return NextResponse.json({ error: "email + tenantId required" }, { status: 400 });
        await setBlocked(email, true, (plan as PlanId) ?? "trial");
        await setUserActive(tenantId, false);
        break;
      case "activate":
        // Unblock + activate.
        if (!email || !tenantId) return NextResponse.json({ error: "email + tenantId required" }, { status: 400 });
        await setBlocked(email, false, (plan as PlanId) ?? "trial");
        await setUserActive(tenantId, true);
        break;
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
