import { test } from "node:test";
import assert from "node:assert/strict";
import { SAMPLE_EXTRACTION, isExtractionResult } from "../../../apps/intake/models.js";
import {
  IntakeError,
  buildCandidate,
  fieldsNeedingReview,
  provenanceText,
  requestExtraction,
  resizedSize,
} from "../../../apps/intake/services.js";

process.env.TZ = "Asia/Tokyo";

const field = (value, confidence, evidence = null) => ({ value, confidence, evidence, sourceText: null });
const liveResult = (overrides = {}) => ({
  documentId: "doc-1",
  meta: { mode: "live", model: "claude-opus-5", extractedAt: "2026-09-21T07:40:00.000Z" },
  fields: {
    propertyName: field("テストハイツ高円寺 203号室", 0.96),
    rent: field(88000, 0.98),
    address: field("東京都杉並区高円寺南9-99-99", 0.93),
    station: field("JR中央線「高円寺」駅 徒歩6分", 0.9),
    layout: field("1K", 0.97),
    areaSqm: field(20.15, 0.95),
    constructionYear: field(1998, 0.95),
    ...overrides.fields,
  },
  warnings: overrides.warnings ?? [],
});

test("resizedSize matches the documented examples", () => {
  assert.deepEqual(resizedSize(1075, 1520, 1568, 1568), [924, 1307]); // standard tier A4 example
  assert.deepEqual(resizedSize(3840, 2160), [2576, 1449]); // high-resolution tier 4K example
  assert.deepEqual(resizedSize(2000, 1184), [2000, 1184]); // fixture already fits
  const [w, h] = resizedSize(2916, 1726); // a phone photo of a sheet
  assert.ok(Math.ceil(w / 28) * Math.ceil(h / 28) <= 4784 && w <= 2576);
  assert.deepEqual(resizedSize(1080, 4000).map((n) => n <= 2576), [true, true]); // portrait
});

test("review gate: low confidence, missing values, and warned fields need a person", () => {
  const result = liveResult({
    fields: { areaSqm: field(20.15, 0.72), station: field(null, null) },
    warnings: [{ code: "inconsistent_values", message: "", fields: ["layout"] }],
  });
  assert.deepEqual([...fieldsNeedingReview(result)].sort(), ["areaSqm", "layout", "station"]);
  assert.deepEqual([...fieldsNeedingReview(liveResult())], []);
  assert.deepEqual([...fieldsNeedingReview(SAMPLE_EXTRACTION)], []);
});

test("buildCandidate keeps unknown values unknown and records human edits", () => {
  const result = liveResult();
  const values = { ...Object.fromEntries(Object.entries(result.fields).map(([key, f]) => [key, f.value])), rent: null, layout: "1DK" };
  const candidate = buildCandidate(result, values, "2026-09-21T07:41:00.000Z");
  assert.equal(candidate.rent, null);
  assert.equal(candidate.enriched, false);
  assert.equal(candidate.area, "杉並区 / 1DK / 20.15㎡");
  assert.match(candidate.tradeoff, /^賃料が未取得のため/);
  assert.deepEqual(candidate.provenance.editedFields, ["rent", "layout"]);
  assert.equal(candidate.provenance.documentId, "doc-1");
  assert.deepEqual(candidate.tags, ["JR中央線「高円寺」駅 徒歩6分", "1998年竣工", "画像から抽出"]);
});

test("provenanceText states method, times, and edits", () => {
  const candidate = buildCandidate(liveResult(), { propertyName: "x", rent: 1, address: null, station: null, layout: null, areaSqm: null, constructionYear: null }, "2026-09-21T07:41:00.000Z");
  const text = provenanceText(candidate.provenance);
  assert.match(text, /Claude抽出（claude-opus-5）・人が確認/);
  assert.match(text, /抽出 9\/21 16:40・確認 9\/21 16:41/);
  assert.match(text, /人が修正: 物件・部屋名・月額賃料（円）/);
  const sample = buildCandidate(SAMPLE_EXTRACTION, Object.fromEntries(Object.entries(SAMPLE_EXTRACTION.fields).map(([key, f]) => [key, f.value])), "2026-09-21T07:41:00.000Z");
  assert.equal(provenanceText(sample.provenance), "募集図面画像 / サンプル値（画像は未解析）・人が確認 / 確認 9/21 16:41");
});

test("isExtractionResult checks the contract shape", () => {
  assert.equal(isExtractionResult(liveResult()), true);
  assert.equal(isExtractionResult(SAMPLE_EXTRACTION), true);
  assert.equal(isExtractionResult({ fields: {} }), false);
  assert.equal(isExtractionResult({ ...liveResult(), meta: { mode: "other" } }), false);
});

const respond = (status, body) => async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
const rejectsWith = (promise, pattern) => assert.rejects(promise, (error) => error instanceof IntakeError && pattern.test(error.message));

test("requestExtraction posts the image and returns a valid result", async () => {
  let sent;
  const fetchImpl = async (url, init) => {
    sent = { url, image: init.body.get("image") };
    return new Response(JSON.stringify(liveResult()));
  };
  const result = await requestExtraction("https://api.example/api/extract-listing", new Blob(["x"], { type: "image/png" }), "sheet.png", { fetchImpl });
  assert.equal(result.meta.mode, "live");
  assert.equal(sent.url, "https://api.example/api/extract-listing");
  assert.equal(sent.image.name, "sheet.png");
});

test("requestExtraction turns every failure into a message a person can act on", async () => {
  const blob = new Blob(["x"]);
  await rejectsWith(requestExtraction("u", blob, "a", { fetchImpl: respond(429, { error: { code: "rate_limited", message: "1分ほど待って" } }) }), /1分ほど待って/);
  await rejectsWith(requestExtraction("u", blob, "a", { fetchImpl: respond(502, "<html>bad gateway</html>") }), /HTTP 502/);
  await rejectsWith(requestExtraction("u", blob, "a", { fetchImpl: respond(200, { fields: {} }) }), /形式/);
  await rejectsWith(requestExtraction("u", blob, "a", { fetchImpl: async () => { throw new TypeError("fetch failed"); } }), /接続できませんでした/);
  const hang = (url, { signal }) => new Promise((resolve, reject) => signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
  await rejectsWith(requestExtraction("u", blob, "a", { fetchImpl: hang, timeoutMs: 20 }), /秒以内に終わりませんでした/);
});
