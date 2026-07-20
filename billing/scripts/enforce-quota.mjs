/**
 * Quota enforcement job (run on the EC2 host via cron/systemd timer, e.g. hourly).
 *
 * For each active billing customer: read the tenant's used credits from RAGFlow
 * (via quota_tool.py in the container), compare to the plan's monthly allowance,
 * and suspend/reactivate the tenant accordingly.
 *
 *   RUNOOK_STORE=dynamo AWS_REGION=us-east-1 node scripts/enforce-quota.mjs
 *
 * NOTE: This uses cumulative used_tokens as the usage proxy (see quota_tool.py).
 * A proper monthly reset requires zeroing used_tokens at cycle start or tracking
 * a per-month baseline; wire that in once validated against live data.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const CONTAINER = process.env.RAGFLOW_CONTAINER ?? "docker-ragflow-cpu-1";
const TABLE = process.env.RUNOOK_DDB_TABLE ?? "runook-rag";
const REGION = process.env.AWS_REGION ?? "us-east-1";

// Plan monthly credit allowances (keep in sync with billing/lib/plans.ts).
const LIMITS = { trial: 500, starter: 5000, growth: 25000, business: 100000, enterprise: 0 };

async function quota(cmd, tenantId) {
  const { stdout } = await execFileAsync("docker", [
    "exec",
    CONTAINER,
    "/ragflow/.venv/bin/python",
    "/ragflow/quota_tool.py",
    cmd,
    tenantId,
  ]);
  return JSON.parse(stdout.trim().split("\n").pop());
}

async function listCustomers() {
  const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
  const { DynamoDBDocumentClient, ScanCommand } = await import("@aws-sdk/lib-dynamodb");
  const c = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
  const r = await c.send(
    new ScanCommand({ TableName: TABLE, FilterExpression: "SK = :sk", ExpressionAttributeValues: { ":sk": "PROFILE" } })
  );
  return (r.Items ?? []).filter((x) => String(x.PK ?? "").startsWith("BILL#"));
}

async function main() {
  const customers = await listCustomers();
  for (const c of customers) {
    if (!c.ragflowTenantId) continue;
    const limit = LIMITS[c.plan] ?? 0;
    if (limit <= 0) continue; // unlimited/enterprise
    try {
      const u = await quota("usage", c.ragflowTenantId);
      const over = (u.used_credits ?? 0) >= limit;
      if (over && c.status === "active") {
        await quota("suspend", c.ragflowTenantId);
        console.log(`suspended ${c.email} (${u.used_credits}/${limit})`);
      } else if (!over && c.status === "suspended") {
        await quota("activate", c.ragflowTenantId);
        console.log(`reactivated ${c.email} (${u.used_credits}/${limit})`);
      }
    } catch (e) {
      console.error(`quota check failed for ${c.email}: ${e.message}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
