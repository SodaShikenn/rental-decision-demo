// Comparison DOM: the sheets as columns of one table (in the order they were added), and one popover
// that shows where a value was read (crop, OCR text, confidence), a move-in estimate, or a sheet's
// pre-contract checks. Nothing is scored, sorted, or coloured by best and worst.
import { safeSourceUrl } from "../research/services.js";
import { PRIORITIES, assessCandidate, observedValue } from "../priorities/services.js";
import { visibleCandidates, perspectiveOf } from "../workspace/services.js";
import { MAX_SHEETS } from "../../config.js";
import { $, $$, announce, clip, drawEvidenceCrop, escapeHTML, termButton, man } from "../../helper.js";
import { breakdownMarkup } from "../costs/views.js";
import { SAMPLE_SHEET, WARNING_LABELS, fieldValueText, shortFieldLabel } from "../intake/models.js";
import { provenanceText } from "../intake/services.js";
import { acceptFile } from "../intake/views.js";
import { CHECK_CATEGORIES, CHECK_TERMS, GENERAL_CHECKS, ROWS } from "./models.js";
import { compareRows, unionBox } from "./services.js";

// The popover on screen: which sheet and row it shows. Kept so a re-render can refresh it and closing
// it can return focus to the cell, even after the table was redrawn.
const popover = { propertyId: null, rowKey: null };
// Equipment chips shown in a cell before 「ほかN」.
const EQUIPMENT_SHOWN = 5;

// Decoded sheet images for the crops, by src. Entries for sheets no longer on screen are dropped on
// every render, so an uploaded sheet's bitmap goes with its column (its blob: URL is revoked by the store).
const images = new Map();
/** Load a sheet image once; later calls share the same promise. */
function loadImage(src) {
  if (!images.has(src)) {
    const image = new Image();
    image.src = src;
    images.set(src, image.decode().then(() => image));
  }
  return images.get(src);
}
function forgetImagesExcept(properties) {
  const shown = new Set(properties.map((property) => property.sheet?.image).filter(Boolean));
  for (const src of images.keys()) if (!shown.has(src)) images.delete(src);
}

const rowLabel = (key) => ROWS.find((row) => row.key === key)?.label ?? key;
const boxAttr = (box) => (box ? ` data-box="${box.join(",")}"` : "");
const crop = (box, label) => (box ? `<canvas class="evidence-crop"${boxAttr(box)} role="img" aria-label="${escapeHTML(label)}の根拠となる図面の箇所"></canvas>` : "");
const confidenceText = (confidence) => (typeof confidence === "number" ? ` · 信頼度 ${Math.round(confidence * 100)}%` : "");

/** "2万円＋未取得" with the unknown part hatched; "未取得" alone hatched. */
function valueMarkup(cell) {
  const text = escapeHTML(cell.text);
  return cell.unknown ? text.replace("未取得", '<span class="unknown">未取得</span>') : text;
}

function captionText(properties) {
  const n = properties.length;
  const recorded = properties.filter((property) => property.provenance?.mode === "recorded").length;
  const read = properties.filter((property) => property.provenance?.mode === "live").length;
  const mock = properties.filter((property) => property.provenance?.mode === "mock").length;
  if (!n) return "候補がありません";
  const manual = properties.filter((property) => property.provenance?.mode === "manual").length;
  const linked = properties.filter((property) => property.provenance?.mode === "link").length;
  if (manual || linked) return `${n}件の候補（手入力 ${manual}件・リンク ${linked}件）`;
  if (recorded === n) return `実際の募集図面${n}件（記録時点の値）`;
  return `図面${n}件：${[
    recorded ? `実際の募集図面${recorded}件（記録時点の値）` : "",
    read ? `読み取った図面${read}件` : "",
    mock ? `モック応答${mock}件（画像は未解析）` : "",
  ].filter(Boolean).join("・")}`;
}

function headMarkup(property) {
  const id = escapeHTML(property.id);
  const name = escapeHTML(property.name);
  const image = property.sheet?.image;
  const thumb = image
    ? `<a class="sheet-thumb" href="${escapeHTML(image)}" target="_blank" rel="noopener" aria-label="${name} の図面を開く（新しいタブ）"><img src="${escapeHTML(image)}" alt="" width="56" height="56" loading="lazy" /></a>`
    : safeSourceUrl(property.sourceUrl) ? `<a class="sheet-thumb is-empty" href="${escapeHTML(property.sourceUrl)}" target="_blank" rel="noopener noreferrer" aria-label="${name} の掲載リンクを開く">掲載元 ↗</a>` : '<span class="sheet-thumb is-empty" aria-hidden="true">手入力</span>';
  const mock = property.provenance?.mode === "mock" ? '<span class="tag">モック応答</span>' : "";
  return `
    <th scope="col" class="sheet-head" data-property="${id}" tabindex="-1">
      ${thumb}
      <span class="sheet-name">${name}</span>
      <span class="sheet-meta"><span>${escapeHTML(property.district ?? "所在地未取得")}</span>${mock}</span><details class="candidate-actions"><summary>候補の管理</summary><div><button class="sheet-remove" type="button" data-research="${id}" aria-label="${name} の不足情報を探す">不足情報を探す</button><button class="sheet-remove" type="button" data-edit-candidate="${id}" aria-label="${name} の情報を編集">編集</button><button class="sheet-remove" type="button" data-remove="${id}" aria-label="${name} を比較から外す">外す</button></div></details>
    </th>`;
}

function rowHeadMarkup(row) {
  return `
    <th scope="row">
      <span class="row-label">${escapeHTML(row.label)}</span>
      ${row.sub ? `<span class="row-sub">${escapeHTML(row.sub)}</span>` : ""}
      ${row.spread ? `<span class="spread" title="図面の値の幅">${escapeHTML(row.spread)}</span>` : ""}
    </th>`;
}

function cellMarkup(row, cell, property, priorities) {
  const id = escapeHTML(property.id);
  if (row.key === "equipment") {
    if (!cell.items.length) return `<td data-property="${id}"><p class="cell-note">${escapeHTML(cell.text)}</p></td>`;
    const lines = (item) => item.lines.map((index) => property.sheet?.lines?.[index]?.text ?? "").join(" / ");
    const more = cell.items.length - EQUIPMENT_SHOWN;
    return `
      <td data-property="${id}">
        <div class="term-chips">
          ${cell.items.slice(0, EQUIPMENT_SHOWN).map((item) => `<button class="term-chip" type="button" data-term="${escapeHTML(item.term)}" title="図面「${escapeHTML(clip(lines(item), 60))}」">${escapeHTML(item.label)}</button>`).join("")}
          <button class="cell-more" type="button" data-row="equipment" data-property="${id}" aria-haspopup="dialog" aria-label="図面に出てくる設備 ${cell.items.length}件、図面の該当箇所を見る">${more > 0 ? `ほか${more}` : "図面の箇所"}</button>
        </div>
      </td>`;
  }
  const action = { initial: "内訳を見る", checks: "確認事項を見る" }[row.key] ?? "詳細を見る";
  const fit = assessCandidate(property, priorities).find((item) => item.row === row.key);
  const fitLabel = fit ? { fits: '✓ 確認した条件内', conflict: '必須条件と差あり', tradeoff: '希望と差あり', unknown: '希望との比較は未確定' }[fit.status] : '';
  const priorityKey = PRIORITIES.find((item) => item.row === row.key)?.key;
  const uncertain = cell.unknown || (property.unconfirmedFields ?? []).some((key) => cell.fields.includes(key)) || (priorityKey && observedValue(property, priorityKey) == null);
  const edited = (property.provenance?.editedFields ?? []).some(key => cell.fields.includes(key));
  const sourceLabel = row.key === 'initial' ? (cell.unknown ? '概算・未取得あり' : '概算') : cell.references?.length ? '同じ建物の参考' : property.provenance?.mode === 'mock' ? 'モック' : uncertain ? '要確認' : edited ? '入力を含む' : cell.fields.some((key) => property.fieldSources?.[key]) ? '掲載サイト' : property.provenance?.mode === 'manual' ? '入力情報' : property.provenance?.mode === 'mock' ? 'モック' : '掲載情報';
  const label = `${row.label} ${cell.text}${cell.sub ? `（${cell.sub}）` : ""}、${sourceLabel}${fitLabel ? `、${fitLabel}` : ""}、${action}`;
  return `
    <td data-property="${id}">
      <button class="cell" type="button" data-row="${row.key}" data-property="${id}" aria-haspopup="dialog" aria-label="${escapeHTML(label)}">
        <span class="cell-value">${valueMarkup(cell)}</span>
        ${cell.sub ? `<span class="cell-sub">${escapeHTML(cell.sub)}</span>` : ""}
        <span class="cell-provenance">${sourceLabel}</span>
        ${fit ? `<span class="cell-fit cell-fit--${fit.status}">${fitLabel}</span>` : ''}
      </button>
    </td>`;
}

const tableOf = (state) => compareRows(state.properties, state.settings, state.rentOverrides);

export function renderCompare(app) {
  const { state } = app.extensions.store;
  const properties = visibleCandidates(state.properties, state.workspace);
  const n = properties.length;
  const full = state.properties.length >= MAX_SHEETS;
  const addSheet = $("#addSheet");
  addSheet.disabled = full;
  $("#addCandidate").disabled = full;
  $("#addLink").disabled = full;
  if (full) addSheet.title = `比べられるのは${MAX_SHEETS}件までです`;
  else addSheet.removeAttribute("title");
  const sample = $("#useSampleSheet");
  sample.disabled = full && !state.properties.some((property) => property.id === SAMPLE_SHEET.id);
  if (sample.disabled) sample.title = `比べられるのは${MAX_SHEETS}件までです`;
  else sample.removeAttribute("title");

  const caption = captionText(state.properties);
  $("#compareCaption").textContent = caption;
  $("#compareTableCaption").textContent = `比較表：${captionText(properties)}。列が表示中の候補、行が項目です。`;
  $("#compareEmpty").hidden = n > 0;
  $("#compare .table-wrap").hidden = n === 0;
  $("#compare .scroll-hint").hidden = n === 0;
  const { rows: allRows } = compareRows(properties, state.settings, state.rentOverrides);
  const rows = allRows.filter((row) => perspectiveOf(state.workspace).rows.includes(row.key));
  const focusedRow = PRIORITIES.find((item) => item.key === state.priorities.focus)?.row;
  rows.sort((a, b) => Number(b.key === focusedRow) - Number(a.key === focusedRow));
  $("#compareTable").style.setProperty("--candidate-count", Math.max(1, properties.length));
  $("#compareHead").innerHTML = n
    ? `<tr><th scope="col" class="corner"><span class="visually-hidden">項目</span></th>${properties.map(headMarkup).join("")}</tr>`
    : "";
  $("#compareRows").innerHTML = n
    ? rows.map((row) => `<tr data-row="${row.key}">${rowHeadMarkup(row)}${row.cells.map((cell, index) => cellMarkup(row, cell, properties[index], state.priorities)).join("")}</tr>`).join("")
    : "";
  forgetImagesExcept(properties);
  if ($("#cellPopover").open) renderPopover(app);
}

/** Briefly highlight a column that was just added, and move focus to its header. */
export function flashColumn(id) {
  const selector = `[data-property="${CSS.escape(id)}"]`;
  $$(`#compareHead th${selector}, #compareRows td${selector}`).forEach((element) => {
    element.classList.remove("is-new");
    void element.offsetWidth; // restart the animation when the same sheet is added again
    element.classList.add("is-new");
  });
  $(`#compareHead th${selector}`)?.focus();
}

// ---- Popover bodies --------------------------------------------------------------------------

function sourceLine(property) {
  const image = property.sheet?.image;
  const open = image ? `<a href="${escapeHTML(image)}" target="_blank" rel="noopener">図面を開く</a>` : "";
  const provenance = property.provenance ? `<span>出典：${escapeHTML(provenanceText(property.provenance))}</span>` : "";
  return provenance || open ? `<p class="popover-source">${provenance}${open}</p>` : "";
}

function ocrLines(property) {
  const lines = property.sheet?.lines ?? [];
  if (!lines.length) return "";
  return `
    <details class="ocr-lines">
      <summary>図面の文字をすべて見る（${lines.length}行）</summary>
      <ol>${lines.map((line) => `<li>${escapeHTML(line.text)}</li>`).join("")}</ol>
    </details>`;
}

/** Each confirmed value of the cell beside the part of the sheet it was read from. */
function evidenceMarkup(property, cell) {
  const items = cell.fields.map((key) => {
    const field = property.sheet?.fields?.[key];
    const value = property[key];
    const edited = property.provenance?.editedFields?.includes(key);
    const tag = edited ? `<span class="tag" title="読み取り値：${escapeHTML(fieldValueText(key, field?.value ?? null))}">修正あり</span>` : "";
    const fromWeb = Boolean(property.fieldSources?.[key]);
    const meta = fromWeb ? "この値は掲載サイトから補完しました。出典は上のリンクで確認できます。" : value == null
      ? "未取得、または未確認です"
      : field?.sourceText
        ? `OCR「${escapeHTML(clip(field.sourceText))}」${confidenceText(field.confidence)}`
        : "入力された情報です。元の図面はありません";
    return `
      <li>
        <span class="evidence-label">${escapeHTML(shortFieldLabel(key))}</span>
        <span class="evidence-value">${value == null ? '<span class="unknown">未取得</span>' : escapeHTML(fieldValueText(key, value))}${tag}</span>
        ${value != null && !fromWeb ? crop(field?.evidence, shortFieldLabel(key)) : ""}
        <span class="evidence-meta">${meta}</span>
      </li>`;
  }).join("");
  const warnings = (property.sheetWarnings ?? []).filter((warning) => warning.fields?.some((key) => cell.fields.includes(key)));
  return `
    <ul class="evidence-list">${items}</ul>
    ${warnings.map((warning) => `<p class="note-warning"><b>${WARNING_LABELS[warning.code] ?? "注意"}</b>${escapeHTML(warning.message)}</p>`).join("")}`;
}

/** Every station the sheet prints, with the line name as printed and as the portals call it. */
function mentionsMarkup(property, mentions) {
  if (!mentions?.length) return "";
  const lines = property.sheet?.lines ?? [];
  return `
    <h3 class="popover-sub">図面に出てくる駅<span class="count">${mentions.length}件</span></h3>
    <ul class="mention-list">${mentions.map((mention) => {
      const indexes = [...new Set([mention.nameIndex, mention.index])];
      const text = indexes.map((index) => lines[index]?.text ?? "").join(" / ");
      const portal = mention.lines.length ? mention.lines.join("・") : "路線名の記載なし";
      const printed = mention.printed && mention.lines.join("・") !== mention.printed ? `（図面の表記「${escapeHTML(mention.printed)}」）` : "";
      return `
        <li>
          <span class="evidence-value">${escapeHTML(mention.station)} 徒歩${mention.minutes}分</span>
          <span class="evidence-meta">${escapeHTML(portal)}${printed}</span>
          ${crop(unionBox(indexes.map((index) => lines[index]?.box)), `${mention.station}駅`)}
          <span class="evidence-meta">OCR「${escapeHTML(clip(text))}」</span>
        </li>`;
    }).join("")}</ul>`;
}

function equipmentMarkup(property, cell) {
  const lines = property.sheet?.lines ?? [];
  return `
    <ul class="evidence-list">${cell.items.map((item) => {
      const text = item.lines.map((index) => lines[index]?.text ?? "").join(" / ");
      const confidences = item.lines.map((index) => lines[index]?.confidence).filter((value) => typeof value === "number");
      return `
        <li>
          <span class="evidence-label">設備</span>
          <span class="evidence-value">${escapeHTML(item.label)}${termButton(item.term, item.label)}</span>
          ${crop(unionBox(item.lines.map((index) => lines[index]?.box)), item.label)}
          <span class="evidence-meta">OCR「${escapeHTML(clip(text))}」${confidences.length ? confidenceText(Math.min(...confidences)) : ""}</span>
        </li>`;
    }).join("")}</ul>
    <p class="check-caveat">決まった言葉を探す仕組みのため、書き方によっては見落とします。図面に記載がない設備も、ないとは限りません。</p>`;
}

function checksMarkup(property) {
  const checks = (property.checks ?? []).map((check, index) => ({ ...check, index }));
  const groups = Object.entries(CHECK_CATEGORIES).map(([category, label]) => [label, checks.filter((check) => check.category === category)]).filter(([, items]) => items.length);
  const found = groups.length
    ? `<div class="check-groups">${groups.map(([label, items]) => `
        <div class="check-group">
          <h3 class="check-category">${label}<span class="count">${items.length}件</span></h3>
          <ul class="check-list">${items.map((check) => `
            <li>
              <details class="check">
                <summary class="check-title">${escapeHTML(check.title)}</summary>
                <p class="check-detail">${escapeHTML(check.detail)}${CHECK_TERMS[check.code] ? termButton(CHECK_TERMS[check.code], check.title) : ""}</p>
                <p class="check-source">図面「${escapeHTML(clip(check.sourceText, 60))}」</p>
                ${property.sheet ? crop(check.evidence, check.title) : ""}
              </details>
            </li>`).join("")}
          </ul>
        </div>`).join("")}</div>`
    : '<p class="empty-note">この図面からは、決まった言葉で書かれた確認事項を見つけられませんでした。</p>';
  return `
    <p class="popover-lead">図面から${checks.length}件。項目を押すと、理由と図面の該当箇所を表示します。</p>
    ${found}
    <details class="check-general">
      <summary>どの図面にも載らない確認事項</summary>
      <ul>${GENERAL_CHECKS.map(([term, text]) => `<li><b>${escapeHTML(term.replace(/○/, ""))}</b>${termButton(term)}<span>${escapeHTML(text)}</span></li>`).join("")}</ul>
    </details>
    <p class="check-caveat">決まった言葉を探す仕組みのため、書き方によっては見落とします。契約前に重要事項説明で必ず確認してください。</p>`;
}

function popoverBody(state, property, cell, rowKey) {
  if (rowKey === "monthly" && property.rent == null) {
    const references = (cell.references ?? []).map((item) => `<li><strong>${escapeHTML(item.room ? `${item.room}号室` : "部屋番号不明")} · ${escapeHTML(man(item.monthly))}/月</strong><p>${escapeHTML([item.layout, item.areaSqm ? `${item.areaSqm}㎡` : ""].filter(Boolean).join(" · "))} · 賃料${escapeHTML(man(item.rent))}＋管理費${escapeHTML(man(item.managementFee))}</p><a href="${escapeHTML(item.source.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(item.source.title || "募集掲載を見る")} ↗</a><p class="section-hint">掲載日：${escapeHTML(item.source.listingDate || "不明")} · 取得：${escapeHTML(item.source.retrievedAt)}</p></li>`).join("");
    return `<p class="evidence-value">${escapeHTML(cell.text)}</p><p class="popover-lead">${references ? "同じ建物の募集価格です。候補の部屋が未確認のため、予算の判定や初期費用の計算には使いません。空室状況・その他の月額費用は掲載元に確認してください。" : escapeHTML(property.monthlyResearch?.message || "同じ建物・部屋の募集価格を探します。")}</p>${references ? `<ul class="evidence-list">${references}</ul>` : ""}<button class="button" type="button" data-research="${escapeHTML(property.id)}">調査結果・再検索</button><details class="review-about"><summary>図面の情報を見る</summary>${evidenceMarkup(property, cell)}${sourceLine(property)}</details>`;
  }
  if (rowKey === "initial") return breakdownMarkup(property, cell.estimate, state.rentOverrides[property.id] ?? null, state.settings);
  if (rowKey === "checks") return checksMarkup(property);
  if (rowKey === "equipment") return `<ul>${cell.items.map((item) => `<li>${escapeHTML(item.label)}</li>`).join("")}</ul><p class="popover-lead">記載のない設備は、不動産会社に確認してください。</p><details class="review-about"><summary>情報の出典・読み取りの詳細</summary>${equipmentMarkup(property, cell)}${sourceLine(property)}${ocrLines(property)}</details>`;
  const mentions = rowKey === "station" ? mentionsMarkup(property, cell.mentions) : "";
  const webSources = cell.fields.filter((key) => safeSourceUrl(property.fieldSources?.[key]?.url)).map((key) => {
    const source = property.fieldSources[key];
    return `<p class="web-source">${escapeHTML(shortFieldLabel(key))}：<a href="${escapeHTML(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(source.title || "掲載元")} ↗</a><br>掲載日：${escapeHTML(source.listingDate || "不明")} · 取得：${escapeHTML(source.retrievedAt || "不明")}</p>`;
  }).join("");
  const details = `${webSources}<details class="review-about"><summary>情報の出典・読み取りの詳細</summary>${evidenceMarkup(property, cell)}${mentions}${sourceLine(property)}${ocrLines(property)}</details>`;
  const unconfirmed = (property.unconfirmedFields ?? []).some((key) => cell.fields.includes(key));
  const warning = unconfirmed ? "未確認の情報があります。候補の「編集」から入力すると比較に使えます。" : cell.unknown ? "情報が足りないため、この項目はまだ判断できません。" : "掲載情報または入力した内容です。最新の条件は不動産会社に確認してください。";
  return `<p class="evidence-value">${escapeHTML(cell.text)}</p><p>${escapeHTML(cell.sub)}</p><p class="popover-lead">${warning}</p>${details}`;
}

async function drawCrops(body, property) {
  const canvases = $$("canvas[data-box]", body);
  if (!canvases.length || !property.sheet?.image) return;
  try {
    const image = await loadImage(property.sheet.image);
    canvases.filter((canvas) => canvas.isConnected).forEach((canvas) => drawEvidenceCrop(canvas, image, canvas.dataset.box.split(",").map(Number), 480));
  } catch {
    canvases.forEach((canvas) => canvas.remove()); // the OCR text beside each value still shows the evidence
  }
}

function renderPopover(app) {
  const { state } = app.extensions.store;
  const dialog = $("#cellPopover");
  const index = state.properties.findIndex((property) => property.id === popover.propertyId);
  if (index === -1) {
    dialog.close();
    return;
  }
  const property = state.properties[index];
  const row = tableOf(state).rows.find((item) => item.key === popover.rowKey);
  const body = $("#popoverBody");
  // Typing a rent re-renders the breakdown; keep the caret where it was.
  const typing = document.activeElement?.id === "rentAssumed" ? document.activeElement.selectionStart : null;
  $("#popoverTitle").textContent = `${property.name} · ${rowLabel(popover.rowKey)}`;
  body.innerHTML = popoverBody(state, property, row.cells[index], popover.rowKey);
  if (typing != null) {
    const input = $("#rentAssumed", body);
    input?.focus();
    input?.setSelectionRange?.(typing, typing);
  }
  drawCrops(body, property);
}

function openPopover(app, propertyId, rowKey) {
  const dialog = $("#cellPopover");
  Object.assign(popover, { propertyId, rowKey });
  renderPopover(app);
  if (!dialog.open) dialog.showModal();
  $("#popoverBody").scrollTop = 0;
  $("#popoverClose").focus();
}

/** Back to the cell that opened the popover (redrawn or not), or to the add button if its sheet is gone. */
function returnFocus() {
  const { propertyId, rowKey } = popover;
  const trigger = propertyId ? $(`#compareRows [data-row="${rowKey}"][data-property="${CSS.escape(propertyId)}"]`) : null;
  (trigger ?? $("#addSheet")).focus();
  Object.assign(popover, { propertyId: null, rowKey: null });
}

function removeSheet(app, id) {
  const { store } = app.extensions;
  const { properties } = store.state;
  const index = properties.findIndex((property) => property.id === id);
  if (index === -1) return;
  const { name } = properties[index];
  store.removeProperty(id);
  announce(`${name} を比較から外しました`);
  // Focus the column that took its place, the one before it, or the add button.
  const visible = visibleCandidates(store.state.properties, store.state.workspace);
  const next = visible[Math.min(index, visible.length - 1)];
  (next ? $(`#compareHead th[data-property="${CSS.escape(next.id)}"]`) : $("#addSheet"))?.focus();
}

export function bindCompare(app) {
  const { store } = app.extensions;
  const section = $("#compare");
  const dialog = $("#cellPopover");

  $("#compareTable").addEventListener("click", (event) => {
    const remove = event.target.closest("[data-remove]");
    if (remove) {
      removeSheet(app, remove.dataset.remove);
      return;
    }
    const cell = event.target.closest(".cell, .cell-more");
    if (cell) openPopover(app, cell.dataset.property, cell.dataset.row);
  });
  $("#addSheet").addEventListener("click", () => $("#listingUpload").click());

  // The whole section takes a dropped sheet.
  section.addEventListener("dragover", (event) => {
    if (![...(event.dataTransfer?.types ?? [])].includes("Files")) return;
    event.preventDefault();
    section.classList.add("is-dragover");
  });
  section.addEventListener("dragleave", (event) => {
    if (!section.contains(event.relatedTarget)) section.classList.remove("is-dragover");
  });
  section.addEventListener("drop", (event) => {
    if (![...(event.dataTransfer?.types ?? [])].includes("Files")) return;
    event.preventDefault();
    section.classList.remove("is-dragover");
    acceptFile(event.dataTransfer.files[0]);
  });

  $("#popoverClose").addEventListener("click", () => dialog.close());
  // A click on the backdrop closes the popover. The backdrop and the panel's own empty area are both
  // the dialog element, so tell them apart by where the click landed.
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const panel = dialog.getBoundingClientRect();
    const inside = event.clientX >= panel.left && event.clientX <= panel.right && event.clientY >= panel.top && event.clientY <= panel.bottom;
    if (!inside) dialog.close();
  });
  dialog.addEventListener("close", returnFocus);
  $("#popoverBody").addEventListener("input", (event) => {
    if (event.target.id !== "rentAssumed") return;
    const value = Number(event.target.value.normalize("NFKC").replace(/[,円\s]/g, ""));
    store.setRentOverride(event.target.dataset.property, Number.isFinite(value) && value > 0 ? value : null);
  });
}
