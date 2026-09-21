// CORS for the browser front end. Only allowlisted origins (ALLOWED_ORIGINS) receive CORS headers.

export function initApp(app) {
  const allowed = new Set(app.config.allowedOrigins);
  app.extensions.cors = {
    isAllowed: (origin) => allowed.has(origin),
    headersFor(origin) {
      if (!origin || !allowed.has(origin)) return {};
      return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
        Vary: "Origin",
      };
    },
  };
}
