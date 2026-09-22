import test from "node:test";
import assert from "node:assert/strict";
import {
  publicApiUrl,
  publicConfigSource,
  verifyApiConfiguration,
} from "../../../scripts/configure-pages.mjs";
const origin = "https://sodashikenn.github.io";
const configured = {
  mode: "live",
  enabled: true,
  configured: true,
  maps: { configured: true },
  research: { enabled: true, configured: true },
  sharing: { enabled: true },
};
function response(body, headers = {}) {
  return new Response(JSON.stringify(body), {
    headers: { "access-control-allow-origin": origin, ...headers },
  });
}
test("Public deployment rejects local/insecure URLs and embedded credentials", () => {
  for (const url of [
    "",
    "http://api.example.com",
    "https://localhost",
    "https://127.0.0.1",
    "https://[::1]",
    "https://user:secret@api.example.com",
    "https://api.example.com?key=secret",
    "https://api.example.com/#token",
  ])
    assert.throws(() => publicApiUrl(url));
  assert.equal(
    publicApiUrl("https://api.example.com/backend/"),
    "https://api.example.com/backend",
  );
  assert.match(
    publicConfigSource("https://api.example.com"),
    /"extractionApiUrl":"https:\/\/api.example.com"/,
  );
});
test("Deployment validates live configuration and browser preflight without provider calls", async () => {
  const requests = [];
  await verifyApiConfiguration(
    "https://api.example.com",
    origin,
    async (url, options) => {
      requests.push({ url, options });
      return response(configured, {
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-allow-headers": "Content-Type",
      });
    },
  );
  assert.deepEqual(
    requests.map((r) => [r.url, r.options.method || "GET"]),
    [
      ["https://api.example.com/healthz", "GET"],
      ["https://api.example.com/api/reviews/web", "OPTIONS"],
    ],
  );
});
test("Mock mode, missing Maps and rejected origins cannot pass release configuration checks", async () => {
  for (const state of [
    { ...configured, mode: "mock" },
    { ...configured, maps: { configured: false } },
    { ...configured, research: { enabled: false, configured: true } },
    { ...configured, sharing: { enabled: false } },
  ])
    await assert.rejects(
      verifyApiConfiguration("https://api.example.com", origin, async () =>
        response(state),
      ),
    );
  await assert.rejects(
    verifyApiConfiguration("https://api.example.com", origin, async () =>
      response(configured, {
        "access-control-allow-origin": "https://elsewhere.example",
      }),
    ),
  );
  await assert.rejects(
    verifyApiConfiguration("https://api.example.com", origin, async () =>
      response(configured),
    ),
  );
});
