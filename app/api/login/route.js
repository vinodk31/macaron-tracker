import { NextResponse } from "next/server";
import {
  ROLE_ADMIN,
  ROLE_STAFF,
  checkPassword,
  createSessionToken,
  sessionCookieOptions,
  COOKIE_NAME,
} from "@/lib/session";
import {
  clearFailedAttempts,
  getLockRemainingSeconds,
  readState,
  registerFailedAttempt,
} from "@/lib/db";
import { findStaffByPin, normalizeState } from "@/lib/model";

export const dynamic = "force-dynamic";

// Behind Vercel the client address arrives in x-forwarded-for. Falling back to
// a shared bucket means a spoofed header can't dodge the lockout entirely.
function throttleKey(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "";
  return ip ? `ip:${ip}` : "shared";
}

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
        : { error: body?.pin ? "That PIN wasn't recognised" : "Incorrect password" },
      { status: lockedSeconds ? 429 : 401 }
    );
  }

  await clearFailedAttempts(key);
  const response = NextResponse.json({ role: session.role });
  response.cookies.set(COOKIE_NAME, createSessionToken(session), sessionCookieOptions());
  return response;
}

async function authenticate(body) {
  if (typeof body?.pin === "string") {
    const state = normalizeState(await readState());
    const staff = findStaffByPin(state.settings.staff, body.pin);
    return staff ? { role: ROLE_STAFF, staffId: staff.id } : null;
  }
  if (typeof body?.password === "string" && checkPassword(body.password)) {
    return { role: ROLE_ADMIN };
  }
  return null;
}
