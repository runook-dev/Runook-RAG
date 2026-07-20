/**
 * Runook RAG plans. Limits are enforced by the quota job (scripts/enforce-quota.mjs)
 * and shown on the pricing page + dashboards. Prices/product live in Stripe;
 * we reference them by stable lookup_key so IDs can rotate without code changes.
 */
export type PlanId = "trial" | "starter" | "growth" | "business" | "enterprise";

export interface Plan {
  id: PlanId;
  name: string;
  /** Monthly price in USD cents (null = not self-serve). */
  amount: number | null;
  /** Stripe price lookup_key (null for trial/enterprise). */
  stripeLookupKey: string | null;
  /** Hard limits. 0 = unlimited. */
  limits: {
    knowledgeBases: number;
    seats: number;
    storageGB: number;
    monthlyCredits: number; // 1 credit ~= 1k tokens of LLM usage (tunable)
    apiKey: boolean;
  };
  highlights: string[];
  cta: "subscribe" | "contact" | "trial";
}

export const PLANS: Record<PlanId, Plan> = {
  trial: {
    id: "trial",
    name: "Trial",
    amount: 0,
    stripeLookupKey: null,
    limits: { knowledgeBases: 1, seats: 1, storageGB: 0.2, monthlyCredits: 500, apiKey: false },
    highlights: ["1 knowledge base", "1 seat", "0.2 GB storage", "500 credits / mo", "14-day evaluation"],
    cta: "trial",
  },
  starter: {
    id: "starter",
    name: "Starter",
    amount: 9900,
    stripeLookupKey: "runook_starter_monthly",
    limits: { knowledgeBases: 10, seats: 3, storageGB: 5, monthlyCredits: 5000, apiKey: true },
    highlights: ["10 knowledge bases", "3 seats", "5 GB storage", "5,000 credits / mo", "API access", "Email support"],
    cta: "subscribe",
  },
  growth: {
    id: "growth",
    name: "Growth",
    amount: 39900,
    stripeLookupKey: "runook_growth_monthly",
    limits: { knowledgeBases: 50, seats: 10, storageGB: 25, monthlyCredits: 25000, apiKey: true },
    highlights: ["50 knowledge bases", "10 seats", "25 GB storage", "25,000 credits / mo", "API access", "Priority support"],
    cta: "subscribe",
  },
  business: {
    id: "business",
    name: "Business",
    amount: 99900,
    stripeLookupKey: "runook_business_monthly",
    limits: { knowledgeBases: 0, seats: 25, storageGB: 100, monthlyCredits: 100000, apiKey: true },
    highlights: ["Unlimited knowledge bases", "25 seats", "100 GB storage", "100,000 credits / mo", "SSO / Google", "Priority support"],
    cta: "subscribe",
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    amount: null,
    stripeLookupKey: null,
    limits: { knowledgeBases: 0, seats: 0, storageGB: 0, monthlyCredits: 0, apiKey: true },
    highlights: ["Unlimited everything", "Dedicated / on-prem deployment", "Custom SLA", "Dedicated support"],
    cta: "contact",
  },
};

export const PAID_PLANS: PlanId[] = ["starter", "growth", "business"];

export function planByLookupKey(key: string): Plan | undefined {
  return Object.values(PLANS).find((p) => p.stripeLookupKey === key);
}
