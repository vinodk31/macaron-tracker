import { NextResponse } from "next/server";
import { ROLE_STAFF, getSession } from "@/lib/session";
import { collectUsedPins, readState } from "@/lib/db";
import { PIN_LENGTH, isValidPin, makePin, normalizeState } from "@/lib/model";

export const dynamic = "force-dynamic";

// Staff sign in with a PIN alone, so one has to be unused across every
// location. Only the server can see all of them, which is why issuing a PIN
// lives here rather than in the owner's browser.
export async function POST(request) {
  const session = getSession(request);
  if (!session || session.role === ROLE_STAFF || !session.tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const used = await collectUsedPins();
  try {
    return NextResponse.json({ pin: makePin([...used].map((pin) => ({ pin }))) });
  } catch {
    return NextResponse.json({ error: "Could not issue a PIN" }, { status: 507 });
  }
}

// Setting a PIN by hand, rather than taking the random one the POST above
// suggests. Owners only, and the number is checked against every other
// location here, since that is the only place it can be.
export async function PUT(request) {
  const session = getSession(request);
  if (!session || !session.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const pin = body?.pin;
  if (!isValidPin(pin)) {
    return NextResponse.json(
      { error: `A PIN is exactly ${PIN_LENGTH} digits.` },
      { status: 400 }
    );
  }

  // Staff do not set PINs at all any more -- theirs is handed to them in
  // Setup, and a forgotten one is reset there too.
  if (session.role === ROLE_STAFF) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return setStaffPin(session, String(body?.staffId || ""), pin);
}

// The owner's browser holds the whole location and writes it back, so this
// checks the number and hands it over rather than writing it itself — two
// writers for one row is how edits get lost.
async function setStaffPin(session, staffId, pin) {
  const stored = await readState(session.tenantId);
  const state = stored ? normalizeState(stored) : null;
  const staff = state?.settings.staff.find((s) => s.id === staffId);
  if (!staff) return NextResponse.json({ error: "No such staff member" }, { status: 404 });

  if (await isPinTaken(pin, staff.pin)) {
    return NextResponse.json(
      { error: "That PIN is already in use. Pick another." },
      { status: 409 }
    );
  }
  return NextResponse.json({ ok: true, pin });
}

// `mine` is excluded so re-entering the PIN you already hold isn't a clash
// with yourself.
async function isPinTaken(pin, mine) {
  const used = await collectUsedPins();
  return pin !== mine && used.has(pin);
}
