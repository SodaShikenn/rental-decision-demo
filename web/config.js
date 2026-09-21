// Central front-end settings (≈ config.py). Per-deployment values come from env.js (≈ .env),
// which sets window.RENTAL_DEMO_ENV before the modules load.
const env = globalThis.RENTAL_DEMO_ENV ?? {};

export const GOOGLE_MAPS_API_KEY = String(env.googleMapsApiKey || "");
export const EXTRACTION_API_URL = String(env.extractionApiUrl || "").trim().replace(/\/+$/, "");
export const EXTRACTION_ENDPOINT = EXTRACTION_API_URL ? `${EXTRACTION_API_URL}/api/extract-listing` : "";

// Shortlist
export const DEFAULT_PREFERENCES = { budget: 130000, priorities: ["commute", "late"], weekend: true };
export const MAX_PRIORITIES = 2;

// Listing intake
// Confidence is reported by the model and has not been calibrated. Below this threshold,
// or when a value is missing or named in a warning, a person must confirm the field explicitly.
export const REVIEW_CONFIDENCE_THRESHOLD = 0.85;
export const EXTRACTION_TIMEOUT_MS = 90_000;
export const UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
// claude-opus-5 is on the high-resolution tier. Images within these limits are not resized by the API,
// so the pixel boxes it returns map 1:1 onto the uploaded image. Keep in sync with server/src/config.js.
export const MAX_IMAGE_EDGE = 2576;
export const MAX_VISUAL_TOKENS = 4784;
