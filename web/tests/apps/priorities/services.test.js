import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyPriorities, assessCandidate, findTradeoff } from "../../../apps/priorities/services.js";
import { buildTenantMemo } from "../../../apps/needs/services.js";
import { buildPartialCandidate, candidateFromSheet, fieldsNeedingReview } from "../../../apps/intake/services.js";
import { manualCandidate } from "../../../apps/intake/manual.js";
import { SHEETS } from "../../../data/sheets.js";

const properties = SHEETS.map(candidateFromSheet);

test("budget assessment distinguishes missing fees, zero fees, must-haves, and preferences", () => {
  const priorities = emptyPriorities();
  priorities.budget = { level: "must", value: 100000 };
  assert.equal(assessCandidate({ rent: 90000, managementFee: null }, priorities)[0].status, "unknown");
  assert.equal(assessCandidate({ rent: 90000, managementFee: 0 }, priorities)[0].status, "fits");
  assert.equal(assessCandidate({ rent: 100000, managementFee: 5000 }, priorities)[0].status, "conflict");
  priorities.budget.level = "prefer";
  assert.equal(assessCandidate({ rent: 100000, managementFee: 5000 }, priorities)[0].status, "tradeoff");
  assert.equal(assessCandidate({ rent: 10000, managementFee: 0, provenance: { mode: "mock" } }, priorities)[0].status, "unknown");
});

test("tradeoffs require opposing known advantages and preserve candidate order", () => {
  const a = { id: "a", rent: 90000, managementFee: 0, station: "A駅 徒歩10分" };
  const b = { id: "b", rent: 110000, managementFee: 0, station: "B駅 徒歩5分" };
  const input = [a, b];
  assert.equal(findTradeoff(input).saving, 20000);
  assert.equal(findTradeoff(input).extraWalk, 5);
  assert.deepEqual(input, [a, b]);
  assert.equal(findTradeoff([a, { ...b, managementFee: null }]), null);
  assert.equal(findTradeoff([a, { ...b, station: "B駅 徒歩15分" }]), null);
});

test("the tenant memo does not turn common listing features into requirements", () => {
  const state = { properties, priorities: emptyPriorities(), pickOverrides: {}, answers: {} };
  const memo = buildTenantMemo(state);
  assert.ok(memo.chips.every((chip) => !chip.pressed));
  assert.match(memo.text, /まだ決めていません/);
  assert.doesNotMatch(memo.text, /・賃料：|・沿線：/);
  state.priorities.lifestyle = "静かに過ごしたい";
  state.pickOverrides[memo.chips[0].key] = true;
  assert.match(buildTenantMemo(state).text, /静かに過ごしたい/);
  assert.ok(buildTenantMemo(state).text.includes(memo.chips[0].label));
});

test("partial imports keep unresolved fields unknown without claiming a correction", () => {
  const result = structuredClone(SHEETS[0].reading);
  result.fields.rent.confidence = 0.1;
  const values = Object.fromEntries(Object.entries(result.fields).map(([key, field]) => [key, field.value]));
  const partial = buildPartialCandidate(result, values, new Set(), { image: "sheet.jpg" });
  assert.equal(partial.rent, null);
  assert.ok(partial.unconfirmedFields.includes("rent"));
  assert.ok(!partial.provenance.editedFields.includes("rent"));
  assert.equal(partial.sheet.fields.rent.value, result.fields.rent.value);
  const confirmed = buildPartialCandidate(result, values, fieldsNeedingReview(result));
  assert.equal(confirmed.rent, values.rent);
  assert.deepEqual(confirmed.unconfirmedFields, []);
});

test("manual entry preserves unknowns and supports correcting an existing imported candidate", () => {
  const candidate = manualCandidate({ propertyName: "候補A", rent: "90000", managementFee: "0" }, null, "a");
  assert.equal(candidate.rent, 90000);
  assert.equal(candidate.managementFee, 0);
  assert.equal(candidate.areaSqm, null);
  assert.equal(candidate.provenance.mode, "manual");
  const updated = manualCandidate({ propertyName: "候補A", rent: "95000", managementFee: "0" }, { ...candidate, unconfirmedFields: ["rent"] });
  assert.equal(updated.id, candidate.id);
  assert.equal(updated.rent, 95000);
  assert.deepEqual(updated.unconfirmedFields, []);
});


test("conflicting listing values do not produce definitive fit judgements", () => {
  const priorities = emptyPriorities();
  priorities.area = { level: "must", value: 25 };
  const candidate = { areaSqm: 30, sheetWarnings: [{ code: "inconsistent_values", fields: ["areaSqm"] }] };
  assert.equal(assessCandidate(candidate, priorities)[0].status, "unknown");
  candidate.provenance = { editedFields: ["areaSqm"] };
  assert.equal(assessCandidate(candidate, priorities)[0].status, "fits");
});
