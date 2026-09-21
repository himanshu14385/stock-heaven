import { getSession, getSessionId } from "./session.js";

export async function getCurrentUser(request, env) {
  const sessionId = getSessionId(request);
  if (!sessionId) return null;
  const session = await getSession(env.LINKSAVER_PROJECTS, sessionId);
  if (!session?.userId) return null;
  const user = await env.DB.prepare(
    "SELECT id, username, role, active FROM users WHERE id = ?"
  ).bind(session.userId).first();
  if (!user || Number(user.active) !== 1) return null;
  return { id: user.id, username: user.username, role: user.role, active: true, sessionId: session.id };
}
