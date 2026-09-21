import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PREFERENCES } from "../../../config.js";
import { DEMO_PROPERTIES } from "../../../apps/shortlist/models.js";
import { budgetScore, isProvisional, rankProperties, scoreProperty } from "../../../apps/shortlist/services.js";

const preferences = { ...DEFAULT_PREFERENCES, priorities: new Set(DEFAULT_PREFERENCES.priorities) };

test("budget score: full within budget, falling above it, neutral when unknown", () => {
  assert.equal(budgetScore(120000, 130000), 25);
  assert.equal(budgetScore(143000, 130000), 25 - 13000 / 700);
  assert.equal(budgetScore(300000, 130000), 0);
  assert.equal(budgetScore(null, 130000), 12.5);
});

test("default preferences rank the demo inventory as the UI shows it", () => {
  const ranked = rankProperties(DEMO_PROPERTIES, preferences);
  assert.deepEqual(ranked.map((property) => [property.id, scoreProperty(property, preferences)]), [
    ["kiyosumi", 72],
    ["musashi", 62],
    ["koenji", 54],
  ]);
});

test("priorities change the order", () => {
  const quietAndSpace = { ...preferences, priorities: new Set(["quiet", "space"]), budget: 160000 };
  assert.equal(rankProperties(DEMO_PROPERTIES, quietAndSpace)[0].id, "kiyosumi");
  const lateOnly = { ...preferences, priorities: new Set(["late"]), budget: 160000 };
  assert.equal(rankProperties(DEMO_PROPERTIES, lateOnly)[0].id, "musashi");
});

test("a provisional candidate with unknown rent is not scored as affordable", () => {
  const imported = { id: "uploaded-listing", rent: null, enriched: false };
  assert.equal(isProvisional(imported), true);
  assert.equal(scoreProperty(imported, preferences), 47);
  assert.ok(scoreProperty({ ...imported, rent: 90000 }, preferences) > scoreProperty(imported, preferences));
});

test("ranking does not mutate its input", () => {
  const input = [...DEMO_PROPERTIES].reverse();
  const before = input.map((property) => property.id);
  rankProperties(input, preferences);
  assert.deepEqual(input.map((property) => property.id), before);
});
