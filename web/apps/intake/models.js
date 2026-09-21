// Extraction data definitions (≈ models.py): the fields a listing sheet yields, the reading modes,
// and a shape check for server responses.
import { SHEETS } from "../../data/sheets.js";
import { yen } from "../../helper.js";

export const EXTRACTION_FIELDS = [
  { key: "propertyName", label: "物件・部屋名", type: "text" },
  { key: "rent", label: "月額賃料（円）", type: "number", step: "1" },
  // 0 is a real value here: a fee included in the rent (管理費込).
  { key: "managementFee", label: "管理費・共益費（円）", type: "number", step: "1", allowZero: true },
  { key: "address", label: "住所", type: "text", wide: true },
  { key: "station", label: "最寄駅", type: "text" },
  { key: "layout", label: "間取り", type: "text" },
  { key: "areaSqm", label: "専有面積（㎡）", type: "number", step: "0.01" },
  { key: "constructionYear", label: "竣工年", type: "number", step: "1" },
];

// live: this server just read the image. recorded: a reading made earlier of a sheet published with
// the site (web/data/sheets.js). mock: the server's fixed test reading; the image is not read.
export const MODE_LABELS = { live: "OCR（Docling）+ Gemini の読み取り結果", recorded: "記録済みの読み取り結果 · OCR は実測", mock: "モック応答 · 画像は未解析" };
export const WARNING_LABELS = { inconsistent_values: "不一致", illegible: "判読困難", multiple_candidates: "候補複数", other: "注意" };

/** The sheet offered as "サンプル図面": its image and its recorded reading. */
export const SAMPLE_SHEET = SHEETS.find((sheet) => sheet.id === "monohouse");

/** Recorded sheets on the page when it opens, in this order. The sample is added by the person. */
export const SEED_SHEET_IDS = ["louvre-shoto", "bresport", "granpaseo-4"];

export const fieldLabel = (key) => EXTRACTION_FIELDS.find((field) => field.key === key)?.label ?? key;
/** The label without its unit: 「月額賃料（円）」 → 「月額賃料」. */
export const shortFieldLabel = (key) => fieldLabel(key).replace(/（.+）$/, "");

/** A confirmed value the way the sheet prints it: 105000 → 「105,000円」, 0 fee → 「0円（込み）」, null → 「未取得」. */
export function fieldValueText(key, value) {
  if (value == null) return "未取得";
  if (key === "rent" || key === "managementFee") return value === 0 ? "0円（込み）" : yen(value);
  if (key === "areaSqm") return `${value}㎡`;
  if (key === "constructionYear") return `${value}年`;
  return String(value);
}

/** Whether a server response matches the extraction contract (see handoff.md). */
export function isExtractionResult(body) {
  return Boolean(
    body?.meta?.mode in MODE_LABELS &&
      body.fields &&
      Array.isArray(body.warnings) &&
      EXTRACTION_FIELDS.every(({ key }) => body.fields[key] && "value" in body.fields[key] && "confidence" in body.fields[key]),
  );
}
