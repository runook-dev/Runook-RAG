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

  // Admin dashboard access (shared token still accepted for scripts/API).
  adminToken: process.env.RUNOOK_ADMIN_DASH_TOKEN ?? "",
  // Staff admin login (professional session auth for the back-office UI).
  adminEmail: (process.env.RUNOOK_ADMIN_EMAIL ?? "").toLowerCase(),
  adminPassword: process.env.RUNOOK_ADMIN_PASSWORD ?? "",
  adminSessionSecret: process.env.RUNOOK_ADMIN_SESSION_SECRET ?? process.env.RUNOOK_ADMIN_DASH_TOKEN ?? "runook-admin",

  // Direct read access to RAGFlow's MySQL (host-mapped) for a fast account list.
  mysql: {
    host: process.env.RAGFLOW_MYSQL_HOST ?? "127.0.0.1",
    port: Number(process.env.RAGFLOW_MYSQL_PORT ?? 3306),
    user: process.env.RAGFLOW_MYSQL_USER ?? "root",
    password: process.env.RAGFLOW_MYSQL_PASSWORD ?? "infini_rag_flow",
    database: process.env.RAGFLOW_MYSQL_DB ?? "rag_flow",
  },

  // Optional transactional email (Resend) to send login details.
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  fromEmail: process.env.RESEND_FROM_EMAIL ?? "Runook <info@runook.com>",
} as const;
