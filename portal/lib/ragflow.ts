/**
 * Thin server-side client for the internal RAGFlow engine.
 *
 * Customers never call RAGFlow directly. This module runs only on the server
 * and injects the per-tenant API token. RAGFlow's HTTP API is served under
 * /api/v1 (see ragflow/api/constants.py: API_VERSION = "v1").
 */
import { config } from "./config";

export interface RagflowResult<T = unknown> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

function url(path: string): string {
  return `${config.ragflowBaseUrl}/api/v1${path.startsWith("/") ? path : `/${path}`}`;
}

async function call<T>(
  token: string,
  method: string,
  path: string,
  body?: unknown,
  init?: RequestInit
): Promise<RagflowResult<T>> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...(body ? { "Content-Type": "application/json" } : {}),
    ...(init?.headers as Record<string, string> | undefined),
  };
  try {
    const res = await fetch(url(path), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      // RAGFlow is internal; do not cache.
      cache: "no-store",
      ...init,
    });
    const text = await res.text();
    let data: unknown = undefined;
    try {
      data = text ? JSON.parse(text) : undefined;
    } catch {
      data = text;
    }
    return { ok: res.ok, status: res.status, data: data as T };
  } catch (err) {
    return { ok: false, status: 502, error: (err as Error).message };
  }
}

export const ragflow = {
  raw: call,

  // Datasets (knowledge bases)
  listDatasets: (token: string) => call(token, "GET", "/datasets"),
  createDataset: (token: string, name: string) => call(token, "POST", "/datasets", { name }),
  deleteDataset: (token: string, id: string) => call(token, "DELETE", `/datasets/${id}`),

  // Retrieval
  retrieve: (token: string, body: unknown) => call(token, "POST", "/retrieval", body),

  // Chats
  listChats: (token: string) => call(token, "GET", "/chats"),
  createChat: (token: string, body: unknown) => call(token, "POST", "/chats", body),
};

/**
 * Provision a new RAGFlow tenant for a customer using the system admin token.
 * NOTE: Exact provisioning endpoints depend on your RAGFlow version. This
 * wraps the two calls we need: create user/tenant, then mint an API token.
 * Wire these to the concrete routes in ragflow/api/apps/restful_apis/*.
 */
export async function provisionTenant(email: string, name: string) {
  // Placeholder for the admin provisioning flow. Implemented against the
  // running engine in a follow-up once the EC2 instance is up.
  return {
    ragflowTenantId: "",
    ragflowApiToken: "",
    note: "provisioning stub — implement against live RAGFlow admin API",
    email,
    name,
  };
}
