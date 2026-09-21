import { test } from "node:test";
import assert from "node:assert/strict";
import { monthlyReferences, researchDue, supplementMonthly } from "../../../apps/research/monthly.js";
import { startAutomaticResearch, restoreRecordedResearch } from "../../../apps/research/automatic.js";
import { createStore } from "../../../extensions/ext_store.js";
import { RECORDED_MONTHLY_RESEARCH } from "../../../data/research.js";
import { compareRows, monthlyCost } from "../../../apps/compare/services.js";
import { candidateFromSheet } from "../../../apps/intake/services.js";
import { SHEETS } from "../../../data/sheets.js";
import { advisorEvidence } from "../../../apps/advisor/services.js";

const property = candidateFromSheet(SHEETS.find((sheet) => sheet.id === "granpaseo-4"));
const recorded = RECORDED_MONTHLY_RESEARCH[0].result;
const exactOffer = () => ({ ...recorded.listings[0], match: "same_unit", identityVerified: true,
  facts: recorded.listings[0].facts.map((fact) => ({ ...fact, eligible: true })) });

test("building reference appears in comparison with source but never becomes candidate rent", () => {
  const updated = supplementMonthly(property, recorded);
  assert.equal(updated.rent, null);
  assert.equal(monthlyCost(updated), null);
  assert.equal(monthlyReferences(updated)[0].monthly, 123000);
  const cell = compareRows([updated], { moveIn: "2026-10-01", brokerageMonths: 1 }, {}).rows.find((row) => row.key === "monthly").cells[0];
  assert.equal(cell.text, "参考 12.3万円");
  assert.match(cell.sub, /102号室/);
  assert.equal(cell.unknown, true);
  const evidence = advisorEvidence([updated]);
  assert.equal(evidence.find((item) => item.id === "c0-budget").kind, "unknown");
  assert.match(evidence.find((item) => item.id === "c0-reference-rent0").text, /123000円.*予算判定には使用不可/);
  assert.equal(monthlyReferences({ ...updated, address: "別の住所" }).length, 0);
});

test("only cited exact units fill missing monthly fields; conflicts and historic offers stay unknown", () => {
  const candidate = { ...property, room: "102" };
  assert.equal(supplementMonthly(candidate, { listings: [exactOffer()] }).rent, 113000);
  for (const changes of [{ identityVerified: false }, { match: "same_building" }, { facts: exactOffer().facts.map((fact) => ({ ...fact, source: { ...fact.source, status: "historical" } })) }]) {
    assert.equal(supplementMonthly(candidate, { listings: [{ ...exactOffer(), ...changes }] }).rent, null);
  }
  const conflicting = { ...exactOffer(), facts: exactOffer().facts.map((fact) => fact.key === "rent" ? { ...fact, value: 116000 } : fact) };
  assert.equal(supplementMonthly(candidate, { listings: [exactOffer(), conflicting] }).rent, null);
  assert.equal(supplementMonthly({ ...candidate, managementFee: 12000 }, { listings: [exactOffer()] }).rent, null);
});

test("reference totals require both charges from the same current unit page", () => {
  for (const facts of [exactOffer().facts.filter((fact) => fact.key !== "managementFee"), exactOffer().facts.map((fact) => fact.key === "managementFee" ? { ...fact, source: { ...fact.source, url: "https://example.com/other-room" } } : fact)]) {
    assert.equal(monthlyReferences(supplementMonthly(property, { listings: [{ ...exactOffer(), facts }] })).length, 0);
  }
});

test("recorded lookup supplements restored brochure once and daily caching permits refresh", () => {
  const store = createStore({ properties: [property], settings: {} });
  restoreRecordedResearch(store);
  assert.equal(monthlyReferences(store.state.properties[0])[0].monthly, 123000);
  const original = store.state.properties[0];
  restoreRecordedResearch(store);
  assert.equal(store.state.properties[0], original);
  const saved = supplementMonthly(property, recorded, "2026-09-22T00:00:00Z");
  assert.equal(researchDue(saved, Date.parse("2026-09-22T01:00:00Z")), false);
  assert.equal(researchDue(saved, Date.parse("2026-09-23T01:00:00Z")), true);
  assert.equal(researchDue({ ...saved, address: "new" }), true);
});

test("automatic lookup starts for missing rent, persists failures and ignores deleted candidates", async () => {
  const store = createStore({ properties: [property], settings: {} });
  let calls = 0;
  startAutomaticResearch(store, "/api", { request: async () => { calls++; throw new Error("offline"); } });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(calls, 1);
  assert.equal(store.state.properties[0].monthlyResearch.status, "error");
  store.emit("change");
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(calls, 1);

  const removed = createStore({ properties: [property], settings: {} });
  startAutomaticResearch(removed, "/api", { request: async () => { removed.removeProperty(property.id); return recorded; } });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(removed.state.properties.length, 0);
});

test("editing candidate identity discards old references while searching and rejects stale responses", async () => {
  const old = supplementMonthly(property, recorded);
  const changed = { ...old, address: "新しい住所" };
  const store = createStore({ properties: [changed], settings: {} });
  let release;
  startAutomaticResearch(store, "/api", { request: async () => {
    assert.equal(monthlyReferences(store.state.properties[0]).length, 0);
    return await new Promise((resolve) => { release = resolve; });
  } });
  await new Promise((resolve) => setTimeout(resolve, 10));
  // Editing while the request is in progress cannot attach the old offer.
  store.upsertProperty({ ...store.state.properties[0], rent: 90000 });
  release(recorded);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(store.state.properties[0].rent, 90000);
  assert.equal(monthlyReferences(store.state.properties[0]).length, 0);
});
