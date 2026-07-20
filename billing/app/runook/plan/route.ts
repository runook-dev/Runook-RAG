/**
 * Same-origin plan lookup for the in-product tier badge.
 * Served to rag.runook.com via a Caddy /runook/* route, so the RAGFlow UI can
 * fetch the current user's plan without CORS. Returns only a plan label.
 */
import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { listAllow } from "@/lib/allowlist";
import { PLANS, type PlanId } from "@/lib/plans";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const email = (new URL(req.url).searchParams.get("email") || "").toLowerCase();
  if (!email) return NextResponse.json({ plan: null, label: null });

  let plan: PlanId | null = null;
  const billing = await getStore().getByEmail(email);
  if (billing?.status === "active") {
    plan = billing.plan;
  } else {
    const allow = (await listAllow()).find((a) => a.email.toLowerCase() === email);
    if (allow) plan = allow.plan;
  }

  if (!plan) return NextResponse.json({ plan: null, label: null });
  return NextResponse.json(
    { plan, label: PLANS[plan].name },
    { headers: { "cache-control": "private, max-age=60" } }
  );
}
