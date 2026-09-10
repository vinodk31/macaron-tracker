import { NextResponse } from "next/server";
import {
  clearFailedAttempts,
  createTenantWithOwner,
  getLockRemainingSeconds,
  registerFailedAttempt,
  writeState,
} from "@/lib/db";
import { hashPassword } from "@/lib/passwords";
import { COOKIE_NAME, ROLE_ADMIN, createSessionToken, sessionCookieOptions } from "@/lib/session";
import { defaultState, makeId } from "@/lib/model";
import { throttleKey } from "@/lib/throttle";

export const dynamic = "force-dynamic";

const MIN_PASSWORD_LENGTH = 8;

export async function POST(request) {
  const inviteCode = process.env.INVITE_CODE;
  if (!inviteCode) {
    return NextResponse.json({ error: "Registration is closed" }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Guessing the invite code is a credential attack like any other.
  const key = `register:${throttleKey(request)}`;
  const lockedFor = await getLockRemainingSeconds(key);
  if (lockedFor > 0) {
    return NextResponse.json(
      { error: "Too many attempts", retryInSeconds: lockedFor },
      { status: 429 }
    );
  }

  if (body?.inviteCode !== inviteCode) {
    const lockedSeconds = await registerFailedAttempt(key);
    return NextResponse.json(
      lockedSeconds
        ? { error: "Too many attempts", retryInSeconds: lockedSeconds }
        : { error: "That invite code isn't valid" },
      { status: lockedSeconds ? 429 : 401 }
    );
  }
  await clearFailedAttempts(key);

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!name) return NextResponse.json({ error: "Location name is required" }, { status: 400 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
      { status: 400 }
    );
  }

  const tenantId = makeId("loc");
  const ownerId = makeId("owner");
  const result = await createTenantWithOwner({
    tenantId,
    name,
    ownerId,
    email,
    passwordHash: await hashPassword(password),
  });
  if (result.error === "taken") {
    return NextResponse.json({ error: "That email is already registered" }, { status: 409 });
  }

  // Give the new location something to work with rather than an empty app.
  // PINs are issued from Setup, where uniqueness across locations is checked.
  const seed = defaultState();
  seed.settings.shopName = name;
  seed.settings.staff = [];
  await writeState(tenantId, seed);

  const response = NextResponse.json({ role: ROLE_ADMIN });
  response.cookies.set(
    COOKIE_NAME,
    createSessionToken({ role: ROLE_ADMIN, tenantId }),
    sessionCookieOptions()
  );
  return response;
}
