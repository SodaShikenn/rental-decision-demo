import { test } from "node:test";
import assert from "node:assert/strict";
import { EXTRACTION_STATE_KEYS, STATUS_KINDS, capabilityList, statusCounts } from "../../../apps/capabilities/models.js";
import { capabilityChip, fetchServerState, statusChip } from "../../../apps/capabilities/services.js";

const byKey = (list) => Object.fromEntries(list.map((item) => [item.key, item]));

test("without a server, extraction is a demo and the map is not connected", () => {
  const list = byKey(capabilityList({ extraction: "none", mapsLive: false }));
  assert.equal(list.extraction.kind, "demo");
  assert.match(list.extraction.next, /web\/env\.js/);
  assert.equal(list.maps.kind, "planned");
  assert.equal(list.routes.kind, "planned");
  assert.equal(list.inventory.kind, "demo");
});

test("extraction status follows what the server reports", () => {
  const kind = (extraction) => byKey(capabilityList({ extraction, mapsLive: false })).extraction;
  assert.equal(kind("live").kind, "live");
  assert.equal(kind("live").next, "");
  assert.match(byKey(capabilityList({ extraction: "live", model: "gemini-3.8-flash", mapsLive: false })).extraction.now, /Gemini（gemini-3\.8-flash）/);
  assert.equal(kind("mock").kind, "demo");
  assert.match(kind("mock").now, /モック/);
  assert.equal(kind("unconfigured").kind, "planned");
  assert.equal(kind("disabled").kind, "planned");
  assert.equal(kind("unreachable").kind, "planned");
  assert.equal(byKey(capabilityList({ extraction: "none", mapsLive: true })).maps.kind, "live");
});

test("every capability is fully described and uses a known status, in every server state", () => {
  for (const extraction of EXTRACTION_STATE_KEYS) {
    const list = capabilityList({ extraction, mapsLive: false });
    assert.equal(new Set(list.map((item) => item.key)).size, list.length);
    for (const item of list) {
      assert.ok(item.name && item.now, item.key);
      assert.ok(item.kind in STATUS_KINDS, item.key);
      assert.equal(Boolean(item.next), item.kind !== "live", `${extraction}/${item.key}`);
    }
    const counts = statusCounts(list);
    assert.equal(counts.live + counts.demo + counts.planned, list.length);
  }
});

const health = (body, ok = true) => async () => ({ ok, json: async () => body });

test("fetchServerState maps /healthz to a state and never throws", async () => {
  assert.deepEqual(await fetchServerState("http://api", { fetchImpl: health({ mode: "live", enabled: true, configured: true, model: "gemini-3.8-flash" }) }), { state: "live", model: "gemini-3.8-flash" });
  assert.deepEqual(await fetchServerState("http://api", { fetchImpl: health({ mode: "mock", enabled: true, configured: true }) }), { state: "mock" });
  assert.deepEqual(await fetchServerState("http://api", { fetchImpl: health({ mode: "live", enabled: true, configured: false }) }), { state: "unconfigured" });
  assert.deepEqual(await fetchServerState("http://api", { fetchImpl: health({ mode: "live", enabled: false, configured: true }) }), { state: "disabled" });
  assert.deepEqual(await fetchServerState("http://api", { fetchImpl: health({}, false) }), { state: "unreachable" });
  assert.deepEqual(await fetchServerState("http://api", { fetchImpl: async () => { throw new TypeError("fetch failed"); } }), { state: "unreachable" });
});

test("chips carry the status label and a tooltip describing the current behavior", () => {
  assert.equal(statusChip("planned"), '<span class="chip chip--planned">未接続</span>');
  assert.match(capabilityChip("routes"), /chip--planned.*title="通勤時間・経路：比較に含めていません。"/);
});
