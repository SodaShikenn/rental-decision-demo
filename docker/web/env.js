// Replaces web/env.js inside docker compose: the API is served on the same origin by the web proxy.
window.RENTAL_DEMO_ENV = {
  extractionApiUrl: window.location.origin,
};
