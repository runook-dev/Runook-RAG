import Stripe from "stripe";
import { config } from "./config";

export const stripe = new Stripe(config.stripeSecretKey, {
  apiVersion: "2025-08-27.basil",
});

/** Resolve a Stripe price id from a stable lookup_key. */
export async function priceIdForLookup(lookupKey: string): Promise<string | null> {
  const res = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  return res.data[0]?.id ?? null;
}
