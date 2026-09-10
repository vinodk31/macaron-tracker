// Client-side auth calls. Separate from storage.js, which stays purely about
// reading and writing app state.

export async function login(credentials) {
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, ...body };
}

export async function logout() {
  await fetch("/api/logout", { method: "POST" }).catch(() => {});
}
