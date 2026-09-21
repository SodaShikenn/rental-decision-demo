// Per-deployment settings for the browser (≈ .env). This file is published with the site,
// so it must never contain secrets: only a referrer-restricted Maps key and the public API URL.
window.RENTAL_DEMO_ENV = {
  googleMapsApiKey: "",
  // Base URL of the extraction server (server/). Blank: only the sample sheet's recorded reading is shown.
  extractionApiUrl: "",
};
