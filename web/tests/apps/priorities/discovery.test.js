import { test } from "node:test";
import assert from "node:assert/strict";
import { candidateAnalysis, discoveryQuestions, nextDiscoveryQuestion } from "../../../apps/priorities/discovery.js";
import { emptyPriorities, priorityMemo } from "../../../apps/priorities/services.js";
import { defaultMoveIn } from "../../../apps/costs/services.js";
const settings = { moveIn: defaultMoveIn(), brokerageMonths: 1 };
const a = { id: "a", name: "候補A", rent: 90000, managementFee: 0, station: "A駅 徒歩10分", areaSqm: 20 };
const b = { id: "b", name: "候補B", rent: 110000, managementFee: 5000, station: "B駅 徒歩5分", areaSqm: 30 };

test("discovery uses only known candidate values and never confirms preferences itself", () => {
  const analysis = candidateAnalysis([a, b], settings);
  const priorities = emptyPriorities();
  const questions = discoveryQuestions(analysis);
  assert.deepEqual(questions[0].options.map((option) => option.value), [90000, 115000]);
  assert.match(questions[0].evidence, /候補A/);
  assert.equal(nextDiscoveryQuestion(questions, priorities, {}).key, "budget");
  assert.equal(priorities.budget.level, "later");
  priorities.budget = { level: "prefer", value: 115000 };
  assert.equal(nextDiscoveryQuestion(questions, priorities, {}).key, "walk");
});

test("uncertain values and mock candidates do not generate thresholds", () => {
  const analysis = candidateAnalysis([{ ...a, managementFee: null, unconfirmedFields: ["areaSqm", "station"] }, { ...b, provenance: { mode: "mock" } }], settings);
  assert.deepEqual(discoveryQuestions(analysis), []);
  assert.ok(analysis.dimensions.every((dimension) => dimension.missing === 2));
});

test("one candidate works and empty input produces no invented questions", () => {
  assert.equal(discoveryQuestions(candidateAnalysis([a], settings)).length, 3);
  assert.deepEqual(discoveryQuestions(candidateAnalysis([], settings)), []);
});

test("deferral applies only to the same evidence and remains in the memo", () => {
  const questions = discoveryQuestions(candidateAnalysis([a], settings));
  const priorities = emptyPriorities();
  const responses = { budget: questions[0].fingerprint };
  priorities.pending = ["budget"];
  assert.equal(nextDiscoveryQuestion(questions, priorities, responses).key, "walk");
  const changed = discoveryQuestions(candidateAnalysis([a, b], settings));
  assert.equal(nextDiscoveryQuestion(changed, priorities, responses).key, "budget");
  assert.match(priorityMemo(priorities), /まだ決められない条件/);
  assert.equal(priorities.budget.value, null);
});
