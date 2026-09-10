import { NextResponse } from "next/server";
import { ROLE_STAFF, getSession } from "@/lib/session";
import { collectUsedPins } from "@/lib/db";
import { makePin } from "@/lib/model";

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
