/**
 * Provision a Runook RAG customer.
 *
 * Local dev (writes to portal/.data/store.json):
 *   node scripts/create-customer.mjs --email a@b.com --name "Acme" --plan starter --password secret \
 *     --tenant <ragflowTenantId> --token <ragflowApiToken>
 *
 * For production (DynamoDB), run with RUNOOK_STORE=dynamo and AWS creds set.
 *
 * The --tenant / --token come from RAGFlow: create a tenant/user in the engine,
 * mint an API token (GET/POST /api/v1/system/tokens), and paste them here.
 */
import { randomBytes, scryptSync } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

const email = arg("email");
const name = arg("name", "Customer");
const plan = arg("plan", "trial");
const password = arg("password");
const tenant = arg("tenant", "");
const token = arg("token", "");

if (!email || !password) {
  console.error("Missing --email or --password");
  process.exit(1);
}

const customer = {
  id: randomBytes(12).toString("hex"),
  email: email.toLowerCase(),
  name,
  passwordHash: hashPassword(password),
  plan,
  ragflowTenantId: tenant,
  ragflowApiToken: token,
  createdAt: new Date().toISOString(),
  status: "active",
};

const store = process.env.RUNOOK_STORE ?? "local";

if (store === "local") {
  const file = path.join(process.cwd(), ".data", "store.json");
  let data = { customers: {}, usage: {}, sessions: {} };
  try {
    data = JSON.parse(await fs.readFile(file, "utf8"));
  } catch {}
  data.customers[customer.id] = customer;
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2));
  console.log(`Created local customer ${email} (id=${customer.id}, plan=${plan})`);
} else {
  const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
  const { DynamoDBDocumentClient, PutCommand } = await import("@aws-sdk/lib-dynamodb");
  const table = process.env.RUNOOK_DDB_TABLE ?? "runook-rag";
  const c = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION ?? "us-east-1" }));
  await c.send(new PutCommand({ TableName: table, Item: { PK: `CUST#${customer.id}`, SK: "PROFILE", ...customer } }));
  await c.send(
    new PutCommand({ TableName: table, Item: { PK: `EMAIL#${customer.email}`, SK: "EMAIL", customerId: customer.id } })
  );
  console.log(`Created DynamoDB customer ${email} (id=${customer.id}, plan=${plan})`);
}
