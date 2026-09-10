// Behind Vercel the client address arrives in x-forwarded-for. Falling back to
// a shared bucket means a spoofed header can't dodge the lockout entirely.
export function throttleKey(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "";
  return ip ? `ip:${ip}` : "shared";
}
