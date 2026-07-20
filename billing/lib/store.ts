/**
 * DynamoDB single-table store for billing customers.
 *   Customer            PK=BILL#<id>            SK=PROFILE
 *   By Stripe customer  PK=STRIPE#<custId>      SK=REF   (attr: id)
 *   By email            PK=BEMAIL#<email>       SK=REF   (attr: id)
 * Local JSON fallback for dev (billing/.data/store.json).
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { config } from "./config";
import type { BillingCustomer } from "./types";

export interface Store {
  put(c: BillingCustomer): Promise<void>;
  get(id: string): Promise<BillingCustomer | null>;
  getByStripeCustomer(stripeCustomerId: string): Promise<BillingCustomer | null>;
  getByEmail(email: string): Promise<BillingCustomer | null>;
  list(): Promise<BillingCustomer[]>;
}

class LocalStore implements Store {
  private file = path.join(process.cwd(), ".data", "store.json");
  private async read(): Promise<{ customers: Record<string, BillingCustomer> }> {
    try {
      return JSON.parse(await fs.readFile(this.file, "utf8"));
    } catch {
      return { customers: {} };
    }
  }
  private async write(d: { customers: Record<string, BillingCustomer> }) {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(this.file, JSON.stringify(d, null, 2));
  }
  async put(c: BillingCustomer) {
    const d = await this.read();
    d.customers[c.id] = c;
    await this.write(d);
  }
  async get(id: string) {
    return (await this.read()).customers[id] ?? null;
  }
  async getByStripeCustomer(sid: string) {
    return Object.values((await this.read()).customers).find((c) => c.stripeCustomerId === sid) ?? null;
  }
  async getByEmail(email: string) {
    return Object.values((await this.read()).customers).find((c) => c.email === email.toLowerCase()) ?? null;
  }
  async list() {
    return Object.values((await this.read()).customers);
  }
}

class DynamoStore implements Store {
  private table = config.dynamoTable;
  private async client() {
    const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
    const { DynamoDBDocumentClient } = await import("@aws-sdk/lib-dynamodb");
    return DynamoDBDocumentClient.from(new DynamoDBClient({ region: config.awsRegion }), {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  async put(c: BillingCustomer) {
    const { PutCommand } = await import("@aws-sdk/lib-dynamodb");
    const cl = await this.client();
    await cl.send(new PutCommand({ TableName: this.table, Item: { PK: `BILL#${c.id}`, SK: "PROFILE", ...c } }));
    await cl.send(
      new PutCommand({ TableName: this.table, Item: { PK: `STRIPE#${c.stripeCustomerId}`, SK: "REF", id: c.id } })
    );
    await cl.send(
      new PutCommand({ TableName: this.table, Item: { PK: `BEMAIL#${c.email.toLowerCase()}`, SK: "REF", id: c.id } })
    );
  }
  async get(id: string) {
    const { GetCommand } = await import("@aws-sdk/lib-dynamodb");
    const cl = await this.client();
    const r = await cl.send(new GetCommand({ TableName: this.table, Key: { PK: `BILL#${id}`, SK: "PROFILE" } }));
    return (r.Item as BillingCustomer | undefined) ?? null;
  }
  private async deref(pk: string) {
    const { GetCommand } = await import("@aws-sdk/lib-dynamodb");
    const cl = await this.client();
    const r = await cl.send(new GetCommand({ TableName: this.table, Key: { PK: pk, SK: "REF" } }));
    const id = r.Item?.id as string | undefined;
    return id ? this.get(id) : null;
  }
  async getByStripeCustomer(sid: string) {
    return this.deref(`STRIPE#${sid}`);
  }
  async getByEmail(email: string) {
    return this.deref(`BEMAIL#${email.toLowerCase()}`);
  }
  async list() {
    const { ScanCommand } = await import("@aws-sdk/lib-dynamodb");
    const cl = await this.client();
    const r = await cl.send(
      new ScanCommand({
        TableName: this.table,
        FilterExpression: "SK = :sk",
        ExpressionAttributeValues: { ":sk": "PROFILE" },
      })
    );
    return ((r.Items ?? []) as BillingCustomer[]).filter((x) => (x as any).PK?.startsWith?.("BILL#"));
  }
}

let _s: Store | null = null;
export function getStore(): Store {
  if (_s) return _s;
  _s = config.store === "dynamo" ? new DynamoStore() : new LocalStore();
  return _s;
}
