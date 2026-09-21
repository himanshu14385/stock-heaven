export function handleResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers }
  });
}
export function htmlResponse(html, status = 200, headers = {}) {
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", ...headers } });
}
export function errorResponse(message = "Server error", status = 500) {
  return handleResponse({ ok: false, error: message }, status);
}
