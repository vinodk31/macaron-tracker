import { NextResponse } from "next/server";
import {
  COOKIE_NAME,
  ROLE_FRANCHISOR,
  createSessionToken,
  getSession,
  sessionCookieOptions,
} from "@/lib/session";
import { readAllStates, tenantExists } from "@/lib/db";
import { endOfMonth, startOfMonth, todayKey } from "@/lib/dates";
import { monthlyCogs, normalizeState, totalOutstanding } from "@/lib/model";

export const dynamic = "force-dynamic";

function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// A roll-up across every location, for the franchisor only.
export async function GET(request) {
  const session = getSession(request);
  if (!session || session.role !== ROLE_FRANCHISOR) return forbidden();

  const today = todayKey();
  const startKey = startOfMonth(today);
  const endKey = endOfMonth(today);

  const rows = await readAllStates();
  const locations = rows.map(({ id, name, data }) => {
    if (!data) {
      return { id, name, unitsSold: 0, wages: 0, cogs: 0, outstanding: 0, staffCount: 0 };
    }
    const state = normalizeState(data);
    const cogs = monthlyCogs(state.settings, state.days, state.payments, startKey, endKey);
    return {
      id,
      // Owners can rename their shop in Setup, so prefer what they call it now
      // over the name typed at registration.
      name: state.settings.shopName || name,
      unitsSold: cogs.unitsSold,
      wages: cogs.wages,
      cogs: cogs.total,
      outstanding: totalOutstanding(state.settings, state.days, state.payments, today),
      staffCount: state.settings.staff.length,
    };
  });

  return NextResponse.json({ locations, month: startKey });
}

// Opening a location re-issues the cookie with that tenant in the signed
// payload, so the browser never gets to name the location it wants.
export async function POST(request) {
  const session = getSession(request);
  if (!session || session.role !== ROLE_FRANCHISOR) return forbidden();

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const tenantId = typeof body?.tenantId === "string" ? body.tenantId : "";
  if (tenantId && !(await tenantExists(tenantId))) {
    return NextResponse.json({ error: "No such location" }, { status: 404 });
  }

  const response = NextResponse.json({ ok: true, tenantId: tenantId || null });
  response.cookies.set(
    COOKIE_NAME,
    createSessionToken({ role: ROLE_FRANCHISOR, tenantId }),
    sessionCookieOptions()
  );
  return response;
}
