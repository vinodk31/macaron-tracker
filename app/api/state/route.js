import { NextResponse } from "next/server";
import { ROLE_STAFF, getSession } from "@/lib/session";
import { readState, writeState } from "@/lib/db";
import { normalizeState } from "@/lib/model";
import { mergeStaffChanges, scopeStateForStaff } from "@/lib/access";

export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function isCompleteState(value) {
  const settings = value.settings;
  return (
    settings !== null &&
    typeof settings === "object" &&
    !Array.isArray(settings) &&
    Array.isArray(settings.staff) &&
    Array.isArray(settings.flavors) &&
    value.days !== null &&
    typeof value.days === "object" &&
    !Array.isArray(value.days) &&
    Array.isArray(value.payments)
  );
}

export async function GET(request) {
  const session = getSession(request);
  if (!session) return unauthorized();
  // A franchisor who hasn't opened a location yet has no state to read.
  if (!session.tenantId) {
    return NextResponse.json({ data: null, role: session.role, tenantId: null });
  }

  const stored = await readState(session.tenantId);
  if (session.role !== ROLE_STAFF) {
    return NextResponse.json({ data: stored, role: session.role, tenantId: session.tenantId });
  }

  if (!stored) return unauthorized();
  const scoped = scopeStateForStaff(normalizeState(stored), session.staffId);
  if (!scoped) return unauthorized();
  return NextResponse.json({ data: scoped, role: session.role, tenantId: session.tenantId });
}

export async function PUT(request) {
  const session = getSession(request);
  if (!session || !session.tenantId) return unauthorized();

  let incoming;
  try {
    incoming = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
    return NextResponse.json({ error: "Expected a state object" }, { status: 400 });
  }

  if (session.role !== ROLE_STAFF) {
    // An owner write replaces the whole location, so a truncated or malformed
    // body would quietly erase their staff, flavors and history. Refuse
    // anything that isn't shaped like a full state.
    if (!isCompleteState(incoming)) {
      return NextResponse.json({ error: "Incomplete state object" }, { status: 400 });
    }
    await writeState(session.tenantId, incoming);
    return NextResponse.json({ ok: true });
  }

  const stored = await readState(session.tenantId);
  if (!stored) return unauthorized();
  const state = normalizeState(stored);
  if (!state.settings.staff.some((s) => s.id === session.staffId)) return unauthorized();

  await writeState(session.tenantId, mergeStaffChanges(state, incoming, session.staffId));
  return NextResponse.json({ ok: true });
}
