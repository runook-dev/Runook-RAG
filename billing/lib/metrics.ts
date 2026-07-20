/**
 * Per-tenant usage metrics (credits, knowledge bases, storage, seats) read via
 * the in-container quota_tool, plus a helper to resolve a tenant id by email.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { config } from "./config";

const execFileAsync = promisify(execFile);

export interface Metrics {
  credits: number;
  knowledge_bases: number;
  seats: number;
  storage_gb: number;
}

export async function getMetrics(tenantId: string): Promise<Metrics | null> {
  try {
    const { stdout } = await execFileAsync(
      "docker",
      ["exec", config.ragflowContainer, "/ragflow/.venv/bin/python", "/ragflow/quota_tool.py", "metrics", tenantId],
      { timeout: 20000 }
    );
    const d = JSON.parse(stdout.trim().split("\n").pop() || "{}");
    if (!d.ok) return null;
    return { credits: d.credits, knowledge_bases: d.knowledge_bases, seats: d.seats, storage_gb: d.storage_gb };
  } catch {
    return null;
  }
}

export async function getTenantIdByEmail(email: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(
      "docker",
      ["exec", config.ragflowContainer, "/ragflow/.venv/bin/python", "/ragflow/list_users.py"],
      { timeout: 20000 }
    );
    const users = JSON.parse(stdout.trim().split("\n").pop() || "[]");
    const u = users.find((x: any) => (x.email || "").toLowerCase() === email.toLowerCase());
    return u?.id ?? null;
  } catch {
    return null;
  }
}
