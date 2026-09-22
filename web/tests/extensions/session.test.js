import test from "node:test";
import assert from "node:assert/strict";
import { restoredState, sessionSnapshot } from "../../extensions/session.js";
import { createStore } from "../../extensions/ext_store.js";
import { buildTenantMemo } from "../../apps/needs/services.js";
test("legacy handwritten notes and memo overrides cannot return to generated analysis", () => {
  const { state } = createStore({ properties: [], settings: { moveIn: "2026-10-01" } });
  const legacy = { ...state, memoEdit: "手書きの希望", memoEditVersion: 1, observations: [{ text: "昔の内見", candidateId: "a" }] };
  for (const next of [restoredState(legacy), sessionSnapshot(legacy).state]) {
    assert.ok(!("observations" in next));
    assert.ok(!("memoEdit" in next));
    assert.ok(!("memoEditVersion" in next));
    assert.deepEqual(next.priorities, state.priorities);
  }
  assert.doesNotMatch(buildTenantMemo(legacy).text, /昔の内見|手書きの希望/);
});
