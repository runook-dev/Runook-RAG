/**
 * Staff admin authentication for the back-office. Email + password (from env)
 * -> signed, httpOnly session cookie. Replaces the token-in-URL approach.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { config } from "./config";

const COOKIE = "runook_admin";
const TTL_MS = 12 * 60 * 60 * 1000; // 12h

function sign(payload: string): string {
  return createHmac("sha256", config.adminSessionSecret).update(payload).digest("hex");
}

export function verifyCredentials(email: string, password: string): boolean {
  if (!config.adminEmail || !config.adminPassword) return false;
  const okEmail = email.trim().toLowerCase() === config.adminEmail;
  const a = Buffer.from(password);
  const b = Buffer.from(config.adminPassword);
  const okPass = a.length === b.length && timingSafeEqual(a, b);
  return okEmail && okPass;
}

export async function createAdminSession(): Promise<void> {
  const exp = Date.now() + TTL_MS;
  const payload = `${config.adminEmail}.${exp}`;
  const token = `${payload}.${sign(payload)}`;
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(exp),
  });
}

export async function destroyAdminSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return false;
  const idx = token.lastIndexOf(".");
  if (idx < 0) return false;
  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  if (sign(payload) !== sig) return false;
  const exp = Number(payload.split(".").pop());
  return Number.isFinite(exp) && exp > Date.now();
}

/** API auth: cookie session OR the shared token (for scripts). */
export async function isAdminRequest(req: Request): Promise<boolean> {
  if (await isAdmin()) return true;
  const t = req.headers.get("x-admin-token");
  return !!config.adminToken && t === config.adminToken;
}
