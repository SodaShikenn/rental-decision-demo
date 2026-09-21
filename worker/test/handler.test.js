import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { handleRequest, ROUTE } from "../src/handler.js";
import { mockOutput } from "../src/mock.js";

const fixture = await readFile(new URL("./fixtures/listing-sheet.png", import.meta.url));
const ORIGIN = "http://localhost:4173";
const baseEnv = { ALLOWED_ORIGINS: `https://sodashikenn.github.io,${ORIGIN}`, EXTRACTION_MODE: "mock", EXTRACTION_ENABLED: "true" };

beforeEach((t) => t.mock.method(console, "log", () => {}));

function upload(bytes = fixture, { origin = ORIGIN, type = "image/png", field = "image" } = {}) {
  const form = new FormData();
  form.append(field, new Blob([bytes], { type }), "sheet.png");
  const headers = origin ? { Origin: origin } : {};
  return new Request(`https://worker.example${ROUTE}`, { method: "POST", body: form, headers });
}

const errorCode = async (response) => (await response.json()).error.code;

test("mock mode returns the contract with CORS for an allowed origin", async () => {
  const response = await handleRequest(upload(), baseEnv);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  const body = await response.json();
  assert.equal(body.meta.mode, "mock");
  assert.match(body.documentId, /^[0-9a-f-]{36}$/);
  assert.equal(body.fields.rent.value, 88000);
  assert.equal(body.fields.rent.evidence.length, 4);
  assert.equal(body.warnings[0].code, "inconsistent_values");
});

test("requests without an Origin header (curl, smoke script) are allowed without CORS headers", async () => {
  const response = await handleRequest(upload(fixture, { origin: null }), baseEnv);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), null);
});

test("preflight and routing", async () => {
  const preflight = await handleRequest(new Request(`https://worker.example${ROUTE}`, { method: "OPTIONS", headers: { Origin: ORIGIN } }), baseEnv);
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("Access-Control-Allow-Methods"), "POST, OPTIONS");
  assert.equal((await handleRequest(new Request("https://worker.example/"), baseEnv)).status, 404);
  const get = await handleRequest(new Request(`https://worker.example${ROUTE}`, { headers: { Origin: ORIGIN } }), baseEnv);
  assert.equal(get.status, 405);
});

test("rejects origins that are not on the allowlist", async () => {
  const response = await handleRequest(upload(fixture, { origin: "https://evil.example" }), baseEnv);
  assert.equal(response.status, 403);
  assert.equal(await errorCode(response), "origin_not_allowed");
});

test("kill switch and rate limit stop requests before the image is read", async () => {
  const disabled = await handleRequest(upload(), { ...baseEnv, EXTRACTION_ENABLED: "false" });
  assert.equal(disabled.status, 503);
  const keys = [];
  const limiter = { limit: async ({ key }) => (keys.push(key), { success: false }) };
  const limitedRequest = upload();
  limitedRequest.headers.set("CF-Connecting-IP", "203.0.113.7");
  const limited = await handleRequest(limitedRequest, { ...baseEnv, EXTRACT_LIMITER: limiter });
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("Retry-After"), "60");
  assert.deepEqual(keys, ["203.0.113.7"]);
});

test("validates the upload", async () => {
  const missing = await handleRequest(upload(fixture, { field: "file" }), baseEnv);
  assert.deepEqual([missing.status, await errorCode(missing)], [400, "missing_image"]);
  const text = await handleRequest(upload(new TextEncoder().encode("not an image"), { type: "image/png" }), baseEnv);
  assert.deepEqual([text.status, await errorCode(text)], [415, "unsupported_image"]);
  const big = await handleRequest(upload(new Uint8Array(5 * 1024 * 1024 + 1)), baseEnv);
  assert.deepEqual([big.status, await errorCode(big)], [413, "image_too_large"]);
  const notMultipart = await handleRequest(new Request(`https://worker.example${ROUTE}`, { method: "POST", body: "x", headers: { Origin: ORIGIN, "Content-Type": "text/plain" } }), baseEnv);
  assert.deepEqual([notMultipart.status, await errorCode(notMultipart)], [400, "invalid_form"]);
});

test("live mode requires an API key", async () => {
  const response = await handleRequest(upload(), { ...baseEnv, EXTRACTION_MODE: "live" });
  assert.deepEqual([response.status, await errorCode(response)], [503, "not_configured"]);
});

test("live mode returns the contract built from Claude's output", async () => {
  const createClient = () => ({
    beta: {
      messages: {
        create: async () => ({
          model: "claude-opus-5",
          stop_reason: "end_turn",
          usage: { input_tokens: 3200, output_tokens: 900 },
          content: [{ type: "text", text: JSON.stringify(mockOutput({ width: 2000, height: 1184 })) }],
        }),
      },
    },
  });
  const response = await handleRequest(upload(), { ...baseEnv, EXTRACTION_MODE: "live", ANTHROPIC_API_KEY: "test" }, { createClient });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.meta.mode, "live");
  assert.equal(body.meta.model, "claude-opus-5");
  assert.equal(body.fields.areaSqm.value, 20.15);
});

test("live mode surfaces extraction errors with their status", async () => {
  const createClient = () => ({ beta: { messages: { create: async () => ({ stop_reason: "refusal", content: [] }) } } });
  const response = await handleRequest(upload(), { ...baseEnv, EXTRACTION_MODE: "live", ANTHROPIC_API_KEY: "test" }, { createClient });
  assert.deepEqual([response.status, await errorCode(response)], [502, "refused"]);
});
