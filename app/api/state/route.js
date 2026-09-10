import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/session";
import { readState, writeState } from "@/lib/db";

export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(request) {
  if (!isAuthorized(request)) return unauthorized();
  const data = await readState();
  return NextResponse.json({ data });
}

export async function PUT(request) {
  if (!isAuthorized(request)) return unauthorized();

  let data;
  try {
    data = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return NextResponse.json({ error: "Expected a state object" }, { status: 400 });
  }

  await writeState(data);
  return NextResponse.json({ ok: true });
}
