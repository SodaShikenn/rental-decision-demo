import { test } from "node:test";
import assert from "node:assert/strict";
import { applyResearch, researchInput, missingFields, requestResearch, safeSourceUrl } from "../../../apps/research/services.js";

const source = { url: "https://suumo.jp/chintai/test/", retrievedAt: "2026-09-22", listingDate: "2026-09-20" };
const property = { name: "建物 408号室", address: "東京都渋谷区", rent: null, managementFee: 0, areaSqm: 20, unconfirmedFields: ["rent"], provenance: { mode: "recorded" } };

test("online facts fill missing fields only and retain per-field sources", () => {
  const result = applyResearch(property, [{ key: "rent", value: 100000, eligible: true, source }, { key: "areaSqm", value: 99, eligible: true, source }]);
  assert.equal(result.rent, 100000);
  assert.equal(result.areaSqm, 20);
  assert.equal(result.fieldSources.rent.url, source.url);
  assert.deepEqual(result.unconfirmedFields, []);
  assert.equal(property.rent, null);
});

test("other units, unsafe URLs and malformed values cannot be applied", () => {
  for (const change of [{ eligible: false }, { source: { url: "javascript:alert(1)" } }, { value: "100000" }, { value: -1 }]) {
    assert.equal(applyResearch(property, [{ key: "rent", value: 100000, eligible: true, source, ...change }]).rent, null);
  }
  assert.equal(safeSourceUrl("https://user:secret@example.com"), null);
});

test("search input includes apartment identity and treats zero fees as known", () => {
  assert.equal(researchInput(property).room, "408");
  assert.ok(missingFields(property).includes("rent"));
  assert.ok(!missingFields(property).includes("managementFee"));
});

test("unconfigured and failed online research never fabricate a result", async () => {
  await assert.rejects(requestResearch("", {}), /未設定/);
  await assert.rejects(requestResearch("/api", {}, { fetchImpl: async () => ({ ok: false, json: async () => ({ error: { message: "設定が必要" } }) }) }), /設定が必要/);
  await assert.rejects(requestResearch("/api", {}, { fetchImpl: async () => ({ ok: true, json: async () => ({}) }) }), /形式/);
});
