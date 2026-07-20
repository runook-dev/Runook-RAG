/**
 * Access allowlist: emails granted product access WITHOUT a paid Stripe
 * subscription (trials, staff, comped accounts). Stored in DynamoDB as
 *   PK=ALLOW#<email>  SK=ALLOW  { email, plan, note, grantedAt }
 */
import { config } from "./config";
import type { PlanId } from "./plans";

export interface AllowEntry {
  email: string;
  plan: PlanId;
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

export async function grant(email: string, plan: PlanId, note?: string): Promise<void> {
  const { PutCommand } = await import("@aws-sdk/lib-dynamodb");
  const c = await client();
  await c.send(
    new PutCommand({
      TableName: config.dynamoTable,
      Item: {
        PK: `ALLOW#${email.toLowerCase()}`,
        SK: "ALLOW",
        email: email.toLowerCase(),
        plan,
        note,
        grantedAt: new Date().toISOString(),
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
