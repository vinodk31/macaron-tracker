// Single point of contact for persistence. Nothing else in the app should
// talk to the network (or, previously, localStorage) directly.
//
// State lives in Postgres behind /api/state. The UI is unchanged: it still
// just calls load() and save().

const LEGACY_KEY = "macaron-tracker:state";

export class UnauthorizedError extends Error {
  constructor() {
    super("Not signed in");
    this.name = "UnauthorizedError";
  }
}

export async function load() {
  const res = await fetch("/api/state", { cache: "no-store" });
  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) throw new Error(`Could not load data (${res.status})`);

  const { data } = await res.json();
  if (data) return data;

  // First run against the database: adopt whatever this device had stored
  // locally before the migration rather than starting from scratch.
  const legacy = readLegacyState();
  if (legacy) {
    await save(legacy);
    return legacy;
  }
  return null;
}

export async function save(data) {
  const res = await fetch("/api/state", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) throw new Error(`Could not save data (${res.status})`);
}

function readLegacyState() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LEGACY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
