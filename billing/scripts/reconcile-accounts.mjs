/**
 * Account reconciliation (run hourly on the EC2 host).
 *
 * Enforces access control + quota across ALL RAGFlow users:
 *   - Authorized = active billing subscriber OR allowlisted OR superuser.
 *   - Unauthorized active users are SUSPENDED (blocks free Google sign-ups).
 *   - Authorized suspended users are REACTIVATED.
 *   - Authorized users over their monthly credit allowance are SUSPENDED.
 *
 *   RUNOOK_DDB_TABLE=runook-rag AWS_REGION=us-east-1 node scripts/reconcile-accounts.mjs
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const CONTAINER = process.env.RAGFLOW_CONTAINER ?? "docker-ragflow-cpu-1";
const TABLE = process.env.RUNOOK_DDB_TABLE ?? "runook-rag";
const REGION = process.env.AWS_REGION ?? "us-east-1";
const ALWAYS_ALLOW = new Set(["admin@runook.com"]);
// Per-plan hard limits (0 = unlimited). Keep in sync with billing/lib/plans.ts.
const LIMITS = {
  trial: { credits: 500, knowledge_bases: 1, seats: 1, storage_gb: 0.2 },
  starter: { credits: 5000, knowledge_bases: 10, seats: 3, storage_gb: 5 },
  growth: { credits: 25000, knowledge_bases: 50, seats: 10, storage_gb: 25 },
  business: { credits: 100000, knowledge_bases: 0, seats: 25, storage_gb: 100 },
  enterprise: { credits: 0, knowledge_bases: 0, seats: 0, storage_gb: 0 },
};

async function dexec(args) {
  const { stdout } = await execFileAsync("docker", ["exec", CONTAINER, ...args], { timeout: 30000 });
  return stdout.trim().split("\n").pop();
}
const py = (...a) => dexec(["/ragflow/.venv/bin/python", ...a]);

async function scan(prefix, sk) {
  const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
  const { DynamoDBDocumentClient, ScanCommand } = await import("@aws-sdk/lib-dynamodb");
  const c = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
  const r = await c.send(
    new ScanCommand({ TableName: TABLE, FilterExpression: "SK = :sk", ExpressionAttributeValues: { ":sk": sk } })
  );
  return (r.Items ?? []).filter((x) => String(x.PK ?? "").startsWith(prefix));
}

async function main() {
  const users = JSON.parse(await py("/ragflow/list_users.py"));
  const billing = await scan("BILL#", "PROFILE");
  const allow = await scan("ALLOW#", "ALLOW");
  const billingByEmail = new Map(billing.map((b) => [String(b.email).toLowerCase(), b]));
  const allowByEmail = new Map(allow.map((a) => [String(a.email).toLowerCase(), a]));

  for (const u of users) {
    const email = String(u.email || "").toLowerCase();
    const active = String(u.is_active) === "1";
    const b = billingByEmail.get(email);
    const a = allowByEmail.get(email);
    const authorized = b?.status === "active" || !!a || u.is_superuser || ALWAYS_ALLOW.has(email);

    if (!authorized) {
      if (active) {
        await py("/ragflow/quota_tool.py", "suspend", u.id);
        console.log(`suspended (unauthorized): ${email}`);
      }
      continue;
    }

    // Authorized: enforce all plan dimensions (credits, KBs, storage, seats).
    const plan = b?.plan || a?.plan || "trial";
    const limit = LIMITS[plan] || LIMITS.trial;
    let overReason = "";
    try {
      const m = JSON.parse(await py("/ragflow/quota_tool.py", "metrics", u.id));
      const checks = [
        ["credits", m.credits],
        ["knowledge_bases", m.knowledge_bases],
        ["seats", m.seats],
        ["storage_gb", m.storage_gb],
      ];
      for (const [k, v] of checks) {
        const lim = limit[k];
        if (lim && lim > 0 && v > lim) {
          overReason = `${k} ${v}>${lim}`;
          break;
        }
      }
    } catch (e) {
      console.error(`metrics failed for ${email}: ${e.message}`);
      continue;
    }
    if (overReason && active) {
      await py("/ragflow/quota_tool.py", "suspend", u.id);
      console.log(`suspended (${overReason}): ${email}`);
    } else if (!overReason && !active) {
      await py("/ragflow/quota_tool.py", "activate", u.id);
      console.log(`reactivated: ${email}`);
    }
  }
  console.log("reconcile done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
