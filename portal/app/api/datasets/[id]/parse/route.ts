/**
 * Trigger parsing/chunking of uploaded documents in a dataset.
 * POST body: { "document_ids": ["..."] } -> RAGFlow /datasets/<id>/chunks
 */
import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { getCurrentCustomer } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const customer = await getCurrentCustomer();
  if (!customer) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (customer.status !== "active") return NextResponse.json({ error: "Account suspended" }, { status: 403 });
  const { id } = await ctx.params;
  const body = await req.text();
  const res = await fetch(`${config.ragflowBaseUrl}/api/v1/datasets/${id}/chunks`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${customer.ragflowApiToken}`,
      "content-type": "application/json",
    },
    body,
    cache: "no-store",
  });
  const text = await res.text();
  return new NextResponse(text, { status: res.status, headers: { "content-type": "application/json" } });
}
