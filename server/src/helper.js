// Shared helpers used across apps (≈ helper.py).

/** An error that is safe to show to the client: HTTP status, stable code, and a Japanese message. */
export class AppError extends Error {
  constructor(status, code, message, headers = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}

export function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });
}

export function errorResponse(error) {
  return jsonResponse({ error: { code: error.code, message: error.message } }, error.status, error.headers);
}
