/**
 * Provision any billing customers stuck in `pending_provision` (e.g. if the
 * webhook's docker exec failed transiently). Safe to run repeatedly; the
 * in-container provision script is idempotent.
 *
 *   node scripts/provision-pending.mjs
 */
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const CONTAINER = process.env.RAGFLOW_CONTAINER ?? "docker-ragflow-cpu-1";
const TABLE = process.env.RUNOOK_DDB_TABLE ?? "runook-rag";
const REGION = process.env.AWS_REGION ?? "us-east-1";

async function ddb() {
  const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
  const { DynamoDBDocumentClient } = await import("@aws-sdk/lib-dynamodb");
  return DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
    marshallOptions: { removeUndefinedValues: true },
  });
}

async function main() {
  const { ScanCommand, UpdateCommand } = await import("@aws-sdk/lib-dynamodb");
  const c = await ddb();
  const res = await c.send(
    new ScanCommand({ TableName: TABLE, FilterExpression: "SK = :sk", ExpressionAttributeValues: { ":sk": "PROFILE" } })
  );
  const pending = (res.Items ?? []).filter(
    (x) => String(x.PK ?? "").startsWith("BILL#") && x.status === "pending_provision"
  );
  if (pending.length === 0) {
    console.log("no pending customers");
    return;
  }
  for (const cust of pending) {
    const tempPassword = randomBytes(9).toString("base64url");
    const nickname = String(cust.email).split("@")[0];
    try {
      const { stdout } = await execFileAsync("docker", [
        "exec", CONTAINER, "/ragflow/.venv/bin/python", "/ragflow/provision_tenant.py",
        "--email", cust.email, "--nickname", nickname, "--password", tempPassword,
      ], { timeout: 60000 });
      const parsed = JSON.parse(stdout.trim().split("\n").pop());
      if (!parsed.ok) {
        console.error(`provision failed for ${cust.email}: ${parsed.error}`);
        continue;
      }
      await c.send(new UpdateCommand({
        TableName: TABLE,
        Key: { PK: cust.PK, SK: "PROFILE" },
        UpdateExpression: "SET #s = :active, ragflowTenantId = :t, ragflowApiToken = :k, tempPassword = :p, updatedAt = :u",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: {
          ":active": "active", ":t": parsed.tenant_id, ":k": parsed.api_token,
          ":p": tempPassword, ":u": new Date().toISOString(),
        },
      }));
      console.log(`provisioned ${cust.email} -> tenant ${String(parsed.tenant_id).slice(0, 8)}`);
    } catch (e) {
      console.error(`error for ${cust.email}: ${e.message}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
