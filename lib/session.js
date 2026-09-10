// Server-only session handling. The cookie carries an expiry signed with
// AUTH_SECRET, so it can't be forged without the secret and it can't be
// replayed forever.

import { createHmac, timingSafeEqual } from "crypto";

export const COOKIE_NAME = "macaron_session";
export const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

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

export function createSessionToken() {
  const payload = String(Date.now() + MAX_AGE_SECONDS * 1000);
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token) {
  if (typeof token !== "string") return false;
  const [payload, digest] = token.split(".");
  if (!payload || !digest) return false;
  if (!equals(digest, sign(payload))) return false;
  const expiresAt = Number(payload);
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

export function isAuthorized(request) {
  return verifySessionToken(request.cookies.get(COOKIE_NAME)?.value);
}
