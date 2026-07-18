/**
 * Central runtime configuration for the Runook RAG portal.
 *
 * All secrets live server-side only. Never expose RAGFlow's base URL or any
 * tenant API token to the browser — the browser only ever talks to this
 * portal's own /api routes.
 */

function required(name: string, value: string | undefined): string {
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value ?? "";
}

export const config = {
  /** Base URL of the internal RAGFlow engine, e.g. https://rag-internal.runook.com */
  ragflowBaseUrl: (process.env.RAGFLOW_BASE_URL ?? "http://localhost:9380").replace(/\/$/, ""),

  /** RAGFlow admin API token used to provision tenants (system-level). */
  ragflowAdminToken: required("RAGFLOW_ADMIN_TOKEN", process.env.RAGFLOW_ADMIN_TOKEN),

  /**
   * Storage backend for tenants/usage/sessions.
   *  - "dynamo": AWS DynamoDB (production on Amplify)
   *  - "local": JSON file under portal/.data (local dev only)
   */
  store: (process.env.RUNOOK_STORE ?? (process.env.NODE_ENV === "production" ? "dynamo" : "local")) as
    | "dynamo"
    | "local",

  dynamoTable: process.env.RUNOOK_DDB_TABLE ?? "runook-rag",
  awsRegion: process.env.AWS_REGION ?? "us-east-1",

  /** Secret used to sign session cookies. */
  sessionSecret: required("RUNOOK_SESSION_SECRET", process.env.RUNOOK_SESSION_SECRET),

  sessionCookie: "runook_session",
  sessionTtlDays: 30,
} as const;

export type Plan = "trial" | "starter" | "pro" | "enterprise";

/** Monthly token allowance per plan. 0 or negative = unlimited. */
export const PLAN_LIMITS: Record<Plan, { monthlyTokens: number; label: string }> = {
  trial: { monthlyTokens: 100_000, label: "Trial" },
  starter: { monthlyTokens: 2_000_000, label: "Starter" },
  pro: { monthlyTokens: 20_000_000, label: "Pro" },
  enterprise: { monthlyTokens: 0, label: "Enterprise" },
};
