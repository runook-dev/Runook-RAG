/**
 * Document upload + list for a dataset, proxied to RAGFlow with the tenant
 * token. Upload is multipart/form-data (field name "file", multiple allowed).
 */
import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { getCurrentCustomer } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const customer = await getCurrentCustomer();
  if (!customer) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const qs = url.search || "?page=1&page_size=100";
  const res = await fetch(`${config.ragflowBaseUrl}/api/v1/datasets/${id}/documents${qs}`, {
    headers: { Authorization: `Bearer ${customer.ragflowApiToken}` },
    cache: "no-store",
  });
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const customer = await getCurrentCustomer();
  if (!customer) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (customer.status !== "active") return NextResponse.json({ error: "Account suspended" }, { status: 403 });
  const { id } = await ctx.params;

  // Pass the multipart body straight through. Preserve the content-type header
  // (it carries the multipart boundary).
  const contentType = req.headers.get("content-type") ?? "";
  const body = await req.arrayBuffer();
  const res = await fetch(`${config.ragflowBaseUrl}/api/v1/datasets/${id}/documents`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${customer.ragflowApiToken}`,
      "content-type": contentType,
    },
    body,
    cache: "no-store",
  });
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "content-type": "application/json" },
  });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const customer = await getCurrentCustomer();
  if (!customer) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.text();
  const res = await fetch(`${config.ragflowBaseUrl}/api/v1/datasets/${id}/documents`, {
    method: "DELETE",
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
