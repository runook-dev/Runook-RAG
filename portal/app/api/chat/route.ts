/**
 * Portal chat endpoint.
 *
 * RAGFlow's chat requires (1) a chat assistant (chat_id) and (2) the composite
 * model id (e.g. "gemini-2.5-flash@prod@Gemini"). We lazily create a default
 * assistant per tenant, cache its id + model on the customer record, then call
 * RAGFlow's OpenAI-compatible completion endpoint. Quota is checked/recorded
 * here since this is a metered (LLM) path.
 */
import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { getCurrentCustomer } from "@/lib/auth";
import { getStore } from "@/lib/store";
import { checkQuota, recordUsage } from "@/lib/usage";
import type { Customer } from "@/lib/types";

export const dynamic = "force-dynamic";

async function ragflow(token: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`${config.ragflowBaseUrl}/api/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, data: JSON.parse(text) };
  } catch {
    return { ok: res.ok, status: res.status, data: text };
  }
}

async function listDatasetIds(token: string): Promise<string[]> {
  const res = await ragflow(token, "GET", "/datasets");
  const list = (res.data as any)?.data;
  if (!Array.isArray(list)) return [];
  return list.map((d: any) => d.id).filter(Boolean);
}

/**
 * Ensure a chat assistant exists and is bound to the tenant's current
 * knowledge bases, so answers are grounded in uploaded documents. We resync
 * the bound datasets on each call (cheap) so newly added KBs are included.
 */
async function ensureAssistant(customer: Customer): Promise<{ chatId: string; model: string } | null> {
  const datasetIds = await listDatasetIds(customer.ragflowApiToken);

  if (customer.ragflowChatId && customer.ragflowChatModel) {
    // Keep the assistant's datasets in sync (best-effort).
    await ragflow(customer.ragflowApiToken, "PUT", `/chats/${customer.ragflowChatId}`, {
      dataset_ids: datasetIds,
    }).catch(() => {});
    return { chatId: customer.ragflowChatId, model: customer.ragflowChatModel };
  }

  const created = await ragflow(customer.ragflowApiToken, "POST", "/chats", {
    name: "Runook Assistant",
    dataset_ids: datasetIds,
  });
  const data = (created.data as any)?.data;
  if (!created.ok || !data?.id || !data?.llm_id) return null;

  const updated: Customer = { ...customer, ragflowChatId: data.id, ragflowChatModel: data.llm_id };
  await getStore().putCustomer(updated);
  return { chatId: data.id, model: data.llm_id };
}

export async function POST(req: Request) {
  const customer = await getCurrentCustomer();
  if (!customer) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (customer.status !== "active") return NextResponse.json({ error: "Account suspended" }, { status: 403 });

  const quota = await checkQuota(customer);
  if (!quota.allowed) {
    return NextResponse.json(
      { error: "Monthly usage limit reached. Contact Runook to upgrade your plan." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  const messages = body?.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  const assistant = await ensureAssistant(customer);
  if (!assistant) {
    return NextResponse.json({ error: "Could not initialize chat assistant" }, { status: 502 });
  }

  const completion = await ragflow(
    customer.ragflowApiToken,
    "POST",
    `/chats_openai/${assistant.chatId}/chat/completions`,
    { model: assistant.model, messages, stream: false }
  );

  if (!completion.ok) {
    return NextResponse.json({ error: "Engine error", detail: completion.data }, { status: 502 });
  }

  const data = completion.data as any;
  const answer = data?.choices?.[0]?.message?.content ?? "";
  const tokens = data?.usage?.total_tokens ?? 0;
  recordUsage(customer.id, Number(tokens) || 0, 1).catch(() => {});

  return NextResponse.json({ answer, usage: data?.usage ?? null });
}
