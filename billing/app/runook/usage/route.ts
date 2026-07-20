/**
 * Same-origin usage view for the in-product account panel.
 * Returns the caller's plan, limits, and current usage across all dimensions.
 */
import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { listAllow } from "@/lib/allowlist";
import { getMetrics, getTenantIdByEmail } from "@/lib/metrics";
import { PLANS, type PlanId } from "@/lib/plans";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const email = (new URL(req.url).searchParams.get("email") || "").toLowerCase();
  if (!email) return NextResponse.json({ plan: null });

  const billing = await getStore().getByEmail(email);
  let plan: PlanId | null = null;
  let tenantId: string | undefined = billing?.ragflowTenantId;
  let manageable = false;

  if (billing?.status === "active") {
    plan = billing.plan;
    manageable = !!billing.stripeCustomerId;
  } else {
    const allow = (await listAllow()).find((a) => a.email.toLowerCase() === email);
    if (allow) plan = allow.plan;
  }
  if (!plan) return NextResponse.json({ plan: null });

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
