// PINs are issued by the server so they can be checked against every
// location, not just this one.
export async function issuePin() {
  const res = await fetch("/api/pin", { method: "POST" });
  if (!res.ok) throw new Error("Could not issue a PIN");
  const { pin } = await res.json();
  return pin;
}
