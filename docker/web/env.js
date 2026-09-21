// Replaces web/env.js inside docker compose: the API is served on the same origin by nginx.
window.RENTAL_DEMO_ENV = {
  googleMapsApiKey: "",
  extractionApiUrl: window.location.origin,
};
