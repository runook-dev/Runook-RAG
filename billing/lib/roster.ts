/**
 * Unified account roster: every RAGFlow user joined with billing + allowlist
 * status, so staff can manage all customers in one place. Runs on the EC2 host
 * (uses docker exec to read RAGFlow users).
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { config } from "./config";
import { getStore } from "./store";
import { listAllow } from "./allowlist";
import { listRagflowUsers as dbListUsers } from "./ragflow-db";
import type { PlanId } from "./plans";

const execFileAsync = promisify(execFile);

export interface RosterEntry {
  email: string;
  nickname?: string | null;
  tenantId: string;
  loginChannel?: string | null;
  isSuperuser: boolean;
  active: boolean; // RAGFlow is_active
  source: "billing" | "allowlist" | "superuser" | "unmanaged";
  plan?: PlanId;
  billingStatus?: string;
  authorized: boolean; // should this account be allowed to use the product?
}

/** The Runook staff/owner account is always authorized. */
const ALWAYS_ALLOW = new Set(["admin@runook.com"]);

export async function buildRoster(): Promise<RosterEntry[]> {
  const [users, allow] = await Promise.all([dbListUsers(), listAllow()]);
  const store = getStore();
  const allowByEmail = new Map(allow.map((a) => [a.email.toLowerCase(), a]));

  const roster: RosterEntry[] = [];
  for (const u of users) {
    const email = (u.email || "").toLowerCase();
    const billing = await store.getByEmail(email);
    const billingActive = billing?.status === "active";
    const allowEntry = allowByEmail.get(email);
    const isSuper = !!u.is_superuser;

    let source: RosterEntry["source"] = "unmanaged";
    let plan: PlanId | undefined;
    if (billing) {
      source = "billing";
      plan = billing.plan;
    } else if (allowEntry) {
      source = "allowlist";
      plan = allowEntry.plan;
    } else if (isSuper || ALWAYS_ALLOW.has(email)) {
      source = "superuser";
    }

    const authorized = billingActive || !!allowEntry || isSuper || ALWAYS_ALLOW.has(email);

    roster.push({
      email,
      nickname: u.nickname ?? undefined,
      tenantId: u.id,
      loginChannel: u.login_channel ?? undefined,
      isSuperuser: isSuper,
      active: String(u.is_active) === "1",
      source,
      plan,
      billingStatus: billing?.status,
      authorized,
    });
  }
  return roster;
}

export async function setUserActive(tenantId: string, active: boolean): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync(
      "docker",
      [
        "exec",
        config.ragflowContainer,
        "/ragflow/.venv/bin/python",
        "/ragflow/quota_tool.py",
        active ? "activate" : "suspend",
        tenantId,
      ],
      { timeout: 30000 }
    );
    return JSON.parse(stdout.trim().split("\n").pop() || "{}").ok === true;
  } catch {
    return false;
  }
}
