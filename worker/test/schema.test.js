import { test } from "node:test";
import assert from "node:assert/strict";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { ModelOutputSchema, toContract, normaliseBox, FIELD_KEYS } from "../src/schema.js";
import { mockOutput } from "../src/mock.js";

const image = { width: 2000, height: 1184 };
const meta = { documentId: "doc-1", extractedAt: "2026-09-21T08:00:00.000Z", model: "claude-opus-5", mode: "live", image };

test("mock output satisfies the model schema", () => {
  const format = betaZodOutputFormat(ModelOutputSchema);
  assert.doesNotThrow(() => format.parse(JSON.stringify(mockOutput(image))));
});

test("toContract returns every field with normalised evidence", () => {
  const contract = toContract(mockOutput(image), meta);
  assert.deepEqual(Object.keys(contract.fields), FIELD_KEYS);
  assert.equal(contract.fields.rent.value, 88000);
  assert.deepEqual(contract.fields.rent.evidence, [0.0325, 0.2297, 0.2225, 0.0372]);
  assert.equal(contract.meta.confidenceSource, "model-reported");
  assert.deepEqual(contract.meta.image, image);
  assert.deepEqual(contract.warnings[0].fields, ["areaSqm"]);
});

test("a missing value is unknown: confidence becomes null", () => {
  const output = mockOutput(image);
  output.fields.station = { value: null, confidence: 0.9, sourceText: null, box: null };
  const { station } = toContract(output, meta).fields;
  assert.deepEqual(station, { value: null, confidence: null, evidence: null, sourceText: null });
});

test("numbers are sanity-checked and rounded; confidence is clamped", () => {
  const output = mockOutput(image);
  output.fields.rent.value = -5;
  output.fields.constructionYear.value = 1998.4;
  output.fields.areaSqm.value = 20.1549;
  output.fields.layout.confidence = 1.3;
  const { fields } = toContract(output, meta);
  assert.equal(fields.rent.value, null);
  assert.equal(fields.constructionYear.value, 1998);
  assert.equal(fields.areaSqm.value, 20.15);
  assert.equal(fields.layout.confidence, 1);
});

test("normaliseBox clamps, reorders, and drops degenerate boxes", () => {
  assert.deepEqual(normaliseBox({ x1: 1000, y1: 592, x2: 0, y2: 0 }, 2000, 1184), [0, 0, 0.5, 0.5]);
  assert.deepEqual(normaliseBox({ x1: -50, y1: 1100, x2: 2100, y2: 1300 }, 2000, 1184), [0, 0.9291, 1, 0.0709]);
  assert.equal(normaliseBox({ x1: 10, y1: 10, x2: 10.5, y2: 40 }, 2000, 1184), null);
  assert.equal(normaliseBox(null, 2000, 1184), null);
});

test("warnings: unknown codes become other, unknown fields and empty messages are dropped", () => {
  const output = mockOutput(image);
  output.warnings = [
    { code: "blurry", message: " 住所の一部が不鮮明です。 ", fields: ["address", "floorPlan", "address"] },
    { code: "other", message: "   ", fields: [] },
  ];
  assert.deepEqual(toContract(output, meta).warnings, [{ code: "other", message: "住所の一部が不鮮明です。", fields: ["address"] }]);
});
