import { NextResponse } from "next/server";
import { ROLE_ADMIN, getSession } from "@/lib/session";
import { readState, writeState } from "@/lib/db";
import { normalizeState } from "@/lib/model";
import { mergeStaffChanges, scopeStateForStaff } from "@/lib/access";

export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(request) {
  const session = getSession(request);
  if (!session) return unauthorized();

  const stored = await readState();
  if (session.role === ROLE_ADMIN) {
    return NextResponse.json({ data: stored, role: session.role });
  }

  // A staff session before any state exists has nothing to scope to.
  if (!stored) return unauthorized();
  const scoped = scopeStateForStaff(normalizeState(stored), session.staffId);
  if (!scoped) return unauthorized();
  return NextResponse.json({ data: scoped, role: session.role });
}

export async function PUT(request) {
  const session = getSession(request);
  if (!session) return unauthorized();

  let incoming;
  try {
    incoming = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
    return NextResponse.json({ error: "Expected a state object" }, { status: 400 });
  }

  if (session.role === ROLE_ADMIN) {
    await writeState(incoming);
    return NextResponse.json({ ok: true });
  }

  const stored = await readState();
  if (!stored) return unauthorized();
  const state = normalizeState(stored);
  if (!state.settings.staff.some((s) => s.id === session.staffId)) return unauthorized();

  await writeState(mergeStaffChanges(state, incoming, session.staffId));
  return NextResponse.json({ ok: true });
}
