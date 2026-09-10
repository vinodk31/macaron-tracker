// Server-only session handling. The cookie carries the role, who it belongs to
// and an expiry, all signed with AUTH_SECRET, so none of it can be forged or
// replayed forever.

import { createHmac, timingSafeEqual } from "crypto";

export const COOKIE_NAME = "macaron_session";
// A shift's length rather than a month: the idle timeout ends most sessions
// long before this, so this is really the ceiling on a cookie that walked off
// on someone's phone.
export const MAX_AGE_SECONDS = 60 * 60 * 12;

export const ROLE_ADMIN = "admin";
export const ROLE_STAFF = "staff";

function sign(payload) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function equals(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function checkPassword(candidate) {
  const expected = process.env.APP_PASSWORD;
  if (!expected) throw new Error("APP_PASSWORD is not set");
  if (typeof candidate !== "string") return false;
  return equals(candidate, expected);
}

// Ids never contain a dot, so it is safe as a field separator.
export function createSessionToken({ role, staffId = "" }) {
  const payload = `${Date.now() + MAX_AGE_SECONDS * 1000}.${role}.${staffId}`;
  return `${payload}.${sign(payload)}`;
}

export function readSessionToken(token) {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [expiry, role, staffId, digest] = parts;
  const payload = `${expiry}.${role}.${staffId}`;
  if (!equals(digest, sign(payload))) return null;
  const expiresAt = Number(expiry);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
  if (role !== ROLE_ADMIN && role !== ROLE_STAFF) return null;
  if (role === ROLE_STAFF && !staffId) return null;
  return { role, staffId: staffId || null };
}

// The session behind a request, or null when there isn't a valid one.
export function getSession(request) {
  return readSessionToken(request.cookies.get(COOKIE_NAME)?.value);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  };
}

export function expiredCookieOptions() {
  return { ...sessionCookieOptions(), maxAge: 0 };
}
