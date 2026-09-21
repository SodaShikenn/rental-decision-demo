// Listing-sheet extraction app (≈ a Flask blueprint): its routes plus hooks that run before them.
import { AppError } from "../../helper.js";
import { extractListing } from "./views.js";

function ensureEnabled(request, app) {
  if (!app.config.extraction.enabled) throw new AppError(503, "disabled", "画像解析は現在停止しています。");
}

async function applyRateLimit(request, app) {
  const key = request.headers.get("CF-Connecting-IP") || "unknown";
  if (!(await app.extensions.rateLimit.allow(key))) {
    throw new AppError(429, "rate_limited", "短時間に解析が集中しています。1分ほど待ってから再試行してください。", { "Retry-After": "60" });
  }
}

export const bp = {
  name: "listing",
  prefix: "/api",
  beforeRequest: [ensureEnabled, applyRateLimit],
  routes: [{ method: "POST", path: "/extract-listing", view: extractListing }],
};
