/**
 * Creates a Stripe Billing Portal session so paying customers can manage their
 * subscription (update card, view invoices, cancel). Same-origin via Caddy.
 */
import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { stripe } from "@/lib/stripe";
import { getStore } from "@/lib/store";
import { resolveCallerEmail } from "@/lib/identity";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Identity comes from the caller's RAGFlow session, never a query param —
  // otherwise anyone could open another customer's Stripe billing portal.
  const email = await resolveCallerEmail(req);
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const billing = await getStore().getByEmail(email);
  if (!billing?.stripeCustomerId) {
    return NextResponse.json({ error: "no subscription" }, { status: 404 });
  }
  const redirectMode = new URL(req.url).searchParams.get("redirect") === "1";
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: billing.stripeCustomerId,
      return_url: config.appUrl,
    });
    // Navigations (?redirect=1) 302 straight to Stripe; fetch() callers get JSON.
    if (redirectMode) return NextResponse.redirect(session.url, 303);
    return NextResponse.json({ url: session.url });
  } catch (e) {
    if (redirectMode) return NextResponse.redirect(`${config.appUrl}`, 303);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
