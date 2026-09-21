import * as z from "zod";

export const FIELD_KEYS = ["propertyName", "rent", "address", "station", "layout", "areaSqm", "constructionYear"];
export const WARNING_CODES = ["inconsistent_values", "illegible", "multiple_candidates", "other"];

const Box = z
  .object({ x1: z.number(), y1: z.number(), x2: z.number(), y2: z.number() })
  .describe("Pixel bounding box of sourceText in the image: top-left (x1, y1) and bottom-right (x2, y2).");

const field = (value, description) =>
  z.object({
    value: value.nullable().describe(`${description} null when the sheet does not show it or it cannot be read.`),
    confidence: z.number().describe("Your own estimate, from 0 to 1, that value is read correctly from the sheet."),
    sourceText: z.string().nullable().describe("The text exactly as printed on the sheet that value was read from."),
    box: Box.nullable(),
  });

/** Shape Claude must return. Structured outputs enforce it; zod re-validates it. */
export const ModelOutputSchema = z.object({
  fields: z.object({
    propertyName: field(z.string(), "Building name plus room number, as printed (e.g. モノハウス 104号室)."),
    rent: field(z.number(), "Monthly rent in yen as a plain number, excluding a separately listed management fee."),
    address: field(z.string(), "Full address as printed (所在地)."),
    station: field(z.string(), "The first-listed nearest station with its line and walking time, as printed."),
    layout: field(z.string(), "Floor-plan type such as 1K, 1DK, 1LDK (間取り)."),
    areaSqm: field(z.number(), "Private floor area in square metres from the property summary (専有面積)."),
    constructionYear: field(z.number(), "Year of construction as a four-digit Western year (竣工 / 築年)."),
  }),
  warnings: z
    .array(
      z.object({
        // Kept as plain strings (and normalised in toContract) so one unexpected label
        // cannot fail an otherwise good extraction.
        code: z.string().describe(`One of: ${WARNING_CODES.join(", ")}.`),
        message: z.string().describe("One short sentence in Japanese describing the issue for the person reviewing the sheet."),
        fields: z.array(z.string()).describe(`Affected field keys, from: ${FIELD_KEYS.join(", ")}.`),
      }),
    )
    .describe("Inconsistencies between parts of the sheet, partly illegible values, or several plausible values for one field."),
});

const INTEGER_FIELDS = new Set(["rent", "constructionYear"]);
const NUMBER_FIELDS = new Set(["rent", "areaSqm", "constructionYear"]);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value, digits) => Number(value.toFixed(digits));

function normaliseValue(key, value) {
  if (value === null) return null;
  if (NUMBER_FIELDS.has(key)) {
    if (!Number.isFinite(value) || value <= 0) return null;
    return INTEGER_FIELDS.has(key) ? Math.round(value) : round(value, 2);
  }
  const text = String(value).trim();
  return text || null;
}

/** Convert a pixel box to a normalised [x, y, width, height] within the image, or null if degenerate. */
export function normaliseBox(box, width, height) {
  if (!box) return null;
  const x1 = clamp(Math.min(box.x1, box.x2), 0, width);
  const x2 = clamp(Math.max(box.x1, box.x2), 0, width);
  const y1 = clamp(Math.min(box.y1, box.y2), 0, height);
  const y2 = clamp(Math.max(box.y1, box.y2), 0, height);
  if (x2 - x1 < 1 || y2 - y1 < 1) return null;
  return [round(x1 / width, 4), round(y1 / height, 4), round((x2 - x1) / width, 4), round((y2 - y1) / height, 4)];
}

/** Turn validated model output into the public API contract. */
export function toContract(output, { documentId, extractedAt, model, mode, image }) {
  const fields = Object.fromEntries(
    FIELD_KEYS.map((key) => {
      const raw = output.fields[key];
      const value = normaliseValue(key, raw.value);
      return [
        key,
        {
          value,
          // A missing value is unknown, not a low-confidence read.
          confidence: value === null ? null : round(clamp(raw.confidence, 0, 1), 2),
          evidence: normaliseBox(raw.box, image.width, image.height),
          sourceText: raw.sourceText?.trim() || null,
        },
      ];
    }),
  );
  const warnings = output.warnings
    .filter((warning) => warning.message.trim())
    .slice(0, 10)
    .map((warning) => ({
      code: WARNING_CODES.includes(warning.code) ? warning.code : "other",
      message: warning.message.trim(),
      fields: [...new Set(warning.fields.filter((key) => FIELD_KEYS.includes(key)))],
    }));
  return {
    documentId,
    meta: {
      mode,
      model,
      extractedAt,
      image: { width: image.width, height: image.height },
      confidenceSource: "model-reported",
    },
    fields,
    warnings,
  };
}
