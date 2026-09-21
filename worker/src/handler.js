import { validateImage, MAX_BYTES } from "./image.js";
import { extractListing, createClient, ExtractionError, MODEL } from "./extract.js";
import { toContract } from "./schema.js";
import { mockOutput, MOCK_MODEL } from "./mock.js";

export const ROUTE = "/api/extract-listing";
// Multipart framing adds a little on top of the image itself.
const MAX_REQUEST_BYTES = MAX_BYTES + 64 * 1024;

const allowedOrigins = (env) =>
  (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

function corsHeaders(origin, env) {
  if (!origin || !allowedOrigins(env).includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(body, status, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });
}

const errorBody = (code, message) => ({ error: { code, message } });

/**
 * Handle one request. `deps.createClient` is injectable so tests never reach the network.
 */
export async function handleRequest(request, env, deps = {}) {
  const started = Date.now();
  const url = new URL(request.url);
  const origin = request.headers.get("Origin");
  const cors = corsHeaders(origin, env);
  const log = { event: "extract_listing", status: 0, mode: env.EXTRACTION_MODE === "mock" ? "mock" : "live" };
  const respond = (body, status, extraHeaders = {}) => {
    log.status = status;
    log.ms = Date.now() - started;
    // Never log image bytes or extracted values.
    console.log(JSON.stringify(log));
    return json(body, status, { ...cors, ...extraHeaders });
  };

  if (url.pathname !== ROUTE) return respond(errorBody("not_found", "Not found"), 404);
  // Browsers always send Origin on cross-origin POSTs; non-browser clients are covered by the rate limit.
  if (origin && !cors["Access-Control-Allow-Origin"]) return respond(errorBody("origin_not_allowed", "このオリジンからの利用は許可されていません。"), 403);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return respond(errorBody("method_not_allowed", "POST で送信してください。"), 405, { Allow: "POST, OPTIONS" });
  if (env.EXTRACTION_ENABLED === "false") return respond(errorBody("disabled", "画像解析は現在停止しています。"), 503);

  if (env.EXTRACT_LIMITER) {
    const key = request.headers.get("CF-Connecting-IP") || "unknown";
    const { success } = await env.EXTRACT_LIMITER.limit({ key });
    if (!success) return respond(errorBody("rate_limited", "短時間に解析が集中しています。1分ほど待ってから再試行してください。"), 429, { "Retry-After": "60" });
  }

  const declaredLength = Number(request.headers.get("Content-Length") || 0);
  if (declaredLength > MAX_REQUEST_BYTES) return respond(errorBody("image_too_large", "画像は5MB以下にしてください。"), 413);

  let file;
  try {
    file = (await request.formData()).get("image");
  } catch {
    return respond(errorBody("invalid_form", "multipart/form-data の image フィールドで画像を送信してください。"), 400);
  }
  if (!file || typeof file === "string") return respond(errorBody("missing_image", "image フィールドに画像がありません。"), 400);
  if (file.size > MAX_BYTES) return respond(errorBody("image_too_large", "画像は5MB以下にしてください。"), 413);

  const checked = validateImage(new Uint8Array(await file.arrayBuffer()));
  if (!checked.ok) return respond(errorBody(checked.code, checked.message), checked.status);
  const { image } = checked;

  const documentId = crypto.randomUUID();
  const extractedAt = new Date().toISOString();
  log.documentId = documentId;

  if (log.mode === "mock") {
    return respond(toContract(mockOutput(image), { documentId, extractedAt, model: MOCK_MODEL, mode: "mock", image }), 200);
  }
  if (!env.ANTHROPIC_API_KEY) return respond(errorBody("not_configured", "解析サーバーにAPIキーが設定されていません。"), 503);

  try {
    const client = (deps.createClient ?? createClient)(env);
    const { output, model, usage } = await extractListing(image, env, client);
    log.usage = { input: usage?.input_tokens, output: usage?.output_tokens };
    return respond(toContract(output, { documentId, extractedAt, model: model || MODEL, mode: "live", image }), 200);
  } catch (error) {
    if (error instanceof ExtractionError) {
      log.error = error.code;
      return respond(errorBody(error.code, error.message), error.status);
    }
    log.error = "internal";
    return respond(errorBody("internal", "解析サーバーで予期しないエラーが発生しました。"), 500);
  }
}
