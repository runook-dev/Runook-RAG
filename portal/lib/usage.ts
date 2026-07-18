import { PLAN_LIMITS } from "./config";
import { getStore } from "./store";
import { currentMonthKey } from "./utils";
import type { Customer } from "./types";

export interface QuotaStatus {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  unlimited: boolean;
}

/** Check whether a customer is within their monthly token allowance. */
export async function checkQuota(customer: Customer): Promise<QuotaStatus> {
  const limit = PLAN_LIMITS[customer.plan].monthlyTokens;
  const unlimited = limit <= 0;
  const month = currentMonthKey();
  const usage = await getStore().getUsage(customer.id, month);
  const used = usage?.tokens ?? 0;
  return {
    allowed: unlimited || used < limit,
    used,
    limit,
    remaining: unlimited ? Infinity : Math.max(0, limit - used),
    unlimited,
  };
}

/** Record token + request usage after a successful engine call. */
export async function recordUsage(customerId: string, tokens: number, requests = 1) {
  const month = currentMonthKey();
  return getStore().addUsage(customerId, month, Math.max(0, Math.round(tokens)), requests);
}

/**
 * Best-effort extraction of token usage from a RAGFlow response body.
 * RAGFlow returns usage in a few shapes depending on the endpoint; we look at
 * the common ones and fall back to 0 (request still counted).
 */
export function extractTokens(data: unknown): number {
  if (!data || typeof data !== "object") return 0;
  const obj = data as Record<string, any>;
  // OpenAI-compatible shape
  if (obj.usage?.total_tokens) return Number(obj.usage.total_tokens) || 0;
  // RAGFlow chat/agent shape
  if (obj.data?.usage?.total_tokens) return Number(obj.data.usage.total_tokens) || 0;
  if (typeof obj.data?.tokens === "number") return obj.data.tokens;
  if (typeof obj.tokens === "number") return obj.tokens;
  return 0;
}
