/**
 * Same-origin plan lookup for the in-product tier badge.
 * Served to rag.runook.com via a Caddy /runook/* route, so the RAGFlow UI can
 * fetch the current user's plan without CORS. Returns only a plan label.
 */
import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getAllow } from "@/lib/allowlist";
import { resolveCallerEmail } from "@/lib/identity";
import { PLANS, type PlanId } from "@/lib/plans";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Identity comes from the caller's RAGFlow session, never a query param.
  const email = await resolveCallerEmail(req);
  if (!email) return NextResponse.json({ plan: null, label: null }, { status: 401 });

  // Precedence: admin override > active billing > trial (freemium default).
  const override = await getAllow(email);
  const billing = await getStore().getByEmail(email);
  let plan: PlanId = override?.plan ?? (billing?.status === "active" ? billing.plan : "trial");

  return NextResponse.json(
    { plan, label: PLANS[plan].name, blocked: !!override?.blocked },
    { headers: { "cache-control": "no-store" } }
  );
}
