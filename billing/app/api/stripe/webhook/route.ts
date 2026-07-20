/**
 * Stripe webhook: drives provisioning and subscription lifecycle.
 *
 * - checkout.session.completed  -> create customer record + provision RAGFlow tenant
 * - customer.subscription.updated -> sync plan/status
 * - customer.subscription.deleted -> mark canceled (quota job will suspend)
 * - invoice.payment_failed       -> mark past_due
 */
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { config } from "@/lib/config";
import { stripe } from "@/lib/stripe";
import { getStore } from "@/lib/store";
import { provisionTenant } from "@/lib/provision";
import { PLANS, planByLookupKey, type PlanId } from "@/lib/plans";
import type { BillingCustomer } from "@/lib/types";

export const dynamic = "force-dynamic";

async function planFromSubscription(subId: string): Promise<PlanId> {
  const sub = await stripe.subscriptions.retrieve(subId, { expand: ["items.data.price"] });
  const lookup = (sub.items.data[0]?.price as any)?.lookup_key as string | undefined;
  const meta = (sub.metadata?.plan as PlanId | undefined) ?? undefined;
  return (lookup && planByLookupKey(lookup)?.id) || meta || "starter";
}

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig!, config.stripeWebhookSecret);
  } catch (err) {
    return NextResponse.json({ error: `signature: ${(err as Error).message}` }, { status: 400 });
  }

  const store = getStore();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as any;
        const email = (s.customer_details?.email || s.customer_email || "").toLowerCase();
        const stripeCustomerId = s.customer as string;
        const planId = (s.metadata?.plan as PlanId) || "starter";
        if (!email) break;

        let customer = await store.getByEmail(email);
        const now = new Date().toISOString();
        if (!customer) {
          customer = {
            id: randomUUID(),
            email,
            plan: planId,
            status: "pending_provision",
            stripeCustomerId,
            stripeSubscriptionId: s.subscription as string,
            createdAt: now,
            updatedAt: now,
          } as BillingCustomer;
        } else {
          customer.plan = planId;
          customer.stripeCustomerId = stripeCustomerId;
          customer.stripeSubscriptionId = s.subscription as string;
          customer.status = "pending_provision";
          customer.updatedAt = now;
        }
        await store.put(customer);

        // Provision (or re-sync) the RAGFlow tenant.
        const nickname = email.split("@")[0];
        const prov = await provisionTenant(email, nickname);
        if (prov.ok) {
          customer.ragflowTenantId = prov.tenantId;
          customer.ragflowApiToken = prov.apiToken;
          customer.tempPassword = prov.tempPassword;
          customer.status = "active";
          customer.updatedAt = new Date().toISOString();
          await store.put(customer);
          // TODO(email): send login details via Resend if configured.
        }
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as any;
        const customer = await store.getByStripeCustomer(sub.customer as string);
        if (customer) {
          customer.plan = await planFromSubscription(sub.id);
          customer.status = sub.status === "active" || sub.status === "trialing" ? "active" : "past_due";
          customer.updatedAt = new Date().toISOString();
          await store.put(customer);
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as any;
        const customer = await store.getByStripeCustomer(sub.customer as string);
        if (customer) {
          customer.status = "canceled";
          customer.updatedAt = new Date().toISOString();
          await store.put(customer);
        }
        break;
      }
      case "invoice.payment_failed": {
        const inv = event.data.object as any;
        const customer = await store.getByStripeCustomer(inv.customer as string);
        if (customer) {
          customer.status = "past_due";
          customer.updatedAt = new Date().toISOString();
          await store.put(customer);
        }
        break;
      }
    }
  } catch (err) {
    // Log and 500 so Stripe retries.
    console.error("webhook handler error", err);
    return NextResponse.json({ error: "handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
