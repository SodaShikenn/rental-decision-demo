// Per-deployment settings for the browser (≈ .env). This file is published with the site,
// so it must never contain secrets: only the public API URL.
window.RENTAL_DEMO_ENV = {
  // Public API base URL. Blank: recorded comparison/local tools work; live services are unavailable.
  extractionApiUrl: ["localhost", "127.0.0.1"].includes(window.location.hostname) ? "http://127.0.0.1:8000" : "",
};
