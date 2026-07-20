import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyCredentials, createAdminSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const schema = z.object({ email: z.string(), password: z.string() });

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  if (!verifyCredentials(parsed.data.email, parsed.data.password)) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  await createAdminSession();
  return NextResponse.json({ ok: true });
}
