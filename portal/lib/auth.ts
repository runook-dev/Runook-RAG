import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { config } from "./config";
import { getStore } from "./store";
import type { Customer, Session } from "./types";

// ---------------------------------------------------------------------------
// Password hashing (scrypt — no native deps, ships with Node)
// ---------------------------------------------------------------------------

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, expected] = parts;
  const derived = scryptSync(password, salt, 64);
  const expectedBuf = Buffer.from(expected, "hex");
  if (derived.length !== expectedBuf.length) return false;
  return timingSafeEqual(derived, expectedBuf);
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export async function createSession(customerId: string): Promise<Session> {
  const token = randomBytes(32).toString("hex");
  const now = new Date();
  const expires = new Date(now.getTime() + config.sessionTtlDays * 24 * 60 * 60 * 1000);
  const session: Session = {
    token,
    customerId,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  };
  await getStore().putSession(session);
  const jar = await cookies();
  jar.set(config.sessionCookie, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
  return session;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(config.sessionCookie)?.value;
  if (token) {
    await getStore().deleteSession(token);
    jar.delete(config.sessionCookie);
  }
}

/** Returns the logged-in customer or null. Use in server components / routes. */
export async function getCurrentCustomer(): Promise<Customer | null> {
  const jar = await cookies();
  const token = jar.get(config.sessionCookie)?.value;
  if (!token) return null;
  const session = await getStore().getSession(token);
  if (!session) return null;
  return getStore().getCustomer(session.customerId);
}

/** Throws-style helper for API routes: returns customer or null. */
export async function requireCustomer(): Promise<Customer | null> {
  return getCurrentCustomer();
}
