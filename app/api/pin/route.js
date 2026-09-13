import { NextResponse } from "next/server";
import { ROLE_STAFF, getSession } from "@/lib/session";
import {
  clearFailedAttempts,
  collectUsedPins,
  getLockRemainingSeconds,
  readState,
  registerFailedAttempt,
  writeState,
} from "@/lib/db";
import { isValidPin, makePin, normalizeState } from "@/lib/model";
import { throttleKey } from "@/lib/throttle";

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

// Setting a PIN by hand, rather than taking the random one. Staff change their
// own and have to prove they know the current one; an owner sets one for
// anybody at their location. Either way the number is checked against every
// other location here, since that is the only place it can be.
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
    return NextResponse.json({ error: "A PIN is exactly five digits." }, { status: 400 });
  }

  return session.role === ROLE_STAFF
    ? changeOwnPin(request, session, pin, body?.currentPin)
    : setStaffPin(session, String(body?.staffId || ""), pin);
}

async function changeOwnPin(request, session, pin, currentPin) {
  // Two things are rate limited here: guessing the current PIN, and probing
  // which numbers are already taken somewhere. Both would otherwise be free
  // tries from inside a signed-in session. The counter is kept apart from the
  // login one so fumbling a PIN change doesn't lock the whole kiosk out of
  // signing in.
  const key = `pinchange:${throttleKey(request)}`;
  const lockedFor = await getLockRemainingSeconds(key);
  if (lockedFor > 0) {
    return NextResponse.json(
      { error: "Too many attempts", retryInSeconds: lockedFor },
      { status: 429 }
    );
  }

  const stored = await readState(session.tenantId);
  if (!stored) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const state = normalizeState(stored);
  const me = state.settings.staff.find((s) => s.id === session.staffId);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isValidPin(currentPin) || currentPin !== me.pin) {
    return retryable(await registerFailedAttempt(key), "That isn't your current PIN.");
  }

  const taken = await isPinTaken(pin, me.pin);
  if (taken) {
    return retryable(await registerFailedAttempt(key), "That PIN is already in use. Pick another.", 409);
  }

  await writeState(session.tenantId, withPin(state, session.staffId, pin));
  await clearFailedAttempts(key);
  return NextResponse.json({ ok: true });
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

function withPin(state, staffId, pin) {
  return {
    ...state,
    settings: {
      ...state.settings,
      staff: state.settings.staff.map((s) => (s.id === staffId ? { ...s, pin } : s)),
    },
  };
}

function retryable(lockedSeconds, error, status = 401) {
  return lockedSeconds
    ? NextResponse.json({ error: "Too many attempts", retryInSeconds: lockedSeconds }, { status: 429 })
    : NextResponse.json({ error }, { status });
}
