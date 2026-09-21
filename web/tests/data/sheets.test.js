import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { SHEETS } from "../../data/sheets.js";
import { EXTRACTION_FIELDS, SAMPLE_SHEET, isExtractionResult } from "../../apps/intake/models.js";
import { SEED_SHEET_IDS } from "../../apps/shortlist/models.js";

const webRoot = new URL("../../", import.meta.url);

test("every recorded sheet has its image and a reading in the extraction contract", () => {
  assert.equal(new Set(SHEETS.map((sheet) => sheet.id)).size, SHEETS.length);
  for (const sheet of SHEETS) {
    assert.ok(existsSync(new URL(sheet.image, webRoot)), `${sheet.image} is missing: run python -m commands.record_sheets`);
    assert.ok(isExtractionResult(sheet.reading), sheet.id);
    assert.equal(sheet.reading.meta.mode, "recorded");
    assert.equal(sheet.reading.meta.confidenceSource, "ocr-engine");
    assert.ok(sheet.reading.meta.ocr.startsWith("Docling"), sheet.id);
    assert.deepEqual(Object.keys(sheet.confirmed), EXTRACTION_FIELDS.map(({ key }) => key));
  }
});

test("evidence is a normalized box inside the image and comes with the OCR text", () => {
  for (const sheet of SHEETS) {
    for (const [key, field] of Object.entries(sheet.reading.fields)) {
      if (field.value === null) {
        assert.deepEqual([field.confidence, field.evidence, field.sourceText], [null, null, null], `${sheet.id}.${key}`);
        continue;
      }
      const [x, y, w, h] = field.evidence;
      assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= 1.0001 && y + h <= 1.0001, `${sheet.id}.${key}`);
      assert.ok(field.confidence > 0 && field.confidence <= 1, `${sheet.id}.${key}`);
      assert.ok(field.sourceText, `${sheet.id}.${key}`);
    }
  }
});

test("the seeds and the sample are distinct recorded sheets", () => {
  const ids = SHEETS.map((sheet) => sheet.id);
  assert.ok(SEED_SHEET_IDS.every((id) => ids.includes(id)));
  assert.ok(SAMPLE_SHEET && !SEED_SHEET_IDS.includes(SAMPLE_SHEET.id));
});

test("each recording carries its money terms, pre-contract checks, and full OCR text", () => {
  for (const sheet of SHEETS) {
    const { costs, checks, lines } = sheet.reading;
    assert.ok(costs.length >= 8 && costs.every((cost) => cost.evidence && cost.confidence > 0.8), sheet.id);
    assert.ok(checks.length >= 10 && checks.every((check) => check.title && check.detail && check.sourceText), sheet.id);
    assert.ok(lines.length > 20 && lines.every((line) => line.text && line.box.length === 4), sheet.id);
  }
});
