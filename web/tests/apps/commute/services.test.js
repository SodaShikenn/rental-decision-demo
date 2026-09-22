import test from "node:test";
import assert from "node:assert/strict";
import {
  commuteInput,
  commuteQuestion,
  commutePreference,
} from "../../../apps/commute/services.js";
test("schedule conversion always interprets the form as Japan time", () => {
  const state = { properties: [{ id: "a", name: "A" }] };
  const form = {
    at: "2026-09-23T09:00",
    mode: "TRANSIT",
    timeKind: "arrival",
    daysPerWeek: "3",
    objective: "fastest",
  };
  assert.equal(
    commuteInput(state, "place", form).at,
    "2026-09-23T00:00:00.000Z",
  );
  assert.throws(() => commuteInput(state, null, form), /目的地/);
});
test("questions exclude failures and confirmation stores intent rather than provider data", () => {
  const result = {
    schedule: { daysPerWeek: 3 },
    candidates: [
      {
        id: "a",
        name: "A",
        status: "checked",
        routes: [{ minutes: 25 }],
        recommended: 0,
      },
      { id: "b", name: "B", status: "no_route", routes: [] },
    ],
  };
  assert.match(commuteQuestion(result).evidence, /25分/);
  assert.equal(commuteQuestion({ candidates: [] }), null);
  const note = commutePreference(result, "walking", "prefer");
  assert.match(note.text, /徒歩を少なく/);
  assert.ok(!note.text.includes("25分"));
});

test("round-trip form uses separate JST arrival and return departure times", () => {
  const state = { properties: [{ id: "a", name: "A" }] };
  const form = {
    date: "2026-09-24",
    morning: "08:00",
    evening: "18:00",
    mode: "TRANSIT",
    daysPerWeek: "3",
    objective: "fastest",
  };
  const body = commuteInput(state, "place", form);
  assert.equal(body.at, "2026-09-23T23:00:00.000Z");
  assert.equal(body.returnAt, "2026-09-24T09:00:00.000Z");
  assert.equal(body.timeKind, "arrival");
  assert.throws(
    () => commuteInput(state, "place", { ...form, evening: "07:00" }),
    /帰り/,
  );
});
