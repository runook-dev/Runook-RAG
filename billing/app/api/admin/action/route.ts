import { NextResponse } from "next/server";
import { z } from "zod";
import { config } from "@/lib/config";
import { grant, revoke } from "@/lib/allowlist";
import { setUserActive } from "@/lib/roster";
import type { PlanId } from "@/lib/plans";

export const dynamic = "force-dynamic";

function authorized(req: Request, token?: string): boolean {
  const t = token || req.headers.get("x-admin-token");
  return !!config.adminToken && t === config.adminToken;
}

const schema = z.object({
  token: z.string(),
  action: z.enum(["grant", "revoke", "suspend", "activate"]),
  email: z.string().email().optional(),
  tenantId: z.string().optional(),
  plan: z.enum(["trial", "starter", "growth", "business", "enterprise"]).optional(),
  note: z.string().optional(),
});

export async function POST(req: Request) {
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  if (!authorized(req, body.data.token)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { action, email, tenantId, plan, note } = body.data;
  try {
    switch (action) {
      case "grant":
        if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });
        await grant(email, (plan as PlanId) ?? "trial", note);
        if (tenantId) await setUserActive(tenantId, true);
        break;
      case "revoke":
        if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });
        await revoke(email);
        if (tenantId) await setUserActive(tenantId, false);
        break;
      case "suspend":
        if (!tenantId) return NextResponse.json({ error: "tenantId required" }, { status: 400 });
        await setUserActive(tenantId, false);
        break;
      case "activate":
        if (!tenantId) return NextResponse.json({ error: "tenantId required" }, { status: 400 });
        await setUserActive(tenantId, true);
        break;
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
