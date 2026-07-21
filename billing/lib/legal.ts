/**
 * Central legal/company constants used across the legal pages and footer.
 *
 * ⚠️ REPLACE THE PLACEHOLDERS below before commercial launch, and have the
 * policy pages reviewed by a lawyer. These templates are industry-standard and
 * drafted to be startup-protective (broad disclaimers, liability cap, no
 * mid-cycle refunds), but they are NOT legal advice or a substitute for counsel.
 */
export const LEGAL = {
  /** Registered legal entity that operates Runook RAG. */
  legalEntity: "[LEGAL ENTITY NAME, e.g. Runook, Inc.]",
  productName: "Runook RAG",
  /** Governing-law jurisdiction for disputes. */
  jurisdiction: "[STATE/COUNTRY, e.g. State of Delaware, USA]",
  /** Public contact + privacy/legal inboxes. */
  contactEmail: "info@runook.com",
  privacyEmail: "privacy@runook.com",
  legalEmail: "legal@runook.com",
  /** Company mailing address (required by many privacy laws). */
  address: "[COMPANY MAILING ADDRESS]",
  /** Last updated / effective date, shown on each policy. */
  effectiveDate: "[EFFECTIVE DATE]",
  websiteUrl: "https://runook.com",
  appUrl: "https://rag.runook.com",
} as const;

/** Third parties that may process customer data (privacy "subprocessors"). */
export const SUBPROCESSORS = [
  ["Amazon Web Services (AWS)", "Cloud hosting, storage, and database (US region)"],
  ["Stripe", "Payment processing and subscription billing"],
  ["Google", "Optional 'Sign in with Google' authentication (OAuth)"],
  ["Resend", "Transactional email delivery (invites, receipts, notifications)"],
  ["LLM providers you configure", "Only the model provider/API key you add under Model Providers (e.g. Google Gemini, OpenAI) — you control this"],
] as const;
