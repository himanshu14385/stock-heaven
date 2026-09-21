const PREFIX = "hjls:session:";
const COOKIE = "hjls_session";
const TTL = 60 * 60 * 24 * 7;

export async function createSession(kv, user, ttlSeconds = TTL) {
  if (!kv) throw new Error("Session KV binding is not available");
  const id = crypto.randomUUID();
  const session = { id, userId: String(user.id), role: user.role || "user", createdAt: new Date().toISOString() };
  await kv.put(`${PREFIX}${id}`, JSON.stringify(session), { expirationTtl: ttlSeconds });
  return session;
}
export async function getSession(kv, id) {
  if (!kv || !id) return null;
  return (await kv.get(`${PREFIX}${id}`, "json")) || null;
}
export async function deleteSession(kv, id) {
  if (kv && id) await kv.delete(`${PREFIX}${id}`);
}
export function getSessionId(request) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/(?:^|;\s*)hjls_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}
export function sessionCookie(id, maxAge = TTL) {
  return [`${COOKIE}=${encodeURIComponent(id)}`, "Path=/", "HttpOnly", "Secure", "SameSite=Lax", `Max-Age=${maxAge}`].join("; ");
}
export function clearSessionCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
