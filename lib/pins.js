// PINs are issued and checked by the server so they can be compared against
// every location, not just this one.
export async function issuePin() {
  const res = await fetch("/api/pin", { method: "POST" });
  if (!res.ok) throw new Error("Could not issue a PIN");
  const { pin } = await res.json();
  return pin;
}

// Set a chosen PIN. Staff send their current one; an owner sends the id of the
// person they are setting it for. Errors come back as text to show rather than
// thrown, since every one of them is something the person can fix.
export async function setPin(payload) {
  const res = await fetch("/api/pin", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (res.ok) return { ok: true, pin: body.pin };
  return {
    ok: false,
    error: body.retryInSeconds
      ? `Too many attempts. Try again in ${Math.ceil(body.retryInSeconds / 60)} min.`
      : body.error || "Could not change the PIN.",
  };
}
