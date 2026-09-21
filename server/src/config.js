// Central settings (≈ config.py). Static defaults live here; per-deployment values come from
// the Worker environment: `vars` in wrangler.jsonc, secrets, and server/.dev.vars locally (≈ .env).

export const CURRENT_VERSION = "0.2.0";

// Claude model and request limits for listing extraction.
export const LLM_MODEL = "claude-opus-5";
export const LLM_BETAS = ["server-side-fallback-2026-07-01"];
export const LLM_MAX_TOKENS = 16000;
export const LLM_TIMEOUT_MS = 60_000;
export const LLM_MAX_RETRIES = 1;
export const EFFORT_LEVELS = ["low", "medium", "high", "xhigh", "max"];

// Upload limits. The image limits are Claude's high-resolution tier (Claude 4.7 and later):
// images inside them are not resized by the API, so returned pixel coordinates map 1:1.
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MULTIPART_OVERHEAD_BYTES = 64 * 1024;
export const MAX_IMAGE_EDGE = 2576;
export const MAX_VISUAL_TOKENS = 4784;

const splitList = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

/** Build the runtime configuration from the Worker environment. */
export function loadConfig(env = {}) {
  return {
    allowedOrigins: splitList(env.ALLOWED_ORIGINS),
    extraction: {
      // "mock" returns the fixture reading; anything else calls Claude.
      mode: env.EXTRACTION_MODE === "mock" ? "mock" : "live",
      // Kill switch: "false" stops extraction without a code change.
      enabled: env.EXTRACTION_ENABLED !== "false",
      effort: EFFORT_LEVELS.includes(env.EXTRACTION_EFFORT) ? env.EXTRACTION_EFFORT : "high",
    },
    anthropicApiKey: env.ANTHROPIC_API_KEY || "",
  };
}
