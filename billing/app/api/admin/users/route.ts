import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { buildRoster } from "@/lib/roster";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await isAdminRequest(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const roster = await buildRoster();
    return NextResponse.json({ roster });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
