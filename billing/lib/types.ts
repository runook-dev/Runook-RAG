import type { PlanId } from "./plans";

/** A subscribed customer, keyed by Stripe customer id. */
export interface BillingCustomer {
  id: string; // internal id (uuid)
  email: string;
  plan: PlanId;
  status: "pending_provision" | "active" | "past_due" | "canceled" | "suspended";
  stripeCustomerId: string;
  stripeSubscriptionId?: string;
  /** RAGFlow tenant + token, filled once provisioned. */
  ragflowTenantId?: string;
  ragflowApiToken?: string;
  /** One-time temp password shown/emailed after provisioning (password login). */
  tempPassword?: string;
  createdAt: string;
  updatedAt: string;
}
