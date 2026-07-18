import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, verifyPassword } from "@/lib/auth";
import { getStore } from "@/lib/store";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { email, password } = parsed.data;
  const customer = await getStore().getCustomerByEmail(email);
  // Constant-ish response to avoid leaking which emails exist.
  if (!customer || !verifyPassword(password, customer.passwordHash)) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }
  if (customer.status !== "active") {
    return NextResponse.json({ error: "Account suspended. Contact Runook." }, { status: 403 });
  }
  await createSession(customer.id);
  return NextResponse.json({ ok: true });
}
