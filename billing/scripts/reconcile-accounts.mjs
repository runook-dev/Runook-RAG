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
const LIMITS = { trial: 500, starter: 5000, growth: 25000, business: 100000, enterprise: 0 };

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

    // Authorized: check monthly credit quota.
    const plan = b?.plan || a?.plan || "trial";
    const limit = LIMITS[plan] ?? 0;
    let over = false;
    if (limit > 0) {
      try {
        const usage = JSON.parse(await py("/ragflow/quota_tool.py", "usage", u.id));
        over = (usage.used_credits ?? 0) >= limit;
      } catch {}
    }
    if (over && active) {
      await py("/ragflow/quota_tool.py", "suspend", u.id);
      console.log(`suspended (over quota): ${email}`);
    } else if (!over && !active) {
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
