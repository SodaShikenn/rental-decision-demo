// Intake logic (≈ services.py): image preparation, the extraction request, review rules, and
// turning a confirmed reading into a candidate. Importing this module has no side effects,
// so the pure functions are unit-tested in web/tests.
import { EXTRACTION_TIMEOUT_MS, MAX_IMAGE_EDGE, MAX_VISUAL_TOKENS, REVIEW_CONFIDENCE_THRESHOLD, UPLOAD_MAX_BYTES } from "../../config.js";
import { formatTime } from "../../helper.js";
import { EXTRACTION_FIELDS, fieldLabel, isExtractionResult } from "./models.js";

export class IntakeError extends Error {}

/** Round half to even, matching the API's resize rule at exact .5 ties. */
export function roundTiesToEven(value) {
  const floor = Math.floor(value);
  if (value - floor !== 0.5) return Math.round(value);
  return floor % 2 === 0 ? floor : floor + 1;
}

/** The largest aspect-preserving size Claude accepts without resizing (reference rule from the vision docs). */
export function resizedSize(width, height, maxEdge = MAX_IMAGE_EDGE, maxTokens = MAX_VISUAL_TOKENS) {
  const fits = (w, h) => Math.ceil(w / 28) * 28 <= maxEdge && Math.ceil(h / 28) * 28 <= maxEdge && Math.ceil(w / 28) * Math.ceil(h / 28) <= maxTokens;
  if (fits(width, height)) return [width, height];
  if (height > width) {
    const [resizedH, resizedW] = resizedSize(height, width, maxEdge, maxTokens);
    return [resizedW, resizedH];
  }
  const aspectRatio = width / height;
  let lo = 1;
  let hi = width;
  while (lo + 1 < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (fits(mid, Math.max(roundTiesToEven(mid / aspectRatio), 1))) lo = mid;
    else hi = mid;
  }
  return [lo, Math.max(roundTiesToEven(lo / aspectRatio), 1)];
}

/**
 * Shrink the image to fit the model's limits (browser only). PNG and WEBP that already fit are sent
 * unchanged; everything else is redrawn as JPEG, which also bakes in any EXIF rotation so the server
 * and the preview see the same pixels.
 */
export async function prepareImage(file) {
  const bitmap = await createImageBitmap(file);
  try {
    const [width, height] = resizedSize(bitmap.width, bitmap.height);
    const unchanged = width === bitmap.width && height === bitmap.height;
    if (unchanged && file.size <= UPLOAD_MAX_BYTES && ["image/png", "image/webp"].includes(file.type)) return { blob: file, name: file.name };
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise((resolve, reject) => canvas.toBlob((result) => (result ? resolve(result) : reject(new Error("encode"))), "image/jpeg", 0.92));
    return { blob, name: `${file.name.replace(/\.[^.]+$/, "")}.jpg` };
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

/** Fields a person must confirm before the reading can affect ranking. Sample readings are not gated. */
export function fieldsNeedingReview(result, threshold = REVIEW_CONFIDENCE_THRESHOLD) {
  if (result.meta.mode === "sample") return new Set();
  const flagged = new Set(result.warnings.flatMap((warning) => warning.fields));
  EXTRACTION_FIELDS.forEach(({ key }) => {
    const { value, confidence } = result.fields[key];
    if (value === null || confidence === null || confidence < threshold) flagged.add(key);
  });
  return flagged;
}

export const extractionNote = (result) => ({
  sample: "現在はこの形式を想定した固定サンプル値です。画像の内容は読み取っていません。解析サーバー（server/）を設定すると、Claudeによる読み取り結果・信頼度・根拠領域を表示します。",
  mock: "解析サーバーのモック応答です（テスト用の架空図面に対応する固定値）。アップロードした画像は読み取っていません。",
  live: `${result.meta.model} による読み取り結果です。信頼度はモデルの自己申告で較正されていません。根拠領域は目安です。色付きの項目は原本と照合してから追加してください。`,
})[result.meta.mode];

export function provenanceText(provenance) {
  const method = {
    sample: "サンプル値（画像は未解析）",
    mock: "モック応答（画像は未解析）",
    live: `Claude抽出（${provenance.model}）`,
  }[provenance.mode];
  const times = provenance.extractedAt
    ? `抽出 ${formatTime(provenance.extractedAt)}・確認 ${formatTime(provenance.confirmedAt)}`
    : `確認 ${formatTime(provenance.confirmedAt)}`;
  const edits = provenance.editedFields.length ? ` / 人が修正: ${provenance.editedFields.map(fieldLabel).join("・")}` : "";
  return `募集図面画像 / ${method}・人が確認 / ${times}${edits}`;
}

/**
 * Build a provisional candidate from a confirmed reading. `values` are what the person confirmed
 * (null for unknown); any difference from the reading is recorded as a human edit.
 */
export function buildCandidate(result, values, confirmedAt) {
  const { propertyName, rent, address, station, layout, areaSqm, constructionYear } = values;
  const district = address?.match(/東京都([^区]+区)/)?.[1] || "所在地要確認";
  return {
    id: "uploaded-listing",
    name: propertyName || "名称未取得の物件",
    area: `${district} / ${layout || "間取り要確認"} / ${areaSqm ? `${areaSqm}㎡` : "面積要確認"}`,
    rent,
    commute: null,
    late: null,
    quiet: null,
    space: null,
    weekend: null,
    enriched: false,
    route: "経路API接続後に計算",
    tags: [station || "最寄駅要確認", constructionYear ? `${constructionYear}年竣工` : "竣工年要確認", result.meta.mode === "live" ? "画像から抽出" : "サンプル値"],
    tradeoff: `${rent === null ? "賃料が未取得のため、予算評価は中立値で仮置きしています。" : ""}画像の読み取り結果を原本と照合し、Routes APIとPlaces APIで通勤・周辺施設を補完する必要があります。`,
    hasRentHistory: false,
    rents: [],
    reviews: [],
    provenance: {
      mode: result.meta.mode,
      model: result.meta.model,
      documentId: result.documentId,
      extractedAt: result.meta.extractedAt,
      confirmedAt,
      editedFields: EXTRACTION_FIELDS.map(({ key }) => key).filter((key) => values[key] !== result.fields[key].value),
    },
  };
}
