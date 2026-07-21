/**
 * Resolve the *authenticated* caller's email for same-origin /runook/* endpoints.
 *
 * SECURITY: these endpoints are reachable at rag.runook.com/runook/* (Caddy
 * proxies them to the billing service). They must NEVER trust an `email` query
 * param — doing so lets anyone read another customer's plan/usage/invoices or
 * open their Stripe billing portal (IDOR). Instead we require the caller's
 * RAGFlow session token (the same `Authorization` header the RAGFlow web app
 * sends) and ask RAGFlow who they are: GET /api/v1/users/me returns the
 * logged-in user's profile (including email). We use that email only.
 */
import { config } from "./config";

export async function resolveCallerEmail(req: Request): Promise<string | null> {
  // The browser forwards RAGFlow's localStorage `Authorization` value. Accept a
  // fallback header name in case an intermediary strips `Authorization`.
  const auth =
    req.headers.get("authorization") || req.headers.get("x-runook-authorization");
  if (!auth) return null;

  try {
    const r = await fetch(`${config.ragflowBaseUrl}/api/v1/users/me`, {
      headers: { Authorization: auth },
      // never cache identity resolution
      cache: "no-store",
    });
    if (!r.ok) return null;
    const body = await r.json();
    if (body?.code !== 0) return null;
    const email = body?.data?.email;
    return email ? String(email).toLowerCase() : null;
  } catch {
    return null;
  }
}
