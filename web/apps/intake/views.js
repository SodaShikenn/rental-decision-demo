// Intake DOM: choose or drop a listing sheet (or the sample sheet), read it, review each field
// against the original, then add it as a candidate. Stages: idle → ready → reading → review (or error).
import { EXTRACTION_ENDPOINT, REVIEW_CONFIDENCE_THRESHOLD } from "../../config.js";
import { $, $$, drawEvidenceCrop, escapeHTML } from "../../helper.js";
import { EXTRACTION_FIELDS, MODE_LABELS, SAMPLE_SHEET, WARNING_LABELS } from "./models.js";
import { IntakeError, buildCandidate, extractionNote, fieldsNeedingReview, prepareImage, requestExtraction } from "./services.js";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const STEPS = ["select", "read", "review", "add"];
const LIVE = Boolean(EXTRACTION_ENDPOINT);

// One upload at a time. requestId lets a new file or a cancel discard a reading still in flight.
// `sample` is the recorded sheet when the preview shows the sample sheet, otherwise null.
const session = { file: null, sample: null, previewUrl: null, result: null, review: new Set(), confirmed: new Set(), requestId: 0 };

// What the extraction server reported (see the capabilities app); "mock" changes the wording.
let serverState = LIVE ? "checking" : "none";
const mockServer = () => serverState === "mock";
const idleLabel = () => (!LIVE ? "記録済みの結果を表示" : mockServer() ? "モックで読み取る" : "OCRとGeminiで読み取る");
// Without a server only the sample sheet can be "read" (from its recording).
const canRead = () => LIVE || Boolean(session.sample);

const EMPTY_STATES = {
  get ready() {
    if (!LIVE && session.sample) return ["記録済みの読み取り結果を表示できます", "解析サーバーが未設定のため、この図面を事前に OCR で読み取った記録を使います。「記録済みの結果を表示」で、原本との照合から候補への追加までを試せます。"];
    if (!LIVE) return ["この画像は読み取れません", "解析サーバーが未設定のため、選んだ画像の内容は読み取りません。「サンプル図面で試す」で、実際の募集図面とその読み取り結果を使って流れを確認できます。"];
    if (mockServer()) return ["読み取りの準備ができました（モック）", "解析サーバーはモックモードです。「モックで読み取る」を押すと、テスト用の固定値が返ります。画像の内容は読み取りません。"];
    return ["読み取りの準備ができました", "「OCRとGeminiで読み取る」を押すと、解析サーバーの OCR が図面の文字を読み取り、Gemini が物件名・賃料・管理費・住所・最寄駅・間取り・面積・竣工年に対応付けます。"];
  },
  get reading() {
    return mockServer()
      ? ["読み取り中です…", "解析サーバー（モック）から固定値を受け取っています。"]
      : ["読み取り中です…", "OCR で図面の文字を読み取り、Gemini が項目に対応付けています。"];
  },
  error: ["読み取れませんでした", "もう一度読み取るか、サンプル図面で流れを確認できます。"],
};

function markStep(current) {
  const index = STEPS.indexOf(current);
  $$("#intakeSteps li").forEach((item, position) => {
    item.dataset.status = position < index ? "done" : position === index ? "current" : "todo";
    if (position === index) item.setAttribute("aria-current", "step");
    else item.removeAttribute("aria-current");
  });
}

function setStage(stage, errorText = "") {
  $("#intake").dataset.state = stage;
  $("#intakeBody").hidden = stage === "idle";
  markStep({ idle: "select", ready: "read", reading: "read", error: "read", review: "review" }[stage]);
  $("#analyzeListing").hidden = !canRead();
  if (stage === "review") return;
  $("#extractionForm").hidden = true;
  $("#extractionEmpty").hidden = false;
  const [title, text] = EMPTY_STATES[stage] ?? ["", ""];
  $("#extractionEmptyTitle").textContent = title;
  $("#extractionEmptyText").textContent = text;
  $("#extractionError").hidden = stage !== "error";
  $("#extractionErrorText").textContent = errorText;
  $("#emptySample").hidden = !(stage === "error" || (stage === "ready" && !canRead()));
}

function confidenceBadge(field) {
  if (field.value === null) return '<span class="confidence is-unknown">未検出</span>';
  const low = field.confidence < REVIEW_CONFIDENCE_THRESHOLD;
  return `<span class="confidence${low ? " is-low" : ""}" title="OCR エンジンが根拠の行につけた信頼度。値が行の文字と一致しない場合は下げています">信頼度 ${Math.round(field.confidence * 100)}%${low ? "（低）" : ""}</span>`;
}

function fieldMarkup({ key, label, type, step, wide }, field) {
  const review = session.review.has(key);
  return `
    <div class="review-field${wide ? " wide" : ""}${review ? " needs-review" : ""}" data-field="${key}">
      <label for="extracted-${key}">${label}</label>
      <input id="extracted-${key}" type="${type}"${step ? ` step="${step}" min="0"` : ""} value="${escapeHTML(field.value ?? "")}"${field.value === null ? ' placeholder="未検出：原本を見て入力"' : ""} />
      <div class="field-meta">
        ${confidenceBadge(field)}
        ${review ? `<label class="confirm-check"><input type="checkbox" data-confirm="${key}" />原本と一致を確認</label>` : ""}
      </div>
      ${field.evidence ? `<canvas class="evidence-crop" data-crop="${key}" role="img" aria-label="${escapeHTML(label)}の根拠となる図面の箇所"></canvas>` : ""}
      ${field.sourceText ? `<p class="source-text">図面の表記（OCR）「${escapeHTML(field.sourceText)}」</p>` : ""}
    </div>`;
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
  const count = $("#extractionReviewLabel");
  $("#confirmExtraction").disabled = pending.length > 0;
  count.textContent = pending.length ? `要確認 残り${pending.length}件` : "すべて確認済み";
  count.className = `review-count ${pending.length ? "is-pending" : "is-done"}`;
  $$(".review-field").forEach((element) => element.classList.toggle("confirmed", session.confirmed.has(element.dataset.field)));
  $("#intakeStatus").textContent = pending.length
    ? `色付きの${pending.length}項目は、信頼度が低い・読み取れない・図面内で食い違いがある項目です。原本と照合して「原本と一致を確認」にチェックするか、値を修正してください。`
    : "要確認の項目はすべて照合済みです。内容を確かめて候補に追加してください。";
  markStep(pending.length ? "review" : "add");
}

function renderExtraction(result) {
  session.result = result;
  session.review = fieldsNeedingReview(result);
  session.confirmed = new Set();
  setStage("review");
  $("#extractionEmpty").hidden = true;
  $("#extractionForm").hidden = false;
  $("#extractionModeLabel").textContent = MODE_LABELS[result.meta.mode];
  $("#extractionNote").textContent = extractionNote(result);
  const grid = $("#extractionGrid");
  grid.innerHTML = EXTRACTION_FIELDS.map((field) => fieldMarkup(field, result.fields[field.key])).join("");
  $$("canvas[data-crop]", grid).forEach((canvas) => drawEvidenceCrop(canvas, $("#listingPreview"), result.fields[canvas.dataset.crop].evidence));
  const warnings = $("#extractionWarnings");
  warnings.innerHTML = result.warnings.map((warning) => `<li><b>${WARNING_LABELS[warning.code] ?? "注意"}</b><span>${escapeHTML(warning.message)}</span></li>`).join("");
  warnings.hidden = result.warnings.length === 0;
  const checks = result.checks ?? [];
  $("#extractionChecks").hidden = checks.length === 0;
  $("#extractionChecks").innerHTML = checks.length
    ? `<p class="review-checks-title">契約前に確認すること（図面から${checks.length}件）</p><p>${checks.map((check) => escapeHTML(check.title)).join("、")}</p><p class="review-checks-note">候補に追加すると、理由と図面の該当箇所、初期費用の内訳を確認できます。</p>`
    : "";
  showEvidence(null);
  updateReviewState();
}

function readExtractedValue({ key, type, allowZero }) {
  const raw = $(`#extracted-${key}`).value.trim();
  if (!raw) return null;
  if (type !== "number") return raw;
  const number = Number(raw);
  return Number.isFinite(number) && (number > 0 || (allowZero && number === 0)) ? number : null;
}

function setMessage(text, { error = false } = {}) {
  const message = $("#intakeMessage");
  message.textContent = text;
  message.classList.toggle("is-error", error);
}

function reset() {
  session.requestId += 1;
  session.file = null;
  session.sample = null;
  session.result = null;
  if (session.previewUrl) URL.revokeObjectURL(session.previewUrl);
  session.previewUrl = null;
  $("#listingPreview").removeAttribute("src");
  showEvidence(null);
  setStage("idle");
}

function acceptFile(file, sample = null) {
  if (!file) return;
  if (!ACCEPTED_TYPES.includes(file.type)) {
    setMessage(`「${file.name}」は読み込めません。PNG・JPEG・WEBP の画像を選んでください。`, { error: true });
    return;
  }
  reset();
  session.file = file;
  session.sample = sample;
  session.previewUrl = URL.createObjectURL(file);
  $("#listingPreview").src = session.previewUrl;
  $("#fileName").textContent = sample
    ? `サンプル図面：${sample.confirmed.propertyName}（実際の募集図面・連絡先は非表示）`
    : `${file.name}（${(file.size / 1024 / 1024).toFixed(1)}MB）· 画像はブラウザ内で表示しています`;
  setMessage("");
  setStage("ready");
  $(canRead() ? "#analyzeListing" : "#emptySample").focus({ preventScroll: true });
}

/** Load the sample sheet as if it had been chosen, so every mode uses the same flow. */
async function loadSample() {
  try {
    const response = await fetch(SAMPLE_SHEET.image);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    acceptFile(new File([blob], SAMPLE_SHEET.image.split("/").pop(), { type: blob.type || "image/jpeg" }), SAMPLE_SHEET);
  } catch {
    setMessage("サンプル図面を読み込めませんでした。ページを再読み込みしてください。", { error: true });
  }
}

export function bindIntake(app) {
  const { store } = app.extensions;
  const intake = $("#intake");
  const upload = $("#listingUpload");
  const preview = $("#listingPreview");
  const analyzeButton = $("#analyzeListing");
  const grid = $("#extractionGrid");
  const applyServerState = () => {
    analyzeButton.textContent = idleLabel();
    $("#privacyNote").textContent = !LIVE
      ? "解析サーバーが未設定のため、画像はどこにも送信しません。"
      : mockServer()
        ? "解析サーバーはモックモードです。画像は解析サーバーに送られますが、Gemini には送信されず、保存もされません。"
        : "「OCRとGeminiで読み取る」を押すと、画像を縮小して解析サーバーに送ります。文字の読み取りはサーバー内で行い、Google の Gemini API には読み取った文字だけを送信します（画像は送信しません）。画像は保存しません。";
    if ($("#intake").dataset.state === "ready") setStage("ready");
  };
  store.on("server-status", (state) => {
    serverState = state;
    applyServerState();
  });
  applyServerState();
  setStage("idle");

  preview.addEventListener("load", () => $("#previewFrame").style.setProperty("--ratio", `${preview.naturalWidth} / ${preview.naturalHeight}`));

  upload.addEventListener("change", () => {
    acceptFile(upload.files[0]);
    upload.value = ""; // allow choosing the same file again to start over
  });
  intake.addEventListener("dragover", (event) => {
    event.preventDefault();
    intake.classList.add("is-dragover");
  });
  intake.addEventListener("dragleave", (event) => {
    if (!intake.contains(event.relatedTarget)) intake.classList.remove("is-dragover");
  });
  intake.addEventListener("drop", (event) => {
    event.preventDefault();
    intake.classList.remove("is-dragover");
    acceptFile(event.dataTransfer.files[0]);
  });

  $("#useSampleSheet").addEventListener("click", loadSample);
  $("#emptySample").addEventListener("click", loadSample);
  $("#cancelIntake").addEventListener("click", () => {
    reset();
    setMessage("");
  });

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

  grid.addEventListener("change", (event) => {
    const key = event.target.dataset.confirm;
    if (!key) return;
    if (event.target.checked) session.confirmed.add(key);
    else session.confirmed.delete(key);
    updateReviewState();
  });
  grid.addEventListener("input", (event) => {
    const key = event.target.closest("[data-field]")?.dataset.field;
    if (!key || !session.review.has(key) || event.target.dataset.confirm) return;
    // Correcting a value against the original counts as confirming it.
    session.confirmed.add(key);
    $(`[data-confirm="${key}"]`, grid).checked = true;
    updateReviewState();
  });
  const fieldKey = (element) => element?.closest("[data-field]")?.dataset.field;
  grid.addEventListener("pointerover", (event) => showEvidence(fieldKey(event.target)));
  grid.addEventListener("focusin", (event) => showEvidence(fieldKey(event.target)));
  grid.addEventListener("pointerleave", () => showEvidence(grid.contains(document.activeElement) ? fieldKey(document.activeElement) : null));

  $("#extractionForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const { result } = session;
    if (!result || [...session.review].some((key) => !session.confirmed.has(key))) return;
    const values = Object.fromEntries(EXTRACTION_FIELDS.map((field) => [field.key, readExtractedValue(field)]));
    // Keep the sheet so the detail panel can show each value's evidence. Mock readings point at the
    // test fixture's text positions, not this image, so they keep none.
    let image = null;
    if (result.meta.mode !== "mock") {
      image = session.sample?.image ?? session.previewUrl;
      if (image === session.previewUrl) session.previewUrl = null; // now owned by the candidate
    }
    const candidate = buildCandidate(result, values, new Date().toISOString(), { image });
    const replaced = store.state.properties.find((property) => property.id === candidate.id)?.sheet?.image;
    if (replaced?.startsWith("blob:")) URL.revokeObjectURL(replaced);
    store.upsertProperty(candidate, { select: true });
    store.emit("added", candidate.id);
    reset();
    setMessage(`「${candidate.name}」を候補に追加しました。図面にない値は未取得として扱います。`);
    $("#shortlistTitle").scrollIntoView({ behavior: "smooth", block: "start" });
  });
}
