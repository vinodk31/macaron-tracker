// Single point of contact for persistence. Nothing else in the app should
// touch localStorage (or, later, the network) directly.
//
// Swap the localStorage implementation below for the commented fetch-based
// version to move persistence to a real backend (e.g. Postgres via an
// /api/state route) without touching any UI code.

const STORAGE_KEY = "macaron-tracker:state";

export async function load() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function save(data) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// --- Postgres-backed version (swap in when ready) -------------------------
//
// export async function load() {
//   const res = await fetch("/api/state");
//   if (!res.ok) return null;
//   return res.json();
// }
//
// export async function save(data) {
//   await fetch("/api/state", {
//     method: "PUT",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify(data),
//   });
// }
