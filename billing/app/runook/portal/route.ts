/**
 * Creates a Stripe Billing Portal session so paying customers can manage their
 * subscription (update card, view invoices, cancel). Same-origin via Caddy.
 */
import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { stripe } from "@/lib/stripe";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const email = (new URL(req.url).searchParams.get("email") || "").toLowerCase();
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const billing = await getStore().getByEmail(email);
  if (!billing?.stripeCustomerId) {
    return NextResponse.json({ error: "no subscription" }, { status: 404 });
  }
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: billing.stripeCustomerId,
      return_url: config.appUrl,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
