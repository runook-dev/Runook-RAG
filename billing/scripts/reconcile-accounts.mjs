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

// Policy: FREEMIUM. Every new signup gets a limited Trial automatically so
// login always works; Trials expire after TRIAL_DAYS. Set RUNOOK_PAID_ONLY=1
// to instead hard-block anyone who isn't a paying subscriber or allowlisted.
const PAID_ONLY = process.env.RUNOOK_PAID_ONLY === "1";
const TRIAL_DAYS = Number(process.env.RUNOOK_TRIAL_DAYS ?? 14);

async function grantTrial(email) {
  const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
  const { DynamoDBDocumentClient, PutCommand } = await import("@aws-sdk/lib-dynamodb");
  const c = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
  const now = new Date().toISOString();
  await c.send(
    new PutCommand({
      TableName: TABLE,
      Item: { PK: `ALLOW#${email}`, SK: "ALLOW", email, plan: "trial", note: "auto-trial", grantedAt: now },
    })
  );
  return now;
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
    const a = allowByEmail.get(email); // admin override — authoritative
    const privileged = u.is_superuser || ALWAYS_ALLOW.has(email);

    // Admin block is persistent and wins over everything (except superusers).
    if (a?.blocked && !privileged) {
      if (active) {
        await py("/ragflow/quota_tool.py", "suspend", u.id);
        console.log(`suspended (admin block): ${email}`);
      }
      continue;
    }

    // Plan precedence: admin override > active billing > trial (freemium).
    let plan, grantedAt;
    if (a) {
      plan = a.plan;
      grantedAt = a.grantedAt;
    } else if (b?.status === "active") {
      plan = b.plan;
    } else if (privileged) {
      plan = "business";
    } else if (PAID_ONLY) {
      if (active) {
        await py("/ragflow/quota_tool.py", "suspend", u.id);
        console.log(`suspended (no subscription): ${email}`);
      }
      continue;
    } else {
      grantedAt = await grantTrial(email);
      plan = "trial";
      console.log(`auto-trial: ${email}`);
    }

    // Trial expiry.
    if (plan === "trial" && grantedAt && !privileged) {
      const ageDays = (Date.now() - new Date(grantedAt).getTime()) / 86400000;
      if (ageDays > TRIAL_DAYS) {
        if (active) {
          await py("/ragflow/quota_tool.py", "suspend", u.id);
          console.log(`suspended (trial expired): ${email}`);
        }
        continue;
      }
    }

    // Enforce all plan dimensions (credits, KBs, storage, seats).
    const limit = privileged ? { credits: 0, knowledge_bases: 0, seats: 0, storage_gb: 0 } : LIMITS[plan] || LIMITS.trial;
    let overReason = "";
    try {
      const m = JSON.parse(await py("/ragflow/quota_tool.py", "metrics", u.id));
      for (const [k, v] of [
        ["credits", m.credits],
        ["knowledge_bases", m.knowledge_bases],
        ["seats", m.seats],
        ["storage_gb", m.storage_gb],
      ]) {
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
