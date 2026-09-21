// Central front-end settings (≈ config.py). Per-deployment values come from env.js (≈ .env),
// which sets window.RENTAL_DEMO_ENV before the modules load.
const env = globalThis.RENTAL_DEMO_ENV ?? {};

export const GOOGLE_MAPS_API_KEY = String(env.googleMapsApiKey || "");
export const EXTRACTION_API_URL = String(env.extractionApiUrl || "").trim().replace(/\/+$/, "");
export const EXTRACTION_ENDPOINT = EXTRACTION_API_URL ? `${EXTRACTION_API_URL}/api/extract-listing` : "";

// Shortlist. The budget is the monthly total: rent plus the management fee. `sortBy` orders the table
// (see SORTS), and `situations` are what the renter said about themselves (see SITUATIONS). The move-in
// estimate uses the brokerage fee in months of rent (before tax) and a move-in date (null: about a month ahead).
export const DEFAULT_PREFERENCES = { budget: 130000, priorities: ["walk", "space"], sortBy: "match", situations: [], brokerageMonths: 1, moveIn: null };
export const MAX_PRIORITIES = 2;

// Listing intake
// Confidence comes from the OCR engine and has not been calibrated. Below this threshold, or when a
// value is missing or named in a warning, a person must confirm the field explicitly.
export const REVIEW_CONFIDENCE_THRESHOLD = 0.85;
export const EXTRACTION_TIMEOUT_MS = 90_000;
export const UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
// Sheets are downsized to this long edge before upload: text stays legible for OCR, and uploads stay
// small. The server accepts up to 4096 px (server/config.py).
export const MAX_IMAGE_EDGE = 2560;
