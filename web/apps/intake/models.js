// Extraction data definitions (≈ models.py): the fields a listing sheet yields, the sample
// reading used without an extraction server, and a shape check for server responses.

export const EXTRACTION_FIELDS = [
  { key: "propertyName", label: "物件・部屋名", type: "text" },
  { key: "rent", label: "月額賃料（円）", type: "number", step: "1" },
  { key: "address", label: "住所", type: "text", wide: true },
  { key: "station", label: "最寄駅", type: "text" },
  { key: "layout", label: "間取り", type: "text" },
  { key: "areaSqm", label: "専有面積（㎡）", type: "number", step: "0.01" },
  { key: "constructionYear", label: "竣工年", type: "number", step: "1" },
];

export const MODE_LABELS = { sample: "SAMPLE EXTRACTION", mock: "MOCK EXTRACTION", live: "CLAUDE EXTRACTION" };
export const WARNING_LABELS = { inconsistent_values: "不一致", illegible: "判読困難", multiple_candidates: "候補複数", other: "注意" };

const sampleField = (value) => ({ value, confidence: null, evidence: null, sourceText: null });

/** Fixed values for the demonstrated sheet format, shown when no extraction server is configured. */
export const SAMPLE_EXTRACTION = {
  documentId: null,
  meta: { mode: "sample", model: null, extractedAt: null },
  fields: {
    propertyName: sampleField("モノハウス 104号室"),
    rent: sampleField(95000),
    address: sampleField("東京都世田谷区代田5-35-30"),
    station: sampleField("下北沢駅 徒歩2分"),
    layout: sampleField("1K"),
    areaSqm: sampleField(21.37),
    constructionYear: sampleField(2001),
  },
  warnings: [],
};

export const fieldLabel = (key) => EXTRACTION_FIELDS.find((field) => field.key === key)?.label ?? key;

/** Whether a server response matches the extraction contract (see handoff.md). */
export function isExtractionResult(body) {
  return Boolean(
    body?.meta?.mode in MODE_LABELS &&
      body.fields &&
      Array.isArray(body.warnings) &&
      EXTRACTION_FIELDS.every(({ key }) => body.fields[key] && "value" in body.fields[key] && "confidence" in body.fields[key]),
  );
}
