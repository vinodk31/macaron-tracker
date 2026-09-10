import { NextResponse } from "next/server";
import {
  ROLE_ADMIN,
  ROLE_FRANCHISOR,
  ROLE_STAFF,
  createSessionToken,
  sessionCookieOptions,
  COOKIE_NAME,
} from "@/lib/session";
import {
  clearFailedAttempts,
  findOwnerByEmail,
  findTenantsWithPin,
  getLockRemainingSeconds,
  registerFailedAttempt,
} from "@/lib/db";
import { verifyPassword } from "@/lib/passwords";
import { findStaffByPin, normalizeState } from "@/lib/model";
import { throttleKey } from "@/lib/throttle";

export const dynamic = "force-dynamic";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const key = throttleKey(request);
  const lockedFor = await getLockRemainingSeconds(key);
  if (lockedFor > 0) {
    return NextResponse.json(
      { error: "Too many attempts", retryInSeconds: lockedFor },
      { status: 429 }
    );
  }

  const session = await authenticate(body);
  if (!session) {
    const lockedSeconds = await registerFailedAttempt(key);
    return NextResponse.json(
      lockedSeconds
        ? { error: "Too many attempts", retryInSeconds: lockedSeconds }
        : { error: body?.pin ? "That PIN wasn't recognised" : "Email or password is incorrect" },
      { status: lockedSeconds ? 429 : 401 }
    );
  }

  await clearFailedAttempts(key);
  const response = NextResponse.json({ role: session.role });
  response.cookies.set(COOKIE_NAME, createSessionToken(session), sessionCookieOptions());
  return response;
}

async function authenticate(body) {
  if (typeof body?.pin === "string") return authenticateStaff(body.pin);
  if (typeof body?.email === "string" && typeof body?.password === "string") {
    return authenticateOwner(body.email, body.password);
  }
  return null;
}

// Staff sign in with a PIN alone, so it has to identify the location too.
// Uniqueness is enforced when PINs are issued; if two locations somehow hold
// the same one, refuse rather than guess which person is signing in.
async function authenticateStaff(pin) {
  if (!/^\d{5}$/.test(pin)) return null;

  const matches = await findTenantsWithPin(pin);
  if (matches.length !== 1) return null;

  const { id: tenantId, data } = matches[0];
  const staff = findStaffByPin(normalizeState(data).settings.staff, pin);
  return staff ? { role: ROLE_STAFF, tenantId, staffId: staff.id } : null;
}

async function authenticateOwner(email, password) {
  const owner = await findOwnerByEmail(email.trim().toLowerCase());
  if (!owner) return null;
  if (!(await verifyPassword(password, owner.password_hash))) return null;

  if (owner.role === "franchisor") {
    // No location until they pick one from the locations list.
    return { role: ROLE_FRANCHISOR, tenantId: "" };
  }
  return owner.tenant_id ? { role: ROLE_ADMIN, tenantId: owner.tenant_id } : null;
}
