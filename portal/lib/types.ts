import type { Plan } from "./config";

/** A Runook RAG customer. One customer maps 1:1 to a RAGFlow tenant. */
export interface Customer {
  /** Runook-side customer id (uuid). */
  id: string;
  email: string;
  name: string;
  /** bcrypt-style hash. For the scaffold we use scrypt (see lib/auth). */
  passwordHash: string;
  plan: Plan;
  /** RAGFlow tenant id (equals the RAGFlow user id created at provision time). */
  ragflowTenantId: string;
  /** RAGFlow API token scoped to that tenant. Server-side secret. */
  ragflowApiToken: string;
  createdAt: string;
  status: "active" | "suspended";
}

/** Per-customer, per-month usage counter. */
export interface UsageRecord {
  customerId: string;
  /** e.g. "2026-07" */
  month: string;
  tokens: number;
  requests: number;
  updatedAt: string;
}

export interface Session {
  token: string;
  customerId: string;
  createdAt: string;
  expiresAt: string;
}
