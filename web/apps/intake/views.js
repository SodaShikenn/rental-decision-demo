// Intake DOM: a dialog that takes one listing sheet (chosen, dropped on the comparison, or the sample),
// reads it, and asks a person to check the uncertain fields against the original before the sheet
// joins the comparison. Stages: ready → reading → review (or error).
import { EXTRACTION_ENDPOINT, MAX_SHEETS, REVIEW_CONFIDENCE_THRESHOLD } from "../../config.js";
import { $, $$, announce, drawEvidenceCrop, escapeHTML } from "../../helper.js";
import { EXTRACTION_FIELDS, MODE_LABELS, SAMPLE_SHEET, WARNING_LABELS, fieldValueText, shortFieldLabel } from "./models.js";
import { IntakeError, buildPartialCandidate, extractionNote, fieldsNeedingReview, prepareImage, requestExtraction } from "./services.js";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const LIVE = Boolean(EXTRACTION_ENDPOINT);

// One upload at a time. requestId lets a new file or a cancel discard a reading still in flight.
// `sample` is the recorded sheet when the preview shows the sample sheet, otherwise null. `id` is the
// sheet's id in the comparison: the sample keeps its own (adding it again replaces its column), every
// other upload gets a new one.
const session = { id: null, file: null, sample: null, previewUrl: null, result: null, review: new Set(), confirmed: new Set(), requestId: 0 };
let uploads = 0;
let store = null;

// What the extraction server reported (see the capabilities app); it changes the wording.
let serverState = LIVE ? "checking" : "none";
const mockServer = () => serverState === "mock";
const idleLabel = () => (!LIVE ? "記録済みの結果を表示" : mockServer() ? "モックで読み取る" : "候補の情報を取り込む");
// Without a server only the sample sheet can be "read" (from its recording).
const canRead = () => LIVE || Boolean(session.sample);

const NO_SERVER = "解析サーバーが未設定のため、この画像は読み取れません（どこにも送信していません）";

const setTitle = (text) => {
  $("#intakeTitleText").textContent = text;
};

function setStage(stage, errorText = "") {
  const dialog = $("#intakeDialog");
  dialog.dataset.state = stage;
  const review = stage === "review";
  const blocked = stage === "ready" && !canRead();
  $("#extractionForm").hidden = !review;
  $("#analyzeListing").hidden = review || !canRead();
  $("#confirmExtraction").hidden = !review;
  $("#intakeError").hidden = !(stage === "error" || blocked);
  $("#intakeErrorText").textContent = blocked ? NO_SERVER : errorText;
  $("#intakeSample").hidden = !(stage === "error" || blocked);
  if (review) return;
  setTitle("図面から候補を追加");
  $("#intakeStatus").textContent = stage === "reading"
    ? mockServer() ? "読み取り中です…（解析サーバーのモックから固定値を受け取っています）" : "候補の情報を取り込んでいます…"
    : "";
}

function confidenceBadge(field) {
  if (field.value === null) return '<span class="confidence is-unknown">未検出</span>';
  const low = field.confidence < REVIEW_CONFIDENCE_THRESHOLD;
  return `<span class="confidence${low ? " is-low" : ""}" title="OCR エンジンが根拠の行につけた信頼度。値が行の文字と一致しない場合は下げています">信頼度 ${Math.round(field.confidence * 100)}%${low ? "（低）" : ""}</span>`;
}

const inputMarkup = ({ key, type, step }, field) =>
  `<input id="extracted-${key}" type="${type}"${step ? ` step="${step}" min="0"` : ""} value="${escapeHTML(field.value ?? "")}"${field.value === null ? ' placeholder="未検出：原本を見て入力"' : ""} />`;
const evidenceMarkup = ({ key, label }, field) => `
  ${field.evidence ? `<canvas class="evidence-crop" data-crop="${key}" role="img" aria-label="${escapeHTML(label)}の根拠となる図面の箇所"></canvas>` : ""}
  ${field.sourceText ? `<p class="source-text">図面の表記（OCR）「${escapeHTML(field.sourceText)}」</p>` : ""}`;

/** A field to check against the original: input, confidence, confirmation, crop, and OCR text. */
function cardMarkup(definition, field) {
  const { key, label, wide } = definition;
  return `
    <div class="review-field needs-review${wide ? " wide" : ""}" data-field="${key}">
      <label for="extracted-${key}">${label}</label>
      ${inputMarkup(definition, field)}
      <div class="field-meta">
        <span class="confidence is-low">未確認</span>
        <label class="confirm-check"><input type="checkbox" data-confirm="${key}" />原本と一致を確認</label>
      </div>
      <details class="review-about"><summary>元の図面を確認</summary>${evidenceMarkup(definition, field)}</details>
    </div>`;
}

/** A field read with enough confidence: label and value, with 編集 to correct it. */
function summaryMarkup({ key, label }, field) {
  return `
    <div class="summary-row" data-field="${key}">
      <dt>${shortFieldLabel(key)}</dt>
      <dd><span class="summary-value">${escapeHTML(fieldValueText(key, field.value))}</span><button class="summary-edit" type="button" data-edit="${key}" aria-label="${escapeHTML(label)}を編集">編集</button></dd>
    </div>`;
}

function drawCrops(root) {
  const image = $("#listingPreview");
  if (!image.naturalWidth) return; // drawn when the preview has loaded
  $$("canvas[data-crop]:not([data-drawn])", root).forEach((canvas) => {
    drawEvidenceCrop(canvas, image, session.result.fields[canvas.dataset.crop].evidence);
    canvas.dataset.drawn = "";
  });
}

function showEvidence(key) {
  const highlight = $("#evidenceHighlight");
  const box = key ? session.result?.fields[key]?.evidence : null;
  highlight.hidden = !box;
  if (!box) return;
  const [x, y, w, h] = box;
  Object.assign(highlight.style, { left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%` });
}

function updateReviewState() {
  const pending = [...session.review].filter((key) => !session.confirmed.has(key));
  const button = $("#confirmExtraction");
  button.disabled = false;
  button.title = "未確認の項目は未取得のまま追加できます";
  button.textContent = pending.length ? "未確認のまま比較に加える" : "比較に加える";
  setTitle("候補の情報");
  $$(".review-field").forEach((element) => element.classList.toggle("confirmed", session.confirmed.has(element.dataset.field)));
  $("#intakeStatus").textContent = pending.length
    ? `${pending.length}項目は確認が必要です。今は空欄のまま比較に加えられます。入力や確認は後からでもできます。`
    : "この情報で比較を始められます。必要に応じて編集してください。";
}

function renderExtraction(result) {
  session.result = result;
  session.review = fieldsNeedingReview(result);
  session.confirmed = new Set();
  setStage("review");
  $("#extractionModeLabel").textContent = MODE_LABELS[result.meta.mode];
  $("#extractionNote").textContent = extractionNote(result);
  const flagged = EXTRACTION_FIELDS.filter(({ key }) => session.review.has(key));
  const settled = EXTRACTION_FIELDS.filter(({ key }) => !session.review.has(key));
  const grid = $("#extractionGrid");
  grid.innerHTML = flagged.map((field) => cardMarkup(field, result.fields[field.key])).join("");
  grid.hidden = flagged.length === 0;
  const summary = $("#extractionSummary");
  summary.innerHTML = settled.map((field) => summaryMarkup(field, result.fields[field.key])).join("");
  summary.hidden = settled.length === 0;
  drawCrops(grid);
  const warnings = $("#extractionWarnings");
  warnings.innerHTML = result.warnings.map((warning) => `<li><b>${WARNING_LABELS[warning.code] ?? "注意"}</b><span>${escapeHTML(warning.message)}</span></li>`).join("");
  warnings.hidden = result.warnings.length === 0;
  const checks = result.checks ?? [];
  $("#extractionChecks").hidden = checks.length === 0;
  $("#extractionChecks").textContent = checks.length ? `契約前の確認 ${checks.length}件（追加後に表を参照）` : "";
  showEvidence(null);
  updateReviewState();
  $("#confirmExtraction").focus({ preventScroll: true });
}

/** Turn a settled row into an input, with its crop, so a misreading can still be corrected. */
function editField(key) {
  const definition = EXTRACTION_FIELDS.find((field) => field.key === key);
  const field = session.result.fields[key];
  const row = $(`#extractionSummary [data-field="${key}"]`);
  row.classList.add("is-editing");
  row.innerHTML = `
    <dt><label for="extracted-${key}">${definition.label}</label></dt>
    <dd>${inputMarkup(definition, field)}<span class="field-meta">${confidenceBadge(field)}</span>${evidenceMarkup(definition, field)}</dd>`;
  drawCrops(row);
  $(`#extracted-${key}`).focus();
}

function readExtractedValue({ key, type, allowZero }) {
  const input = $(`#extracted-${key}`);
  if (!input) return session.result.fields[key].value; // settled and not edited
  const raw = input.value.trim();
  if (!raw) return null;
  if (type !== "number") return raw;
  const number = Number(raw);
  return Number.isFinite(number) && (number > 0 || (allowZero && number === 0)) ? number : null;
}

function reset() {
  session.requestId += 1;
  Object.assign(session, { id: null, file: null, sample: null, result: null });
  if (session.previewUrl) URL.revokeObjectURL(session.previewUrl);
  session.previewUrl = null;
  $("#listingPreview").removeAttribute("src");
  $("#extractionGrid").innerHTML = "";
  $("#extractionSummary").innerHTML = "";
  showEvidence(null);
}

/** Open the dialog on one image. `sample` is the recorded sheet when the image is the sample sheet. */
export function acceptFile(file, sample = null) {
  if (!file || !store) return;
  if (!ACCEPTED_TYPES.includes(file.type)) {
    announce(`「${file.name}」は読み込めません。PNG・JPEG・WEBP の画像を選んでください。`, { error: true });
    return;
  }
  const { properties } = store.state;
  const replacing = sample && properties.some((property) => property.id === sample.id);
  if (properties.length >= MAX_SHEETS && !replacing) {
    announce(`比べられるのは${MAX_SHEETS}件までです。どれかを外してから加えてください。`, { error: true });
    return;
  }
  reset();
  session.id = sample ? sample.id : `upload-${++uploads}`;
  session.file = file;
  session.sample = sample;
  session.previewUrl = URL.createObjectURL(file);
  $("#listingPreview").src = session.previewUrl;
  $("#fileName").textContent = sample
    ? `サンプル図面：${sample.confirmed.propertyName}（実際の募集図面・連絡先は非表示）`
    : `${file.name}（${(file.size / 1024 / 1024).toFixed(1)}MB）· 画像はブラウザ内で表示しています`;
  announce("");
  setStage("ready");
  const dialog = $("#intakeDialog");
  if (!dialog.open) dialog.showModal();
  $(canRead() ? "#analyzeListing" : "#intakeSample").focus();
}

/** Open the sample sheet as if it had been chosen, so every mode uses the same flow. */
export async function loadSample() {
  try {
    const response = await fetch(SAMPLE_SHEET.image);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    acceptFile(new File([blob], SAMPLE_SHEET.image.split("/").pop(), { type: blob.type || "image/jpeg" }), SAMPLE_SHEET);
  } catch {
    announce("サンプル図面を読み込めませんでした。ページを再読み込みしてください。", { error: true });
  }
}

export function bindIntake(app) {
  store = app.extensions.store;
  const dialog = $("#intakeDialog");
  const upload = $("#listingUpload");
  const preview = $("#listingPreview");
  const analyzeButton = $("#analyzeListing");
  const form = $("#extractionForm");

  const applyServerState = () => {
    analyzeButton.textContent = idleLabel();
    $("#privacyNote").textContent = !LIVE
      ? "解析サーバーが未設定のため、画像はどこにも送信しません。"
      : mockServer()
        ? "解析サーバーはモックモードです。画像は解析サーバーに送られますが、Gemini には送信されず、保存もされません。"
        : "「候補の情報を取り込む」を押すと、画像を縮小して解析サーバーに送ります。文字の読み取りはサーバー内で行い、Google の Gemini API には読み取った文字だけを送信します（画像は送信しません）。画像は保存しません。";
    if (dialog.open && dialog.dataset.state === "ready") setStage("ready");
  };
  store.on("server-status", (state) => {
    serverState = state;
    applyServerState();
  });
  applyServerState();
  setStage("ready");

  preview.addEventListener("load", () => {
    $("#previewFrame").style.setProperty("--ratio", `${preview.naturalWidth} / ${preview.naturalHeight}`);
    if (session.result) drawCrops(form);
  });
  upload.addEventListener("change", () => {
    acceptFile(upload.files[0]);
    upload.value = ""; // allow choosing the same file again
  });
  $("#useSampleSheet").addEventListener("click", loadSample);
  $("#intakeSample").addEventListener("click", loadSample);
  $("#cancelIntake").addEventListener("click", () => dialog.close());
  // Closing the dialog any way (取り消す, Escape, or after adding) discards the session; an image a new
  // column now shows was handed over before closing, so it is not revoked here.
  dialog.addEventListener("close", reset);

  analyzeButton.addEventListener("click", async () => {
    if (!LIVE) {
      if (session.sample) renderExtraction(session.sample.reading);
      return;
    }
    const requestId = ++session.requestId;
    analyzeButton.disabled = true;
    analyzeButton.textContent = "読み取り中…";
    setStage("reading");
    try {
      const { blob, name } = await prepareImage(session.file);
      const result = await requestExtraction(EXTRACTION_ENDPOINT, blob, name);
      await preview.decode().catch(() => {});
      if (requestId !== session.requestId) return;
      renderExtraction(result);
    } catch (error) {
      if (requestId !== session.requestId) return;
      setStage("error", error instanceof IntakeError ? error.message : "画像を処理できませんでした。別の画像でお試しください。");
    } finally {
      analyzeButton.disabled = false;
      analyzeButton.textContent = idleLabel();
    }
  });

  form.addEventListener("change", (event) => {
    const key = event.target.dataset.confirm;
    if (!key) return;
    if (event.target.checked) session.confirmed.add(key);
    else session.confirmed.delete(key);
    updateReviewState();
  });
  form.addEventListener("input", (event) => {
    const key = event.target.closest("[data-field]")?.dataset.field;
    if (!key || !session.review.has(key) || event.target.dataset.confirm) return;
    // Correcting a value against the original counts as confirming it.
    session.confirmed.add(key);
    $(`[data-confirm="${key}"]`, form).checked = true;
    updateReviewState();
  });
  form.addEventListener("click", (event) => {
    const edit = event.target.closest("[data-edit]");
    if (edit) editField(edit.dataset.edit);
  });
  const fieldKey = (element) => element?.closest("[data-field]")?.dataset.field;
  form.addEventListener("pointerover", (event) => showEvidence(fieldKey(event.target)));
  form.addEventListener("focusin", (event) => showEvidence(fieldKey(event.target)));
  form.addEventListener("pointerleave", () => showEvidence(form.contains(document.activeElement) ? fieldKey(document.activeElement) : null));

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const { result } = session;
    if (!result) return;
    const values = Object.fromEntries(EXTRACTION_FIELDS.map((field) => [field.key, readExtractedValue(field)]));
    // Keep the sheet so each value can be shown next to its evidence. Mock readings point at the test
    // fixture's text positions, not this image, so they keep none.
    let image = null;
    if (result.meta.mode !== "mock") {
      image = session.sample?.image ?? session.previewUrl;
      if (image === session.previewUrl) session.previewUrl = null; // now owned by the new column
    }
    const candidate = buildPartialCandidate(result, values, session.confirmed, { id: session.id, image });
    // Close first: closing a modal dialog returns focus to where it was opened from, and focus
    // belongs on the new column.
    dialog.close();
    store.upsertProperty(candidate);
    store.emit("added", candidate.id);
    announce(`${candidate.name} を加えました`);
  });
}
