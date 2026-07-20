/**
 * Same-origin invoice list for the in-product "Billing history" tab.
 * Returns the caller's recent Stripe invoices (empty if they have no
 * Stripe customer, e.g. trial / admin-granted accounts).
 */
import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const email = (new URL(req.url).searchParams.get("email") || "").toLowerCase();
  if (!email) return NextResponse.json({ invoices: [] });

  const billing = await getStore().getByEmail(email);
  const customerId = billing?.stripeCustomerId;
  if (!customerId) return NextResponse.json({ invoices: [] });

  try {
    const res = await stripe.invoices.list({ customer: customerId, limit: 24 });
    const invoices = res.data.map((inv) => ({
      id: inv.id,
      number: inv.number,
      created: inv.created,
      amount: inv.amount_paid || inv.amount_due || inv.total || 0,
      currency: inv.currency,
      status: inv.status,
      url: inv.hosted_invoice_url,
    }));
    return NextResponse.json({ invoices }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ invoices: [] });
  }
}
