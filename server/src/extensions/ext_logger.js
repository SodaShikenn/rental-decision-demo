// One structured JSON log line per request (visible in `wrangler tail` and Workers observability).
// Callers add fields with log.set(); never pass image bytes or extracted values.

export function initApp(app) {
  app.extensions.logger = {
    startRequest(fields = {}) {
      const started = Date.now();
      const entry = { event: "request", ...fields };
      return {
        set: (more) => Object.assign(entry, more),
        write: (status) => console.log(JSON.stringify({ ...entry, status, ms: Date.now() - started })),
      };
    },
  };
}
