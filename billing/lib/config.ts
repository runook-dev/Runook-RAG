function req(name: string, v: string | undefined): string {
  if (!v && process.env.NODE_ENV === "production") throw new Error(`Missing env ${name}`);
  return v ?? "";
}

export const config = {
  stripeSecretKey: req("STRIPE_SECRET_KEY", process.env.STRIPE_SECRET_KEY),
  stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? "",
  stripeWebhookSecret: req("STRIPE_WEBHOOK_SECRET", process.env.STRIPE_WEBHOOK_SECRET),

  // Public base URL of this billing site (for Stripe redirect URLs).
  baseUrl: (process.env.BILLING_BASE_URL ?? "https://pay.runook.com").replace(/\/$/, ""),
  // Where customers use the product after subscribing.
  appUrl: (process.env.APP_URL ?? "https://rag.runook.com").replace(/\/$/, ""),

  // RAGFlow engine (internal) for reading usage / admin ops.
  ragflowBaseUrl: (process.env.RAGFLOW_BASE_URL ?? "http://localhost:9380").replace(/\/$/, ""),
  ragflowContainer: process.env.RAGFLOW_CONTAINER ?? "docker-ragflow-cpu-1",

  // Storage
  store: (process.env.RUNOOK_STORE ?? (process.env.NODE_ENV === "production" ? "dynamo" : "local")) as
    | "dynamo"
    | "local",
  dynamoTable: process.env.RUNOOK_DDB_TABLE ?? "runook-rag",
  awsRegion: process.env.AWS_REGION ?? "us-east-1",

  // Admin dashboard access (simple shared token; set in env).
  adminToken: process.env.RUNOOK_ADMIN_DASH_TOKEN ?? "",

  // Optional transactional email (Resend) to send login details.
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  fromEmail: process.env.RESEND_FROM_EMAIL ?? "Runook <info@runook.com>",
} as const;
