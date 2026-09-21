const properties = [
  {
    id: "kiyosumi",
    name: "清澄白河リバーサイド",
    area: "江東区 / 1LDK / 36.8㎡",
    rent: 129000,
    commute: 31,
    grocery: 4,
    late: 8,
    quiet: 7,
    space: 7,
    weekend: 6,
    route: "清澄白河 → 虎ノ門ヒルズ / 乗換1回",
    tags: ["夜22時までのスーパー", "川沿いの静けさ", "自宅作業向き"],
    tradeoff: "駅まで11分。雨の日の徒歩負担は内見で要確認です。",
    rents: [121, 121, 123, 122, 124, 125, 126, 126, 127, 128, 128, 129],
    reviews: [
      { from: "2024年入居 / 30代", text: "平日夜の買い物がしやすく、在宅勤務の日も過ごしやすい。" },
      { from: "2023年入居 / 20代", text: "川沿いは静かだが、駅からの道は夜に一度確認した方がよい。" },
    ],
  },
  {
    id: "musashi",
    name: "武蔵小山ワークス",
    area: "品川区 / 1DK / 31.2㎡",
    rent: 143000,
    commute: 27,
    grocery: 9,
    late: 9,
    quiet: 5,
    space: 6,
    weekend: 8,
    route: "武蔵小山 → 虎ノ門ヒルズ / 乗換1回",
    tags: ["商店街が近い", "短い通勤", "夜の選択肢が多い"],
    tradeoff: "通勤と買い物は最良ですが、予算を13,000円超えます。",
    rents: [136, 137, 137, 138, 138, 140, 140, 141, 142, 142, 143, 143],
    reviews: [
      { from: "2025年入居 / 20代", text: "帰宅が遅くても食事や日用品に困らない。週末は人通りが多い。" },
      { from: "2023年入居 / 30代", text: "駅周辺は便利。静けさを優先する場合は部屋の向きが重要。" },
    ],
  },
  {
    id: "koenji",
    name: "高円寺サイドノート",
    area: "杉並区 / 1DK / 34.1㎡",
    rent: 116000,
    commute: 45,
    grocery: 8,
    late: 7,
    quiet: 6,
    space: 8,
    weekend: 9,
    route: "高円寺 → 虎ノ門ヒルズ / 乗換2回",
    tags: ["予算に余裕", "作業空間が広い", "週末の外出に便利"],
    tradeoff: "家賃には余裕がありますが、平日朝の通勤時間が長めです。",
    rents: [110, 111, 111, 112, 113, 113, 114, 114, 115, 115, 116, 116],
    reviews: [
      { from: "2024年入居 / 20代", text: "部屋の形が使いやすく、休日に外出する人には便利。" },
      { from: "2022年入居 / 30代", text: "都心通勤は混雑時間を避けられる働き方なら許容しやすい。" },
    ],
  },
];

const state = {
  budget: 130000,
  priorities: new Set(["commute", "late"]),
  weekend: true,
  selectedId: "kiyosumi",
};

const yen = (value) => new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(value);
const byId = (id) => properties.find((property) => property.id === id);
const escapeHTML = (value) => String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);

function budgetScore(rent) {
  // Unknown rent is neither affordable nor expensive: score the midpoint and keep the candidate provisional.
  if (rent == null) return 12.5;
  return rent <= state.budget ? 25 : Math.max(0, 25 - (rent - state.budget) / 700);
}

function scoreProperty(property) {
  const commuteValue = property.enriched === false ? 5 : Math.max(0, 10 - Math.max(0, property.commute - 20) / 3);
  let score = budgetScore(property.rent) + commuteValue * 1.2;
  state.priorities.forEach((priority) => {
    const value = priority === "commute" ? commuteValue : (property[priority] ?? 5);
    score += value * 2.5;
  });
  if (state.weekend) score += (property.weekend ?? 5) * 0.6;
  return Math.round(Math.min(99, score));
}

function rankedProperties() {
  return [...properties].sort((a, b) => scoreProperty(b) - scoreProperty(a));
}

function renderCandidates() {
  const ranked = rankedProperties();
  const candidateGrid = document.querySelector("#candidateGrid");
  candidateGrid.innerHTML = ranked.map((property, index) => {
    const provisional = property.enriched === false;
    return `
      <button type="button" class="candidate ${property.id === state.selectedId ? "selected" : ""}" data-property="${escapeHTML(property.id)}">
        <span class="candidate-rank">${String(index + 1).padStart(2, "0")}</span><span class="candidate-score">${provisional ? "暫定 " : ""}${scoreProperty(property)} / 99</span>
        <h3>${escapeHTML(property.name)}</h3>
        <p class="area">${escapeHTML(property.area)}</p>
        <p class="rent">${property.rent == null ? "賃料 未取得" : `${yen(property.rent)} <small>/ 月</small>`}</p>
        <div class="candidate-stats">
          <span>通勤<b>${provisional ? "未取得" : `${property.commute}分`}</b></span>
          <span>周辺情報<b>${provisional ? "未取得" : `${property.late}/10`}</b></span>
        </div>
      </button>
    `;
  }).join("");

  candidateGrid.querySelectorAll("[data-property]").forEach((element) => element.addEventListener("click", () => selectProperty(element.dataset.property)));
  document.querySelector("#decisionSummary").textContent = `予算 ${yen(state.budget)} / ${[...state.priorities].map(priorityLabel).join("・")} を優先中`;
  document.querySelector("#shortlistCount").textContent = String(properties.length).padStart(2, "0");
}

function priorityLabel(key) {
  return ({ commute: "短い通勤", late: "夜の買い物", quiet: "静けさ", space: "作業空間" })[key];
}

function renderSelected() {
  const property = byId(state.selectedId);
  const provisional = property.enriched === false;
  const activePriorities = [...state.priorities];
  const priorityDetails = activePriorities.map((priority) => {
    if (priority === "commute") return `通勤 ${property.commute}分`;
    if (priority === "late") return `夜の買い物利便性 ${property.late}/10`;
    if (priority === "quiet") return `静けさ ${property.quiet}/10`;
    return `作業空間 ${property.space}/10`;
  }).join("、");
  const priorityNames = activePriorities.map(priorityLabel).join("・");
  const fitText = provisional
    ? `募集図面で確認した項目（賃料・間取りなど）のみで暫定評価しています。「${priorityNames}」の実測データは未取得です。`
    : `優先した「${priorityNames}」では、${priorityDetails}です。`;
  const whyText = provisional
    ? `${property.rent == null ? "賃料未取得" : yen(property.rent)}、${escapeHTML(property.area)}を原本確認用の候補情報として追加しました。`
    : `${property.tags.map(escapeHTML).join("、")}は、現在の暮らし方と合う要素です。`;
  document.querySelector("#selectedCard").innerHTML = `
    <p class="eyebrow">CURRENTLY SELECTED / ${String(rankedProperties().findIndex((item) => item.id === property.id) + 1).padStart(2, "0")}</p>
    <h3>${escapeHTML(property.name)}</h3>
    <p>${escapeHTML(property.route)}</p>
    <div class="reason-list">
      <div class="reason"><b>FIT</b><span>${fitText}</span></div>
      <div class="reason"><b>WHY</b><span>${whyText}</span></div>
      <div class="reason"><b>CHECK</b><span>${escapeHTML(property.tradeoff)}</span></div>
      ${property.provenance ? `<div class="reason"><b>SOURCE</b><span>${escapeHTML(provenanceText(property.provenance))}</span></div>` : ""}
    </div>
  `;
  renderChart(property);
  document.querySelector("#chartTitle").textContent = provisional ? `${property.name}｜賃料履歴は未取得` : `${property.name}｜掲載賃料の推移`;
  document.querySelector("#chartPeriod").textContent = provisional ? "現在の募集賃料のみ" : "過去12か月の掲載賃料";
  document.querySelector("#chartFootnote").textContent = provisional
    ? "掲載・成約履歴の提供元へ接続するまで、推移は評価に使用しません。"
    : "掲載価格の推移を想定したデモデータです。実取引賃料ではありません。";
  document.querySelector("#reviewCount").textContent = `${property.reviews.length} 件`;
  document.querySelector("#reviews").innerHTML = property.reviews.length
    ? property.reviews.map((review) => `
      <div class="review"><div class="review-meta"><span>${escapeHTML(review.from)}</span><span>DEMO</span></div><span>${escapeHTML(review.text)}</span></div>
    `).join("")
    : '<div class="empty-data">再利用許諾済みの居住者レビューは未取得です。</div>';
}

function renderChart(property) {
  if (property.hasRentHistory === false) {
    document.querySelector("#rentChart").innerHTML = '<div class="empty-data">画像から確認できるのは現在の募集賃料のみです。履歴データの接続が必要です。</div>';
    return;
  }
  const values = property.rents;
  const min = Math.min(...values) - 2;
  const max = Math.max(...values) + 2;
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * 100;
    const y = 92 - ((value - min) / (max - min)) * 78;
    return `${x},${y}`;
  }).join(" ");
  document.querySelector("#rentChart").innerHTML = `
    <svg class="chart-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <polyline fill="none" stroke="#195c43" stroke-width="2.4" vector-effect="non-scaling-stroke" points="${points}" />
      <circle cx="100" cy="${points.split(" ").at(-1).split(",")[1]}" r="2.8" fill="#d8f64b" stroke="#195c43" vector-effect="non-scaling-stroke" />
    </svg>`;
}

function selectProperty(id) {
  state.selectedId = id;
  renderCandidates();
  renderSelected();
}

function recalculate() {
  const best = rankedProperties()[0];
  state.selectedId = best.id;
  renderCandidates();
  renderSelected();
  addMessage("assistant", `条件を更新しました。<strong>${escapeHTML(best.name)}</strong>が最有力です。${escapeHTML(best.tradeoff)}`);
}

function addMessage(role, text) {
  const container = document.querySelector("#messages");
  const item = document.createElement("div");
  item.className = `message ${role}`;
  item.innerHTML = text;
  container.append(item);
  container.scrollTop = container.scrollHeight;
}

function respondToChat(question) {
  const best = rankedProperties()[0];
  const affordable = properties.filter((property) => property.rent != null).sort((a, b) => a.rent - b.rent)[0];
  const lower = question.toLowerCase();
  if (lower.includes("1万円") || lower.includes("安く")) {
    if (affordable.enriched === false) {
      return `家賃だけで比較すると<strong>${escapeHTML(affordable.name)}</strong>です。ただし、通勤と周辺施設は未取得のため、現時点では暫定候補です。`;
    }
    return `家賃を抑えるなら<strong>${escapeHTML(affordable.name)}</strong>です。${yen(best.rent - affordable.rent)}安くなりますが、通勤は${affordable.commute - best.commute}分長くなります。`;
  }
  if (lower.includes("買い物") || lower.includes("夜")) {
    const nightBest = properties.filter((property) => property.enriched !== false).sort((a, b) => b.late - a.late)[0];
    return `夜の買い物を最優先するなら<strong>${escapeHTML(nightBest.name)}</strong>です。利便性は${nightBest.late}/10ですが、${escapeHTML(nightBest.tradeoff)}`;
  }
  if (lower.includes("理由") || lower.includes("なぜ")) {
    if (best.enriched === false) return `<strong>${escapeHTML(best.name)}</strong>は家賃・間取りだけの暫定評価です。経路と周辺施設を取得するまで最終順位にはできません。`;
    return `<strong>${escapeHTML(best.name)}</strong>は、${priorityLabel([...state.priorities][0])}と${priorityLabel([...state.priorities][1] || "space")}の両方でバランスが良く、予算との差額も小さいためです。`;
  }
  return `現在の条件では<strong>${escapeHTML(best.name)}</strong>が最有力です。「1万円安くするなら？」「夜の買い物を優先すると？」のように、妥協したい条件を聞いてください。`;
}

// ---- Listing-sheet intake -------------------------------------------------

const EXTRACTION_FIELDS = [
  { key: "propertyName", label: "物件・部屋名", type: "text" },
  { key: "rent", label: "月額賃料（円）", type: "number", step: "1" },
  { key: "address", label: "住所", type: "text", wide: true },
  { key: "station", label: "最寄駅", type: "text" },
  { key: "layout", label: "間取り", type: "text" },
  { key: "areaSqm", label: "専有面積（㎡）", type: "number", step: "0.01" },
  { key: "constructionYear", label: "竣工年", type: "number", step: "1" },
];
// Confidence is reported by the model and has not been calibrated. Below this threshold,
// or when a value is missing or named in a warning, a person must confirm the field explicitly.
const REVIEW_CONFIDENCE_THRESHOLD = 0.85;
const EXTRACTION_TIMEOUT_MS = 90_000;
const UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
// claude-opus-5 is on the high-resolution tier. Images within these limits are not resized by the API,
// so the pixel boxes it returns map 1:1 onto the uploaded image.
const MAX_IMAGE_EDGE = 2576;
const MAX_VISUAL_TOKENS = 4784;

const sampleField = (value) => ({ value, confidence: null, evidence: null, sourceText: null });
// Fixed values for the demonstrated sheet format, shown when no extraction API is configured.
const SAMPLE_EXTRACTION = {
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

const MODE_LABELS = { sample: "SAMPLE EXTRACTION", mock: "MOCK EXTRACTION", live: "CLAUDE EXTRACTION" };
const WARNING_LABELS = { inconsistent_values: "不一致", illegible: "判読困難", multiple_candidates: "候補複数", other: "注意" };
const extractionNote = (result) => ({
  sample: "現在はこの形式を想定した固定サンプル値です。画像の内容は読み取っていません。解析サーバー（worker/）を設定すると、Claudeによる読み取り結果・信頼度・根拠領域を表示します。",
  mock: "解析サーバーのモック応答です（テスト用の架空図面に対応する固定値）。アップロードした画像は読み取っていません。",
  live: `${result.meta.model} による読み取り結果です。信頼度はモデルの自己申告で較正されていません。根拠領域は目安です。色付きの項目は原本と照合してから追加してください。`,
})[result.meta.mode];

const intake = { file: null, previewUrl: null, result: null, review: new Set(), confirmed: new Set(), requestId: 0 };
const fieldLabel = (key) => EXTRACTION_FIELDS.find((field) => field.key === key)?.label ?? key;
const formatTime = (iso) => new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

function extractionEndpoint() {
  const base = String(window.RENTAL_DEMO_CONFIG?.extractionApiUrl || "").trim().replace(/\/+$/, "");
  return base ? `${base}/api/extract-listing` : "";
}

function provenanceText(provenance) {
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

/** Round half to even, matching the API's resize rule at exact .5 ties. */
function roundTiesToEven(value) {
  const floor = Math.floor(value);
  if (value - floor !== 0.5) return Math.round(value);
  return floor % 2 === 0 ? floor : floor + 1;
}

/** The largest aspect-preserving size Claude accepts without resizing (reference rule from the vision docs). */
function resizedSize(width, height, maxEdge = MAX_IMAGE_EDGE, maxTokens = MAX_VISUAL_TOKENS) {
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
 * Shrink the image to fit the model's limits. PNG and WEBP that already fit are sent unchanged;
 * everything else is redrawn as JPEG, which also bakes in any EXIF rotation so the server and
 * the preview see the same pixels.
 */
async function prepareImage(file) {
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

class IntakeError extends Error {}

function isExtractionResult(body) {
  return Boolean(
    body?.meta?.mode in MODE_LABELS &&
      body.fields &&
      Array.isArray(body.warnings) &&
      EXTRACTION_FIELDS.every(({ key }) => body.fields[key] && "value" in body.fields[key] && "confidence" in body.fields[key]),
  );
}

async function requestExtraction(endpoint, blob, name) {
  const form = new FormData();
  form.append("image", blob, name);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EXTRACTION_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, { method: "POST", body: form, signal: controller.signal });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new IntakeError(body?.error?.message || `解析サーバーがエラーを返しました（HTTP ${response.status}）。`);
    if (!isExtractionResult(body)) throw new IntakeError("解析結果の形式が想定と異なります。");
    return body;
  } catch (error) {
    if (error instanceof IntakeError) throw error;
    if (error.name === "AbortError") throw new IntakeError(`解析が${EXTRACTION_TIMEOUT_MS / 1000}秒以内に終わりませんでした。もう一度お試しください。`);
    throw new IntakeError("解析サーバーに接続できませんでした。ネットワークと設定を確認してください。");
  } finally {
    clearTimeout(timer);
  }
}

function fieldsNeedingReview(result) {
  if (result.meta.mode === "sample") return new Set();
  const flagged = new Set(result.warnings.flatMap((warning) => warning.fields));
  EXTRACTION_FIELDS.forEach(({ key }) => {
    const { value, confidence } = result.fields[key];
    if (value === null || confidence === null || confidence < REVIEW_CONFIDENCE_THRESHOLD) flagged.add(key);
  });
  return flagged;
}

function fieldMarkup({ key, label, type, step, wide }, field, mode) {
  const review = intake.review.has(key);
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
  const highlight = document.querySelector("#evidenceHighlight");
  const box = key ? intake.result?.fields[key]?.evidence : null;
  highlight.hidden = !box;
  if (!box) return;
  const [x, y, w, h] = box;
  Object.assign(highlight.style, { left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%` });
}

function updateReviewState() {
  const pending = [...intake.review].filter((key) => !intake.confirmed.has(key));
  const sample = intake.result.meta.mode === "sample";
  document.querySelector("#confirmExtraction").disabled = pending.length > 0;
  document.querySelector("#extractionReviewLabel").textContent = sample ? "要原本確認" : pending.length ? `要確認 ${pending.length}件` : "照合済み";
  document.querySelectorAll(".extraction-field").forEach((element) => element.classList.toggle("confirmed", intake.confirmed.has(element.dataset.field)));
  let status = "サンプル抽出値を表示しています。黄色い募集図面の原本と照合し、必要に応じて修正してください。";
  if (!sample) {
    status = pending.length
      ? `${EXTRACTION_FIELDS.length}項目を読み取りました。色付きの${pending.length}項目は原本と照合し、チェックを入れるか値を修正してください。`
      : "要確認項目はすべて照合済みです。内容を確認して候補に追加できます。";
  }
  document.querySelector("#intakeStatus").textContent = status;
}

function renderExtraction(result) {
  intake.result = result;
  intake.review = fieldsNeedingReview(result);
  intake.confirmed = new Set();
  const { mode } = result.meta;
  document.querySelector("#extractionModeLabel").textContent = MODE_LABELS[mode];
  document.querySelector("#extractionNote").textContent = extractionNote(result);
  const grid = document.querySelector("#extractionGrid");
  grid.innerHTML = EXTRACTION_FIELDS.map((field) => fieldMarkup(field, result.fields[field.key], mode)).join("");
  const preview = document.querySelector("#listingPreview");
  grid.querySelectorAll("canvas[data-crop]").forEach((canvas) => drawEvidenceCrop(canvas, preview, result.fields[canvas.dataset.crop].evidence));
  const warnings = document.querySelector("#extractionWarnings");
  warnings.innerHTML = result.warnings.map((warning) => `<li><b>${WARNING_LABELS[warning.code] ?? "注意"}</b>${escapeHTML(warning.message)}</li>`).join("");
  warnings.hidden = result.warnings.length === 0;
  showEvidence(null);
  updateReviewState();
  document.querySelector("#extractionEmpty").hidden = true;
  document.querySelector("#extractionForm").hidden = false;
}

function setEmptyState(kind, text = "") {
  const title = document.querySelector("#extractionEmptyTitle");
  const body = document.querySelector("#extractionEmptyText");
  const error = document.querySelector("#extractionError");
  document.querySelector("#extractionForm").hidden = true;
  document.querySelector("#extractionEmpty").hidden = false;
  error.hidden = kind !== "error";
  if (kind === "busy") {
    title.textContent = "読み取り中です…";
    body.textContent = "Claudeが募集図面を解析しています。数十秒かかる場合があります。";
  } else if (kind === "error") {
    title.textContent = "読み取れませんでした。";
    body.textContent = "もう一度読み取るか、サンプル値で流れを確認できます。";
    document.querySelector("#extractionErrorText").textContent = text;
  } else {
    title.innerHTML = "解析後、抽出項目を<br />原本と照合します。";
    body.textContent = "物件名、賃料、住所、最寄駅、間取り、面積、竣工年を表示し、誤読を修正してから候補へ追加します。";
  }
}

function readExtractedValue(key) {
  const input = document.querySelector(`#extracted-${key}`);
  const raw = input.value.trim();
  if (!raw) return null;
  if (input.type !== "number") return raw;
  const number = Number(raw);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function setupListingIntake() {
  const upload = document.querySelector("#listingUpload");
  const preview = document.querySelector("#listingPreview");
  const frame = document.querySelector("#previewFrame");
  const placeholder = document.querySelector("#uploadPlaceholder");
  const analyzeButton = document.querySelector("#analyzeListing");
  const form = document.querySelector("#extractionForm");
  const grid = document.querySelector("#extractionGrid");
  const message = document.querySelector("#intakeMessage");
  const live = Boolean(extractionEndpoint());
  const idleLabel = live ? "Claudeで読み取る →" : "画像を読み取る →";

  analyzeButton.textContent = idleLabel;
  if (live) {
    document.querySelector("#privacyNote").textContent =
      "「Claudeで読み取る」を押すと、画像を縮小して解析サーバー経由でAnthropic社のClaude APIへ送信します。解析サーバーは画像を保存しません（Anthropic社のAPIデータ取扱方針が適用されます）。";
  }

  preview.addEventListener("load", () => frame.style.setProperty("--ratio", `${preview.naturalWidth} / ${preview.naturalHeight}`));

  upload.addEventListener("change", () => {
    const [file] = upload.files;
    if (!file) return;
    intake.requestId += 1; // ignore any reading still in flight for the previous image
    intake.file = file;
    intake.result = null;
    if (intake.previewUrl) URL.revokeObjectURL(intake.previewUrl);
    intake.previewUrl = URL.createObjectURL(file);
    preview.src = intake.previewUrl;
    frame.hidden = false;
    placeholder.hidden = true;
    showEvidence(null);
    setEmptyState("idle");
    analyzeButton.disabled = false;
    analyzeButton.textContent = idleLabel;
    message.textContent = `${file.name} をブラウザ内で読み込みました。`;
    upload.value = ""; // allow choosing the same file again to start over
  });

  analyzeButton.addEventListener("click", async () => {
    const endpoint = extractionEndpoint();
    if (!endpoint) {
      renderExtraction(SAMPLE_EXTRACTION);
      message.textContent = "抽出結果は未確定です。確認後に候補へ追加できます。";
      return;
    }
    const requestId = ++intake.requestId;
    analyzeButton.disabled = true;
    analyzeButton.textContent = "読み取り中…";
    setEmptyState("busy");
    message.textContent = "";
    try {
      const { blob, name } = await prepareImage(intake.file);
      const result = await requestExtraction(endpoint, blob, name);
      await preview.decode().catch(() => {});
      if (requestId !== intake.requestId) return;
      renderExtraction(result);
      message.textContent = result.meta.mode === "mock"
        ? "モック応答を表示しています。画像の内容は解析していません。"
        : "読み取り結果は未確定です。要確認項目を原本と照合してください。";
    } catch (error) {
      if (requestId !== intake.requestId) return;
      setEmptyState("error", error instanceof IntakeError ? error.message : "画像を処理できませんでした。別の画像でお試しください。");
    } finally {
      if (requestId === intake.requestId) {
        analyzeButton.disabled = false;
        analyzeButton.textContent = idleLabel;
      }
    }
  });

  document.querySelector("#useSampleExtraction").addEventListener("click", () => {
    renderExtraction(SAMPLE_EXTRACTION);
    message.textContent = "サンプル値を表示しています。画像の内容とは関係ありません。";
  });

  grid.addEventListener("change", (event) => {
    const key = event.target.dataset.confirm;
    if (!key) return;
    if (event.target.checked) intake.confirmed.add(key);
    else intake.confirmed.delete(key);
    updateReviewState();
  });
  grid.addEventListener("input", (event) => {
    const key = event.target.closest("[data-field]")?.dataset.field;
    if (!key || !intake.review.has(key) || event.target.dataset.confirm) return;
    // Correcting a value against the original counts as confirming it.
    intake.confirmed.add(key);
    grid.querySelector(`[data-confirm="${key}"]`).checked = true;
    updateReviewState();
  });
  grid.addEventListener("pointerover", (event) => showEvidence(event.target.closest("[data-field]")?.dataset.field));
  grid.addEventListener("focusin", (event) => showEvidence(event.target.closest("[data-field]")?.dataset.field));
  grid.addEventListener("pointerleave", () => showEvidence(grid.contains(document.activeElement) ? document.activeElement.closest("[data-field]")?.dataset.field : null));

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const { result } = intake;
    if (!result || [...intake.review].some((key) => !intake.confirmed.has(key))) return;
    const values = Object.fromEntries(EXTRACTION_FIELDS.map(({ key }) => [key, readExtractedValue(key)]));
    const { propertyName, rent, address, station, layout, areaSqm, constructionYear } = values;
    const district = address?.match(/東京都([^区]+区)/)?.[1] || "所在地要確認";
    const imported = {
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
        confirmedAt: new Date().toISOString(),
        editedFields: EXTRACTION_FIELDS.map(({ key }) => key).filter((key) => values[key] !== result.fields[key].value),
      },
    };
    const existingIndex = properties.findIndex((property) => property.id === imported.id);
    if (existingIndex >= 0) properties.splice(existingIndex, 1, imported);
    else properties.push(imported);
    state.selectedId = imported.id;
    renderCandidates();
    renderSelected();
    message.textContent = `${imported.name}を暫定候補に追加しました。未取得項目は順位上で明示しています。`;
    document.querySelector(".workspace").scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function initialiseGoogleMaps() {
  const config = window.RENTAL_DEMO_CONFIG || {};
  const note = document.querySelector("#mapApiNote");
  if (!config.googleMapsApiKey) {
    note.textContent = "config.js にブラウザ制限済みのキーを設定すると、Google Maps を読み込みます。";
    return;
  }
  const script = document.createElement("script");
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(config.googleMapsApiKey)}&callback=loadRentalMap`;
  script.async = true;
  script.onerror = () => { note.textContent = "Google Maps を読み込めなかったため、デモ用マップを表示しています。"; };
  window.loadRentalMap = () => {
    const mockMap = document.querySelector("#mockMap");
    const target = document.createElement("div");
    target.id = "googleMap";
    target.style.cssText = "height:100%;width:100%;";
    mockMap.replaceWith(target);
    const map = new google.maps.Map(target, { center: { lat: 35.673, lng: 139.785 }, zoom: 11, disableDefaultUI: true, zoomControl: true, styles: [{ featureType: "poi", stylers: [{ visibility: "off" }] }] });
    new google.maps.Marker({ map, position: { lat: 35.6688, lng: 139.7595 }, label: "⌖", title: "虎ノ門ヒルズ" });
    [[35.6824, 139.798, "1"], [35.620, 139.704, "2"], [35.705, 139.649, "3"]].forEach(([lat, lng, label]) => new google.maps.Marker({ map, position: { lat, lng }, label }));
    document.querySelector("#mapOverlay").style.display = "none";
    note.textContent = "Google Maps を表示中。経路・施設データを有効にするには、別途APIを有効化してください。";
  };
  document.head.append(script);
}

document.addEventListener("DOMContentLoaded", () => {
  setupListingIntake();
  const budget = document.querySelector("#budget");
  budget.addEventListener("input", () => { state.budget = Number(budget.value); document.querySelector("#budgetOutput").value = yen(state.budget); });
  document.querySelector("#priorityChips").addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    const key = button.dataset.priority;
    if (state.priorities.has(key)) state.priorities.delete(key);
    else if (state.priorities.size < 2) state.priorities.add(key);
    document.querySelectorAll(".priority-chip").forEach((chip) => chip.classList.toggle("active", state.priorities.has(chip.dataset.priority)));
  });
  document.querySelector("#weekend").addEventListener("change", (event) => { state.weekend = event.target.checked; });
  document.querySelector("#recalculate").addEventListener("click", recalculate);
  document.querySelectorAll(".map-pin[data-property]").forEach((pin) => pin.addEventListener("click", () => selectProperty(pin.dataset.property)));
  document.querySelector("#connectMaps").addEventListener("click", () => { document.querySelector("#mapApiNote").textContent = "config.example.js を config.js に複製し、ブラウザ制限済みの Google Maps API キーを設定してください。"; });
  document.querySelector("#promptSuggestions").addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    addMessage("user", button.textContent);
    addMessage("assistant", respondToChat(button.textContent));
  });
  document.querySelector("#chatForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const input = document.querySelector("#chatInput");
    const question = input.value.trim();
    if (!question) return;
    addMessage("user", question);
    addMessage("assistant", respondToChat(question));
    input.value = "";
  });
  renderCandidates();
  renderSelected();
  initialiseGoogleMaps();
});
