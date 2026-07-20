/**
 * Provision (or re-sync) a RAGFlow tenant for a billing customer.
 *
 * Runs the in-container provisioning script we ship at
 * deploy/provision_tenant.py via `docker exec`. This requires the billing
 * service to run on the EC2 host that runs the RAGFlow container (it shells out
 * to docker). The script is idempotent: repeat calls reuse the tenant + token.
 */
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { promisify } from "node:util";
import { config } from "./config";

const execFileAsync = promisify(execFile);

export interface ProvisionResult {
  ok: boolean;
  tenantId?: string;
  apiToken?: string;
  tempPassword?: string;
  error?: string;
}

export async function provisionTenant(email: string, nickname: string): Promise<ProvisionResult> {
  // A fresh temp password each provision; for existing users this resets it.
  const tempPassword = randomBytes(9).toString("base64url");
  try {
    const { stdout } = await execFileAsync(
      "docker",
      [
        "exec",
        config.ragflowContainer,
        "/ragflow/.venv/bin/python",
        "/ragflow/provision_tenant.py",
        "--email",
        email,
        "--nickname",
        nickname,
        "--password",
        tempPassword,
      ],
      { timeout: 60_000 }
    );
    const line = stdout.trim().split("\n").pop() || "{}";
    const parsed = JSON.parse(line);
    if (!parsed.ok) return { ok: false, error: parsed.error || "provision failed" };
    return { ok: true, tenantId: parsed.tenant_id, apiToken: parsed.api_token, tempPassword };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
