/**
 * Same-origin usage view for the in-product account panel.
 * Returns the caller's plan, limits, and current usage across all dimensions.
 */
import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getAllow } from "@/lib/allowlist";
import { getMetrics, getTenantIdByEmail } from "@/lib/metrics";
import { resolveCallerEmail } from "@/lib/identity";
import { PLANS, type PlanId } from "@/lib/plans";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Identity comes from the caller's RAGFlow session, never a query param.
  const email = await resolveCallerEmail(req);
  if (!email) return NextResponse.json({ plan: null }, { status: 401 });

  // Precedence: admin override > active billing > trial (freemium default).
  const override = await getAllow(email);
  const billing = await getStore().getByEmail(email);
  const plan: PlanId = override?.plan ?? (billing?.status === "active" ? billing.plan : "trial");
  const manageable = !override && billing?.status === "active" && !!billing.stripeCustomerId;
  let tenantId: string | undefined = billing?.ragflowTenantId;

  if (!tenantId) tenantId = (await getTenantIdByEmail(email)) ?? undefined;
  const usage = tenantId ? await getMetrics(tenantId) : null;
  const limits = PLANS[plan].limits;

  return NextResponse.json({
    plan,
    label: PLANS[plan].name,
    manageable,
    limits: {
      credits: limits.monthlyCredits,
      knowledge_bases: limits.knowledgeBases,
      seats: limits.seats,
      storage_gb: limits.storageGB,
    },
    usage: usage ?? { credits: 0, knowledge_bases: 0, seats: 0, storage_gb: 0 },
  });
}
