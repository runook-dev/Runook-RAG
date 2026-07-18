/**
 * Runook RAG gateway.
 *
 * Every customer request to the RAG engine flows through here:
 *   1. Authenticate the Runook session (cookie).
 *   2. Check the monthly token quota for the customer's plan.
 *   3. Forward the request to the internal RAGFlow /api/v1 endpoint using the
 *      customer's tenant-scoped RAGFlow token (never exposed to the browser).
 *   4. Record token + request usage from the engine response.
 *
 * The customer's browser only ever sees this /api/rag/* surface and the Runook
 * brand. RAGFlow's URL and tokens stay server-side.
 */
import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { getCurrentCustomer } from "@/lib/auth";
import { checkQuota, extractTokens, recordUsage } from "@/lib/usage";

export const dynamic = "force-dynamic";

// Endpoints that consume LLM tokens and therefore require a quota check.
const METERED = [/\/chat/i, /\/completions/i, /\/retrieval/i, /\/agents?\//i];

async function handle(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const customer = await getCurrentCustomer();
  if (!customer) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (customer.status !== "active") {
    return NextResponse.json({ error: "Account suspended" }, { status: 403 });
  }

  const { path } = await ctx.params;
  const subPath = "/" + path.join("/");
  const isMetered = METERED.some((re) => re.test(subPath));

  if (isMetered) {
    const quota = await checkQuota(customer);
    if (!quota.allowed) {
      return NextResponse.json(
        { error: "Monthly usage limit reached. Contact Runook to upgrade your plan.", quota },
        { status: 429 }
      );
    }
  }

  const url = new URL(req.url);
  const target = `${config.ragflowBaseUrl}/api/v1${subPath}${url.search}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${customer.ragflowApiToken}`,
  };
  const contentType = req.headers.get("content-type");
  if (contentType) headers["content-type"] = contentType;

  const method = req.method;
  const body = method === "GET" || method === "HEAD" ? undefined : await req.arrayBuffer();

  let upstream: Response;
  try {
    upstream = await fetch(target, { method, headers, body, cache: "no-store" });
  } catch (err) {
    return NextResponse.json({ error: "RAG engine unavailable", detail: (err as Error).message }, { status: 502 });
  }

  const text = await upstream.text();

  if (isMetered && upstream.ok) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = undefined;
    }
    const tokens = extractTokens(parsed);
    // Record asynchronously; don't block the response on the write.
    recordUsage(customer.id, tokens, 1).catch(() => {});
  }

  return new NextResponse(text, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
  });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
export const PATCH = handle;
