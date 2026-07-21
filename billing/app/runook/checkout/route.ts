/**
 * Authenticated, same-origin checkout for logged-in product users.
 *
 * Unlike the public pricing page (which lets an anonymous visitor type any
 * email at Stripe), this binds the Stripe Checkout session to the caller's
 * *authenticated* RAGFlow email, so the resulting subscription always attaches
 * to the account they're actually signed into. Used by the in-product Billing
 * page "Upgrade" flow.
 *
 * New subscriptions only — existing paying customers change plan / cancel via
 * the Stripe billing portal (see /runook/portal) to avoid creating a second
 * subscription.
 */
import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { stripe, priceIdForLookup } from "@/lib/stripe";
import { getStore } from "@/lib/store";
import { resolveCallerEmail } from "@/lib/identity";
import { PLANS, PAID_PLANS, type PlanId } from "@/lib/plans";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const email = await resolveCallerEmail(req);
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const planId = (new URL(req.url).searchParams.get("plan") || "") as PlanId;
  if (!PAID_PLANS.includes(planId)) {
    return NextResponse.json({ error: "invalid plan" }, { status: 400 });
  }
  const plan = PLANS[planId];
  if (!plan.stripeLookupKey) return NextResponse.json({ error: "not purchasable" }, { status: 400 });

  // If they already have an active subscription, send them to the portal to
  // switch plans instead of opening a second checkout.
  const existing = await getStore().getByEmail(email);
  if (existing?.status === "active" && existing.stripeCustomerId) {
    const portal = await stripe.billingPortal.sessions.create({
      customer: existing.stripeCustomerId,
      return_url: `${config.appUrl}/user-setting/billing`,
    });
    return NextResponse.json({ url: portal.url, mode: "portal" });
  }

  const priceId = await priceIdForLookup(plan.stripeLookupKey);
  if (!priceId) return NextResponse.json({ error: "price not found" }, { status: 500 });

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    // Lock the subscription to the authenticated account's email.
    customer_email: email,
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    success_url: `${config.appUrl}/user-setting/billing?upgraded=1`,
    cancel_url: `${config.appUrl}/user-setting/billing`,
    metadata: { plan: plan.id, source: "in_product" },
    subscription_data: { metadata: { plan: plan.id } },
  });

  return NextResponse.json({ url: session.url, mode: "checkout" });
}
