import { test } from "node:test";
import assert from "node:assert/strict";
import { SHEETS } from "../../../data/sheets.js";
import { SAMPLE_SHEET, isExtractionResult } from "../../../apps/intake/models.js";
import {
  IntakeError,
  buildCandidate,
  candidateFromSheet,
  districtFromAddress,
  extractionNote,
  fieldsNeedingReview,
  provenanceText,
  requestExtraction,
  resizedSize,
} from "../../../apps/intake/services.js";

process.env.TZ = "Asia/Tokyo";

const field = (value, confidence, evidence = null) => ({ value, confidence, evidence, sourceText: null });
const liveResult = (overrides = {}) => ({
  documentId: "doc-1",
  meta: { mode: "live", model: "gemini-3.8-flash", ocr: "Docling + RapidOCR (PP-OCRv6)", extractedAt: "2026-09-21T07:40:00.000Z" },
  fields: {
    propertyName: field("テストハイツ高円寺 203号室", 0.96),
    rent: field(88000, 0.98),
    managementFee: field(5000, 0.97),
    address: field("東京都杉並区高円寺南9-99-99", 0.93),
    station: field("JR中央線「高円寺」駅 徒歩6分", 0.9),
    layout: field("1K", 0.97),
    areaSqm: field(20.15, 0.95),
    constructionYear: field(1998, 0.95),
    ...overrides.fields,
  },
  warnings: overrides.warnings ?? [],
});
const valuesOf = (result) => Object.fromEntries(Object.entries(result.fields).map(([key, f]) => [key, f.value]));

test("resizedSize caps the long edge and never upscales", () => {
  assert.deepEqual(resizedSize(2000, 1184), [2000, 1184]); // fixture already fits
  assert.deepEqual(resizedSize(2916, 1726), [2560, 1515]); // the original of the sample sheet
  assert.deepEqual(resizedSize(1080, 4000), [691, 2560]); // portrait
  assert.deepEqual(resizedSize(4000, 3000, 1000), [1000, 750]);
});

test("review gate: low confidence, missing values, and warned fields need a person", () => {
  const result = liveResult({
    fields: { areaSqm: field(20.15, 0.72), station: field(null, null) },
    warnings: [{ code: "inconsistent_values", message: "", fields: ["layout"] }],
  });
  assert.deepEqual([...fieldsNeedingReview(result)].sort(), ["areaSqm", "layout", "station"]);
  assert.deepEqual([...fieldsNeedingReview(liveResult())], []);
});

test("recorded readings are gated like live ones", () => {
  // The sample sheet prints two different areas; everything else was read with high confidence.
  assert.deepEqual([...fieldsNeedingReview(SAMPLE_SHEET.reading)], ["areaSqm"]);
  const granpaseo = SHEETS.find((sheet) => sheet.id === "granpaseo-4");
  // No rent on the flyer, several unit types, and a name OCR read differently (Ⅳ → V).
  assert.deepEqual([...fieldsNeedingReview(granpaseo.reading)].sort(), ["areaSqm", "layout", "managementFee", "propertyName", "rent"]);
});

test("buildCandidate keeps unknown values unknown, a zero fee as zero, and records edits", () => {
  const result = liveResult();
  const values = { ...valuesOf(result), rent: null, managementFee: 0, layout: "1DK" };
  const candidate = buildCandidate(result, values, "2026-09-21T07:41:00.000Z");
  assert.equal(candidate.id, "uploaded-listing");
  assert.deepEqual([candidate.rent, candidate.managementFee], [null, 0]);
  assert.deepEqual([candidate.district, candidate.layout, candidate.areaSqm, candidate.constructionYear], ["杉並区", "1DK", 20.15, 1998]);
  assert.deepEqual(candidate.provenance.editedFields, ["rent", "managementFee", "layout"]);
  assert.equal(candidate.provenance.documentId, "doc-1");
  assert.equal(candidate.sheet, null);
});

test("candidates from recorded sheets keep their image, evidence, and the sheet's own warnings", () => {
  const monohouse = candidateFromSheet(SAMPLE_SHEET);
  assert.equal(monohouse.id, "monohouse");
  assert.deepEqual(monohouse.costs.slice(0, 3).map((cost) => [cost.kind, cost.amount]), [["deposit", 1], ["amortization", 1], ["keyMoney", 0]]);
  assert.ok(monohouse.checks.some((check) => check.code === "ground_floor"));
  assert.ok(monohouse.sheet.lines.length > 40);
  assert.equal(monohouse.sheet.image, "static/sheets/monohouse.jpg");
  assert.equal(monohouse.sheet.fields.rent.sourceText, "賃室料：￥95，000円");
  assert.deepEqual(monohouse.provenance.editedFields, []);
  assert.deepEqual(monohouse.sheetWarnings.map((warning) => warning.code), ["inconsistent_values"]);
  // "Value not found in its OCR line" warnings are about the reading, settled by the check.
  const bresport = candidateFromSheet(SHEETS.find((sheet) => sheet.id === "bresport"));
  assert.equal(bresport.name, "Bresport（ブレスポート）");
  assert.deepEqual(bresport.sheetWarnings, []);
});

test("districtFromAddress finds the ward or city, with or without the prefecture", () => {
  assert.equal(districtFromAddress("東京都世田谷区代田5-35-30"), "世田谷区");
  assert.equal(districtFromAddress("世田谷区北沢4-16-24 3F"), "世田谷区");
  assert.equal(districtFromAddress("神奈川県横浜市港北区日吉1-1"), "横浜市");
  assert.equal(districtFromAddress("大阪府大阪市北区梅田1-1"), "大阪市");
  assert.equal(districtFromAddress(null), null);
  assert.equal(districtFromAddress("住所不明"), null);
});

test("unknown values stay unknown on the candidate", () => {
  const empty = { propertyName: "x", rent: 1, managementFee: null, address: null, station: null, layout: null, areaSqm: null, constructionYear: null };
  const candidate = buildCandidate(liveResult(), empty, "2026-09-21T07:41:00.000Z");
  assert.deepEqual([candidate.district, candidate.station, candidate.layout, candidate.areaSqm, candidate.managementFee], [null, null, null, null, null]);
});

test("provenanceText states method, check, times, and edits", () => {
  const empty = { propertyName: "x", rent: 1, managementFee: null, address: null, station: null, layout: null, areaSqm: null, constructionYear: null };
  const live = provenanceText(buildCandidate(liveResult(), empty, "2026-09-21T07:41:00.000Z").provenance);
  assert.match(live, /AI抽出（gemini-3\.8-flash）・人が確認/);
  assert.match(live, /抽出 9\/21 16:40・確認 9\/21 16:41/);
  assert.match(live, /人が修正: 物件・部屋名・月額賃料（円）・管理費・共益費（円）/);
  const seeded = provenanceText(candidateFromSheet(SAMPLE_SHEET).provenance);
  assert.match(seeded, /^募集図面画像 \/ 記録済みの読み取り（OCR 実測・項目の対応付けは手作業）・記録時に原本と照合 \/ 記録 /);
  const reviewed = buildCandidate(SAMPLE_SHEET.reading, valuesOf(SAMPLE_SHEET.reading), "2026-09-21T12:00:00.000Z", { image: SAMPLE_SHEET.image });
  assert.match(provenanceText(reviewed.provenance), /記録済みの読み取り（OCR 実測・項目の対応付けは手作業）・人が確認 \/ 抽出 .+・確認 9\/21 21:00$/);
});

test("the note explains where a reading came from", () => {
  assert.match(extractionNote(SAMPLE_SHEET.reading), /事前に読み取った記録です（.+、項目の対応付けは手作業）/);
  assert.match(extractionNote(liveResult()), /gemini-3\.8-flash が項目に対応付けました/);
  assert.match(extractionNote({ meta: { mode: "mock" } }), /読み取っていません/);
});

test("isExtractionResult checks the contract shape", () => {
  assert.equal(isExtractionResult(liveResult()), true);
  assert.equal(isExtractionResult(SAMPLE_SHEET.reading), true);
  assert.equal(isExtractionResult({ fields: {} }), false);
  assert.equal(isExtractionResult({ ...liveResult(), meta: { mode: "other" } }), false);
  const { managementFee, ...withoutFee } = liveResult().fields;
  assert.equal(isExtractionResult({ ...liveResult(), fields: withoutFee }), false);
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
