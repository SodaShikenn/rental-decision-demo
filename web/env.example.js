// Example of web/env.js. Values here are published with the site, so never put secrets in them.
window.RENTAL_DEMO_ENV = {
  // Google Maps JavaScript API key restricted by HTTP referrer and API scope.
  googleMapsApiKey: "",
  // Extraction server base URL, e.g. "https://rental-helper-api.example.com", or "http://localhost:8000" while
  // running `npm run dev:server`. Blank shows only the sample sheet's recorded reading. (docker compose supplies its own env.js.)
  extractionApiUrl: "",
};
