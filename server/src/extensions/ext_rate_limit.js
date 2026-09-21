// Per-client request limit backed by the EXTRACT_LIMITER binding declared in wrangler.jsonc.
// Without the binding (unit tests) every request is allowed.

export function initApp(app) {
  const binding = app.env.EXTRACT_LIMITER;
  app.extensions.rateLimit = {
    async allow(key) {
      if (!binding) return true;
      const { success } = await binding.limit({ key });
      return success;
    },
  };
}
