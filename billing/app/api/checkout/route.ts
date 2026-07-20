import { NextResponse } from "next/server";
import { z } from "zod";
import { config } from "@/lib/config";
import { stripe, priceIdForLookup } from "@/lib/stripe";
import { PLANS } from "@/lib/plans";

export const dynamic = "force-dynamic";

const schema = z.object({ plan: z.enum(["starter", "growth", "business"]) });

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid plan" }, { status: 400 });

  const plan = PLANS[parsed.data.plan];
  if (!plan.stripeLookupKey) return NextResponse.json({ error: "not purchasable" }, { status: 400 });

  const priceId = await priceIdForLookup(plan.stripeLookupKey);
  if (!priceId) return NextResponse.json({ error: "price not found" }, { status: 500 });

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    success_url: `${config.baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.baseUrl}/`,
    metadata: { plan: plan.id },
    subscription_data: { metadata: { plan: plan.id } },
  });

  return NextResponse.json({ url: session.url });
}
