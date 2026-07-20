/**
 * Admin override records. These are AUTHORITATIVE: an override plan beats the
 * billing/Stripe plan, and `blocked: true` keeps an account suspended even if
 * it would otherwise be authorized. Stored in DynamoDB as
 *   PK=ALLOW#<email>  SK=ALLOW  { email, plan, blocked, note, grantedAt }
 */
import { config } from "./config";
import type { PlanId } from "./plans";

export interface AllowEntry {
  email: string;
  plan: PlanId;
  blocked?: boolean;
  note?: string;
  grantedAt: string;
}

async function client() {
  const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
  const { DynamoDBDocumentClient } = await import("@aws-sdk/lib-dynamodb");
  return DynamoDBDocumentClient.from(new DynamoDBClient({ region: config.awsRegion }), {
    marshallOptions: { removeUndefinedValues: true },
  });
}

export async function getAllow(email: string): Promise<AllowEntry | null> {
  const { GetCommand } = await import("@aws-sdk/lib-dynamodb");
  const c = await client();
  const r = await c.send(new GetCommand({ TableName: config.dynamoTable, Key: { PK: `ALLOW#${email.toLowerCase()}`, SK: "ALLOW" } }));
  return (r.Item as AllowEntry | undefined) ?? null;
}

/** Set (or update) an override plan. Clears any block unless keepBlocked. */
export async function grant(email: string, plan: PlanId, note?: string, keepBlocked = false): Promise<void> {
  const { PutCommand } = await import("@aws-sdk/lib-dynamodb");
  const c = await client();
  const existing = await getAllow(email);
  await c.send(
    new PutCommand({
      TableName: config.dynamoTable,
      Item: {
        PK: `ALLOW#${email.toLowerCase()}`,
        SK: "ALLOW",
        email: email.toLowerCase(),
        plan,
        blocked: keepBlocked ? !!existing?.blocked : false,
        note,
        grantedAt: existing?.grantedAt ?? new Date().toISOString(),
      },
    })
  );
}

/** Persistently block (admin suspend) or unblock an account. */
export async function setBlocked(email: string, blocked: boolean, fallbackPlan: PlanId = "trial"): Promise<void> {
  const { PutCommand } = await import("@aws-sdk/lib-dynamodb");
  const c = await client();
  const existing = await getAllow(email);
  await c.send(
    new PutCommand({
      TableName: config.dynamoTable,
      Item: {
        PK: `ALLOW#${email.toLowerCase()}`,
        SK: "ALLOW",
        email: email.toLowerCase(),
        plan: existing?.plan ?? fallbackPlan,
        blocked,
        note: existing?.note,
        grantedAt: existing?.grantedAt ?? new Date().toISOString(),
      },
    })
  );
}

export async function revoke(email: string): Promise<void> {
  const { DeleteCommand } = await import("@aws-sdk/lib-dynamodb");
  const c = await client();
  await c.send(new DeleteCommand({ TableName: config.dynamoTable, Key: { PK: `ALLOW#${email.toLowerCase()}`, SK: "ALLOW" } }));
}

export async function listAllow(): Promise<AllowEntry[]> {
  const { ScanCommand } = await import("@aws-sdk/lib-dynamodb");
  const c = await client();
  const r = await c.send(
    new ScanCommand({
      TableName: config.dynamoTable,
      FilterExpression: "SK = :sk",
      ExpressionAttributeValues: { ":sk": "ALLOW" },
    })
  );
  return (r.Items ?? []) as AllowEntry[];
}
