import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { buildRoster } from "@/lib/roster";

export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || req.headers.get("x-admin-token");
  return !!config.adminToken && token === config.adminToken;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const roster = await buildRoster();
    return NextResponse.json({ roster });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
