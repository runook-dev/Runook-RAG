/**
 * Storage abstraction for the portal.
 *
 * Two backends implement the same interface:
 *   - DynamoDB (production, single-table design)
 *   - Local JSON file (dev only, no AWS needed)
 *
 * Single-table DynamoDB key design (table = config.dynamoTable):
 *   Customer          PK=CUST#<id>            SK=PROFILE
 *   Customer-by-email PK=EMAIL#<email>        SK=EMAIL   (attr: customerId)
 *   Usage             PK=CUST#<id>            SK=USAGE#<month>
 *   Session           PK=SESSION#<token>      SK=SESSION (with TTL attr `ttl`)
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { config } from "./config";
import type { Customer, Session, UsageRecord } from "./types";

export interface Store {
  getCustomer(id: string): Promise<Customer | null>;
  getCustomerByEmail(email: string): Promise<Customer | null>;
  putCustomer(customer: Customer): Promise<void>;
  listCustomers(): Promise<Customer[]>;

  getUsage(customerId: string, month: string): Promise<UsageRecord | null>;
  addUsage(customerId: string, month: string, tokens: number, requests: number): Promise<UsageRecord>;

  putSession(session: Session): Promise<void>;
  getSession(token: string): Promise<Session | null>;
  deleteSession(token: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Local file store (dev)
// ---------------------------------------------------------------------------

interface LocalData {
  customers: Record<string, Customer>;
  usage: Record<string, UsageRecord>;
  sessions: Record<string, Session>;
}

class LocalStore implements Store {
  private file = path.join(process.cwd(), ".data", "store.json");

  private async read(): Promise<LocalData> {
    try {
      const raw = await fs.readFile(this.file, "utf8");
      return JSON.parse(raw) as LocalData;
    } catch {
      return { customers: {}, usage: {}, sessions: {} };
    }
  }

  private async write(data: LocalData): Promise<void> {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(this.file, JSON.stringify(data, null, 2), "utf8");
  }

  async getCustomer(id: string): Promise<Customer | null> {
    const d = await this.read();
    return d.customers[id] ?? null;
  }

  async getCustomerByEmail(email: string): Promise<Customer | null> {
    const d = await this.read();
    return Object.values(d.customers).find((c) => c.email === email.toLowerCase()) ?? null;
  }

  async putCustomer(customer: Customer): Promise<void> {
    const d = await this.read();
    d.customers[customer.id] = customer;
    await this.write(d);
  }

  async listCustomers(): Promise<Customer[]> {
    const d = await this.read();
    return Object.values(d.customers);
  }

  async getUsage(customerId: string, month: string): Promise<UsageRecord | null> {
    const d = await this.read();
    return d.usage[`${customerId}#${month}`] ?? null;
  }

  async addUsage(customerId: string, month: string, tokens: number, requests: number): Promise<UsageRecord> {
    const d = await this.read();
    const key = `${customerId}#${month}`;
    const prev = d.usage[key] ?? { customerId, month, tokens: 0, requests: 0, updatedAt: "" };
    const next: UsageRecord = {
      customerId,
      month,
      tokens: prev.tokens + tokens,
      requests: prev.requests + requests,
      updatedAt: new Date().toISOString(),
    };
    d.usage[key] = next;
    await this.write(d);
    return next;
  }

  async putSession(session: Session): Promise<void> {
    const d = await this.read();
    d.sessions[session.token] = session;
    await this.write(d);
  }

  async getSession(token: string): Promise<Session | null> {
    const d = await this.read();
    const s = d.sessions[token];
    if (!s) return null;
    if (new Date(s.expiresAt) < new Date()) return null;
    return s;
  }

  async deleteSession(token: string): Promise<void> {
    const d = await this.read();
    delete d.sessions[token];
    await this.write(d);
  }
}

// ---------------------------------------------------------------------------
// DynamoDB store (production)
// ---------------------------------------------------------------------------

class DynamoStore implements Store {
  private table = config.dynamoTable;
  // Lazily import the AWS SDK so local dev without the dep still works.
  private async client() {
    const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
    const { DynamoDBDocumentClient } = await import("@aws-sdk/lib-dynamodb");
    const base = new DynamoDBClient({ region: config.awsRegion });
    return DynamoDBDocumentClient.from(base, {
      marshallOptions: { removeUndefinedValues: true },
    });
  }

  async getCustomer(id: string): Promise<Customer | null> {
    const { GetCommand } = await import("@aws-sdk/lib-dynamodb");
    const c = await this.client();
    const res = await c.send(new GetCommand({ TableName: this.table, Key: { PK: `CUST#${id}`, SK: "PROFILE" } }));
    return (res.Item as (Customer & Record<string, unknown>) | undefined)?.email ? (res.Item as Customer) : null;
  }

  async getCustomerByEmail(email: string): Promise<Customer | null> {
    const { GetCommand } = await import("@aws-sdk/lib-dynamodb");
    const c = await this.client();
    const idx = await c.send(
      new GetCommand({ TableName: this.table, Key: { PK: `EMAIL#${email.toLowerCase()}`, SK: "EMAIL" } })
    );
    const customerId = idx.Item?.customerId as string | undefined;
    if (!customerId) return null;
    return this.getCustomer(customerId);
  }

  async putCustomer(customer: Customer): Promise<void> {
    const { PutCommand } = await import("@aws-sdk/lib-dynamodb");
    const c = await this.client();
    await c.send(
      new PutCommand({
        TableName: this.table,
        Item: { PK: `CUST#${customer.id}`, SK: "PROFILE", ...customer },
      })
    );
    await c.send(
      new PutCommand({
        TableName: this.table,
        Item: { PK: `EMAIL#${customer.email.toLowerCase()}`, SK: "EMAIL", customerId: customer.id },
      })
    );
  }

  async listCustomers(): Promise<Customer[]> {
    const { ScanCommand } = await import("@aws-sdk/lib-dynamodb");
    const c = await this.client();
    const res = await c.send(
      new ScanCommand({
        TableName: this.table,
        FilterExpression: "SK = :sk",
        ExpressionAttributeValues: { ":sk": "PROFILE" },
      })
    );
    return (res.Items ?? []) as Customer[];
  }

  async getUsage(customerId: string, month: string): Promise<UsageRecord | null> {
    const { GetCommand } = await import("@aws-sdk/lib-dynamodb");
    const c = await this.client();
    const res = await c.send(
      new GetCommand({ TableName: this.table, Key: { PK: `CUST#${customerId}`, SK: `USAGE#${month}` } })
    );
    return (res.Item as UsageRecord | undefined) ?? null;
  }

  async addUsage(customerId: string, month: string, tokens: number, requests: number): Promise<UsageRecord> {
    const { UpdateCommand } = await import("@aws-sdk/lib-dynamodb");
    const c = await this.client();
    const res = await c.send(
      new UpdateCommand({
        TableName: this.table,
        Key: { PK: `CUST#${customerId}`, SK: `USAGE#${month}` },
        UpdateExpression:
          "SET customerId = :cid, #m = :month, tokens = if_not_exists(tokens, :zero) + :t, requests = if_not_exists(requests, :zero) + :r, updatedAt = :now",
        ExpressionAttributeNames: { "#m": "month" },
        ExpressionAttributeValues: {
          ":cid": customerId,
          ":month": month,
          ":t": tokens,
          ":r": requests,
          ":zero": 0,
          ":now": new Date().toISOString(),
        },
        ReturnValues: "ALL_NEW",
      })
    );
    return res.Attributes as UsageRecord;
  }

  async putSession(session: Session): Promise<void> {
    const { PutCommand } = await import("@aws-sdk/lib-dynamodb");
    const c = await this.client();
    await c.send(
      new PutCommand({
        TableName: this.table,
        Item: {
          PK: `SESSION#${session.token}`,
          SK: "SESSION",
          ...session,
          ttl: Math.floor(new Date(session.expiresAt).getTime() / 1000),
        },
      })
    );
  }

  async getSession(token: string): Promise<Session | null> {
    const { GetCommand } = await import("@aws-sdk/lib-dynamodb");
    const c = await this.client();
    const res = await c.send(
      new GetCommand({ TableName: this.table, Key: { PK: `SESSION#${token}`, SK: "SESSION" } })
    );
    const s = res.Item as Session | undefined;
    if (!s) return null;
    if (new Date(s.expiresAt) < new Date()) return null;
    return s;
  }

  async deleteSession(token: string): Promise<void> {
    const { DeleteCommand } = await import("@aws-sdk/lib-dynamodb");
    const c = await this.client();
    await c.send(new DeleteCommand({ TableName: this.table, Key: { PK: `SESSION#${token}`, SK: "SESSION" } }));
  }
}

let _store: Store | null = null;

export function getStore(): Store {
  if (_store) return _store;
  _store = config.store === "dynamo" ? new DynamoStore() : new LocalStore();
  return _store;
}
