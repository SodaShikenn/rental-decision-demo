// Intake DOM: upload and preview, the extraction review form, evidence crops, and submission.
import { EXTRACTION_ENDPOINT, REVIEW_CONFIDENCE_THRESHOLD } from "../../config.js";
import { $, $$, escapeHTML } from "../../helper.js";
import { EXTRACTION_FIELDS, MODE_LABELS, SAMPLE_EXTRACTION, WARNING_LABELS } from "./models.js";
import { IntakeError, buildCandidate, extractionNote, fieldsNeedingReview, prepareImage, requestExtraction } from "./services.js";

// One upload at a time. requestId lets a new file cancel a reading still in flight.
const session = { file: null, previewUrl: null, result: null, review: new Set(), confirmed: new Set(), requestId: 0 };

function fieldMarkup({ key, label, type, step, wide }, field, mode) {
  const review = session.review.has(key);
  let badge = '<span class="field-badge">SAMPLE</span>';
  if (mode !== "sample") {
    badge = field.value === null
      ? '<span class="field-badge unknown">未検出</span>'
      : `<span class="field-badge${field.confidence < REVIEW_CONFIDENCE_THRESHOLD ? " low" : ""}" title="モデルの自己申告値（未較正）">信頼度 ${Math.round(field.confidence * 100)}%</span>`;
  }
  return `
    <div class="extraction-field${wide ? " wide" : ""}${review ? " needs-review" : ""}" data-field="${key}">
      <label for="extracted-${key}">${label}</label>
      <input id="extracted-${key}" type="${type}"${step ? ` step="${step}" min="0"` : ""} value="${escapeHTML(field.value ?? "")}"${field.value === null ? ' placeholder="未検出"' : ""} />
      <div class="field-meta">
        ${badge}
        ${review ? `<label class="confirm-check"><input type="checkbox" data-confirm="${key}" /> 原本と照合済み</label>` : ""}
      </div>
      ${field.evidence ? `<canvas class="evidence-crop" data-crop="${key}" role="img" aria-label="${escapeHTML(label)}の根拠領域"></canvas>` : ""}
      ${field.sourceText ? `<p class="source-text">原文「${escapeHTML(field.sourceText)}」</p>` : ""}
    </div>`;
}

/** Draw the evidence region, with a little context, from the local preview image. */
function drawEvidenceCrop(canvas, image, [x, y, w, h]) {
  const padX = 0.006;
  const padY = 0.004;
  const sx = Math.max(0, (x - padX) * image.naturalWidth);
  const sy = Math.max(0, (y - padY) * image.naturalHeight);
  const sw = Math.min(image.naturalWidth - sx, (w + padX * 2) * image.naturalWidth);
  const sh = Math.min(image.naturalHeight - sy, (h + padY * 2) * image.naturalHeight);
  const scale = Math.min(1, 640 / sw);
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  canvas.getContext("2d").drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
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
  const sample = session.result.meta.mode === "sample";
  $("#confirmExtraction").disabled = pending.length > 0;
  $("#extractionReviewLabel").textContent = sample ? "要原本確認" : pending.length ? `要確認 ${pending.length}件` : "照合済み";
  $$(".extraction-field").forEach((element) => element.classList.toggle("confirmed", session.confirmed.has(element.dataset.field)));
  let status = "サンプル抽出値を表示しています。黄色い募集図面の原本と照合し、必要に応じて修正してください。";
  if (!sample) {
    status = pending.length
      ? `${EXTRACTION_FIELDS.length}項目を読み取りました。色付きの${pending.length}項目は原本と照合し、チェックを入れるか値を修正してください。`
      : "要確認項目はすべて照合済みです。内容を確認して候補に追加できます。";
  }
  $("#intakeStatus").textContent = status;
}

function renderExtraction(result) {
  session.result = result;
  session.review = fieldsNeedingReview(result);
  session.confirmed = new Set();
  const { mode } = result.meta;
  $("#extractionModeLabel").textContent = MODE_LABELS[mode];
  $("#extractionNote").textContent = extractionNote(result);
  const grid = $("#extractionGrid");
  grid.innerHTML = EXTRACTION_FIELDS.map((field) => fieldMarkup(field, result.fields[field.key], mode)).join("");
  $$("canvas[data-crop]", grid).forEach((canvas) => drawEvidenceCrop(canvas, $("#listingPreview"), result.fields[canvas.dataset.crop].evidence));
  const warnings = $("#extractionWarnings");
  warnings.innerHTML = result.warnings.map((warning) => `<li><b>${WARNING_LABELS[warning.code] ?? "注意"}</b>${escapeHTML(warning.message)}</li>`).join("");
  warnings.hidden = result.warnings.length === 0;
  showEvidence(null);
  updateReviewState();
  $("#extractionEmpty").hidden = true;
  $("#extractionForm").hidden = false;
}

function setEmptyState(kind, text = "") {
  const title = $("#extractionEmptyTitle");
  const body = $("#extractionEmptyText");
  $("#extractionForm").hidden = true;
  $("#extractionEmpty").hidden = false;
  $("#extractionError").hidden = kind !== "error";
  if (kind === "busy") {
    title.textContent = "読み取り中です…";
    body.textContent = "Claudeが募集図面を解析しています。数十秒かかる場合があります。";
  } else if (kind === "error") {
    title.textContent = "読み取れませんでした。";
    body.textContent = "もう一度読み取るか、サンプル値で流れを確認できます。";
    $("#extractionErrorText").textContent = text;
  } else {
    title.innerHTML = "解析後、抽出項目を<br />原本と照合します。";
    body.textContent = "物件名、賃料、住所、最寄駅、間取り、面積、竣工年を表示し、誤読を修正してから候補へ追加します。";
  }
}

function readExtractedValue(key) {
  const input = $(`#extracted-${key}`);
  const raw = input.value.trim();
  if (!raw) return null;
  if (input.type !== "number") return raw;
  const number = Number(raw);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function bindIntake(app) {
  const { store } = app.extensions;
  const upload = $("#listingUpload");
  const preview = $("#listingPreview");
  const frame = $("#previewFrame");
  const analyzeButton = $("#analyzeListing");
  const grid = $("#extractionGrid");
  const message = $("#intakeMessage");
  const live = Boolean(EXTRACTION_ENDPOINT);
  const idleLabel = live ? "Claudeで読み取る →" : "画像を読み取る →";

  analyzeButton.textContent = idleLabel;
  if (live) {
    $("#privacyNote").textContent =
      "「Claudeで読み取る」を押すと、画像を縮小して解析サーバー経由でAnthropic社のClaude APIへ送信します。解析サーバーは画像を保存しません（Anthropic社のAPIデータ取扱方針が適用されます）。";
  }

  preview.addEventListener("load", () => frame.style.setProperty("--ratio", `${preview.naturalWidth} / ${preview.naturalHeight}`));

  upload.addEventListener("change", () => {
    const [file] = upload.files;
    if (!file) return;
    session.requestId += 1; // ignore any reading still in flight for the previous image
    session.file = file;
    session.result = null;
    if (session.previewUrl) URL.revokeObjectURL(session.previewUrl);
    session.previewUrl = URL.createObjectURL(file);
    preview.src = session.previewUrl;
    frame.hidden = false;
    $("#uploadPlaceholder").hidden = true;
    showEvidence(null);
    setEmptyState("idle");
    analyzeButton.disabled = false;
    analyzeButton.textContent = idleLabel;
    message.textContent = `${file.name} をブラウザ内で読み込みました。`;
    upload.value = ""; // allow choosing the same file again to start over
  });

  analyzeButton.addEventListener("click", async () => {
    if (!live) {
      renderExtraction(SAMPLE_EXTRACTION);
      message.textContent = "抽出結果は未確定です。確認後に候補へ追加できます。";
      return;
    }
    const requestId = ++session.requestId;
    analyzeButton.disabled = true;
    analyzeButton.textContent = "読み取り中…";
    setEmptyState("busy");
    message.textContent = "";
    try {
      const { blob, name } = await prepareImage(session.file);
      const result = await requestExtraction(EXTRACTION_ENDPOINT, blob, name);
      await preview.decode().catch(() => {});
      if (requestId !== session.requestId) return;
      renderExtraction(result);
      message.textContent = result.meta.mode === "mock"
        ? "モック応答を表示しています。画像の内容は解析していません。"
        : "読み取り結果は未確定です。要確認項目を原本と照合してください。";
    } catch (error) {
      if (requestId !== session.requestId) return;
      setEmptyState("error", error instanceof IntakeError ? error.message : "画像を処理できませんでした。別の画像でお試しください。");
    } finally {
      if (requestId === session.requestId) {
        analyzeButton.disabled = false;
        analyzeButton.textContent = idleLabel;
      }
    }
  });

  $("#useSampleExtraction").addEventListener("click", () => {
    renderExtraction(SAMPLE_EXTRACTION);
    message.textContent = "サンプル値を表示しています。画像の内容とは関係ありません。";
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
    const values = Object.fromEntries(EXTRACTION_FIELDS.map(({ key }) => [key, readExtractedValue(key)]));
    const candidate = buildCandidate(result, values, new Date().toISOString());
    store.upsertProperty(candidate, { select: true });
    message.textContent = `${candidate.name}を暫定候補に追加しました。未取得項目は順位上で明示しています。`;
    $(".workspace").scrollIntoView({ behavior: "smooth", block: "start" });
  });
}
