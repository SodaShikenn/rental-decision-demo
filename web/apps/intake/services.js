// Intake logic (≈ services.py): image preparation, the extraction request, review rules, and
// turning a confirmed reading into a candidate. Importing this module has no side effects,
// so the pure functions are unit-tested in web/tests.
import { EXTRACTION_TIMEOUT_MS, MAX_IMAGE_EDGE, REVIEW_CONFIDENCE_THRESHOLD, UPLOAD_MAX_BYTES } from "../../config.js";
import { formatTime } from "../../helper.js";
import { EXTRACTION_FIELDS, fieldLabel, isExtractionResult } from "./models.js";

export class IntakeError extends Error {}

/** Scale down (never up) so the long edge is at most `maxEdge`. */
export function resizedSize(width, height, maxEdge = MAX_IMAGE_EDGE) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return [Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale))];
}

const encode = (canvas, type, quality) =>
  new Promise((resolve, reject) => canvas.toBlob((result) => (result ? resolve(result) : reject(new Error("encode"))), type, quality));

/**
 * Prepare the image for upload (browser only). An image that already fits is sent unchanged: every
 * re-encode costs OCR accuracy, red print most of all, and the server applies EXIF rotation itself.
 * A larger one is scaled down and sent as PNG, or as high-quality JPEG when PNG would be too big.
 */
export async function prepareImage(file) {
  const bitmap = await createImageBitmap(file);
  try {
    const [width, height] = resizedSize(bitmap.width, bitmap.height);
    if (width === bitmap.width && height === bitmap.height && file.size <= UPLOAD_MAX_BYTES) return { blob: file, name: file.name };
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
    const base = file.name.replace(/\.[^.]+$/, "");
    const png = await encode(canvas, "image/png");
    if (png.size <= UPLOAD_MAX_BYTES) return { blob: png, name: `${base}.png` };
    return { blob: await encode(canvas, "image/jpeg", 0.95), name: `${base}.jpg` };
  } finally {
    bitmap.close();
  }
}

/** POST the image to the extraction server. Throws IntakeError with a message safe to show. */
export async function requestExtraction(endpoint, blob, name, { fetchImpl = fetch, timeoutMs = EXTRACTION_TIMEOUT_MS } = {}) {
  const form = new FormData();
  form.append("image", blob, name);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(endpoint, { method: "POST", body: form, signal: controller.signal });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new IntakeError(body?.error?.message || `解析サーバーがエラーを返しました（HTTP ${response.status}）。`);
    if (!isExtractionResult(body)) throw new IntakeError("解析結果の形式が想定と異なります。");
    return body;
  } catch (error) {
    if (error instanceof IntakeError) throw error;
    if (error.name === "AbortError") throw new IntakeError(`解析が${Math.round(timeoutMs / 1000)}秒以内に終わりませんでした。もう一度お試しください。`);
    throw new IntakeError("解析サーバーに接続できませんでした。ネットワークと設定を確認してください。");
  } finally {
    clearTimeout(timer);
  }
}

/** Fields a person must confirm before the reading can affect ranking. */
export function fieldsNeedingReview(result, threshold = REVIEW_CONFIDENCE_THRESHOLD) {
  const flagged = new Set(result.warnings.flatMap((warning) => warning.fields));
  EXTRACTION_FIELDS.forEach(({ key }) => {
    const { value, confidence } = result.fields[key];
    if (value === null || confidence === null || confidence < threshold) flagged.add(key);
  });
  return flagged;
}

const mappingText = (model) => (model ? `${model} が項目に対応付け` : "項目の対応付けは手作業");

export function extractionNote({ meta }) {
  if (meta.mode === "mock") return "解析サーバーのモック応答です（テスト用の架空図面に対応する固定値）。選んだ画像の内容は読み取っていません。";
  const confidence = "信頼度は OCR エンジンが行ごとにつけた値で、値が根拠の行の文字と一致しない場合は下げています。";
  if (meta.mode === "recorded") {
    return `この図面を ${meta.ocr} で事前に読み取った記録です（${formatTime(meta.extractedAt)}、${mappingText(meta.model)}）。${confidence}`;
  }
  return `${meta.ocr ?? "OCR"} で文字を読み取り、${meta.model} が項目に対応付けました。${confidence}`;
}

export function provenanceText(provenance) {
  const method = {
    live: `AI抽出（${provenance.model}）`,
    recorded: `記録済みの読み取り（OCR 実測・${mappingText(provenance.model)}）`,
    mock: "モック応答（画像は未解析）",
  }[provenance.mode];
  if (provenance.seeded) {
    const edits = provenance.editedFields.length ? ` / 照合で修正: ${provenance.editedFields.map(fieldLabel).join("・")}` : "";
    return `募集図面画像 / ${method}・記録時に原本と照合 / 記録 ${formatTime(provenance.extractedAt)}${edits}`;
  }
  const times = provenance.extractedAt
    ? `抽出 ${formatTime(provenance.extractedAt)}・確認 ${formatTime(provenance.confirmedAt)}`
    : `確認 ${formatTime(provenance.confirmedAt)}`;
  const edits = provenance.editedFields.length ? ` / 人が修正: ${provenance.editedFields.map(fieldLabel).join("・")}` : "";
  return `募集図面画像 / ${method}・人が確認 / ${times}${edits}`;
}

/** City or ward from a Japanese address: "東京都世田谷区代田5-35-30" → "世田谷区". */
export function districtFromAddress(address) {
  return address?.match(/^(?:東京都|北海道|(?:京都|大阪)府|.{2,3}県)?(.+?[市区町村])/)?.[1] ?? null;
}

/**
 * Build a candidate from a confirmed reading. `values` are what the person confirmed (null for
 * unknown); any difference from the reading is recorded as an edit. `image` is the sheet the reading
 * came from, kept so each value can be shown next to its evidence.
 */
export function buildCandidate(result, values, confirmedAt, { id = "uploaded-listing", image = null, seeded = false } = {}) {
  const { propertyName, rent, managementFee, address, station, layout, areaSqm, constructionYear } = values;
  return {
    id,
    name: propertyName || "名称未取得の物件",
    district: districtFromAddress(address),
    address: address || null,
    station: station || null,
    layout: layout || null,
    areaSqm: areaSqm || null,
    rent,
    managementFee,
    constructionYear: constructionYear || null,
    // Money terms (for the move-in estimate) and clauses to check, as read from the sheet.
    costs: result.costs ?? [],
    checks: result.checks ?? [],
    sheet: image ? { image, fields: result.fields, lines: result.lines ?? [] } : null,
    // What the sheet itself says needs checking. "other" warnings are about the reading and are
    // settled when the values are confirmed.
    sheetWarnings: result.warnings.filter((warning) => warning.code !== "other"),
    provenance: {
      mode: result.meta.mode,
      model: result.meta.model,
      documentId: result.documentId,
      extractedAt: result.meta.extractedAt,
      confirmedAt,
      seeded,
      editedFields: EXTRACTION_FIELDS.map(({ key }) => key).filter((key) => values[key] !== result.fields[key].value),
    },
  };
}

/** A candidate from a recorded sheet, with the values checked against the original when it was recorded. */
export const candidateFromSheet = (sheet) =>
  buildCandidate(sheet.reading, sheet.confirmed, sheet.reading.meta.extractedAt, { id: sheet.id, image: sheet.image, seeded: true });
