import { handleResponse } from "./core/response.js";
import { getCurrentUser } from "./core/auth.js";
import { NAVIGATION } from "./navigation.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/health") {
        let d1 = "ok";
        try { await env.DB.prepare("SELECT 1 AS ok").first(); } catch { d1 = "error"; }
        return handleResponse({
          ok: true,
          service: "hjlinksaver",
          d1,
          kv: Boolean(env.LINKSAVER_PROJECTS),
          b2: Boolean(env.B2_BUCKET && env.B2_ENDPOINT)
        });
      }
      if (url.pathname === "/api/session") {
        const user = await getCurrentUser(request, env);
        return handleResponse({ authenticated: Boolean(user), user: user ? {
          id: user.id, username: user.username, role: user.role
        } : null });
      }
      if (url.pathname === "/api/navigation") return handleResponse({ navigation: NAVIGATION });
      return env.ASSETS.fetch(request);
    } catch (error) {
      return handleResponse({ ok: false, error: error?.message || "Server error" }, 500);
    }
  }
};
