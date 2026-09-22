// Condition-memo DOM: chips for what the sheets print (with counts), questions raised by clauses on the
// sheets, and the memo itself, which is generated from confirmed choices and can be copied to take to a listing portal or an agent.
import { $, $$, escapeHTML } from "../../helper.js";
import { buildTenantMemo } from "./services.js";

// What the last render showed, so a chip whose count moved (a sheet was added or removed) flashes
// once when its underlying candidate evidence changes.
const view = { counts: null };

function leadText() {
  return "候補の分析と確認した回答から、自動で整理しています。";
}

function chipTitle(chip) {
  return chip.sheets.map((sheet) => `${sheet.name}：「${sheet.sourceText}」`).join("\n");
}

function chipsMarkup(chips, changed) {
  return chips.map((chip) => `
    <button class="aspect-chip${changed.has(chip.key) ? " is-changed" : ""}" type="button" data-aspect="${chip.key}" aria-pressed="${chip.pressed}"
      aria-label="${escapeHTML(`${chip.label}（${chip.n}件中${chip.count}件の図面に記載）`)}" title="${escapeHTML(chipTitle(chip))}">
      <span>${escapeHTML(chip.label)}</span><span class="aspect-count">${chip.count}/${chip.n}</span>${changed.has(chip.key) ? '<span class="aspect-changed">変更</span>' : ""}
    </button>`).join("");
}

function questionMarkup(question, answer) {
  const name = `question-${question.key}`;
  const checked = (value) => (question.type === "checkbox" ? (Array.isArray(answer) ? answer : question.initial).includes(value) : (answer ?? question.initial) === value);
  return `
    <fieldset class="question" data-question="${question.key}" data-type="${question.type}">
      <legend>${escapeHTML(question.text)}</legend>
      <div class="segmented">${question.options.map((option) => `
        <label><input type="${question.type}" name="${name}" value="${option.value}"${checked(option.value) ? " checked" : ""} />${escapeHTML(option.label)}</label>`).join("")}
      </div>
    </fieldset>`;
}

/** Keep focus on the same control across a re-render (chips and questions are redrawn). */
function keepFocus(container, redraw) {
  const active = document.activeElement;
  const key = container.contains(active)
    ? active.dataset.aspect
      ? `[data-aspect="${active.dataset.aspect}"]`
      : active.name
        ? `input[name="${active.name}"][value="${active.value}"]`
        : null
    : null;
  redraw();
  if (key) $(key, container)?.focus();
}

/** A read-only output of candidate analysis and explicitly confirmed choices. */
function renderMemoText(generated) {
  const memo = $("#memo");
  if (memo.textContent !== generated) memo.textContent = generated;
}

export function renderNeeds(app) {
  const { state } = app.extensions.store;
  const memo = buildTenantMemo(state);
  const generated = memo.text;

  $("#needsLead").textContent = leadText();

  const counts = new Map(memo.chips.map((chip) => [chip.key, chip.count]));
  const changed = new Set(view.counts ? memo.chips.filter((chip) => view.counts.get(chip.key) !== chip.count).map((chip) => chip.key) : []);
  view.counts = counts;
  const chips = $("#aspectChips");
  keepFocus(chips, () => {
    chips.innerHTML = chipsMarkup(memo.chips, changed);
  });
  $("#aspectBlock").hidden = memo.chips.length === 0;

  const questions = $("#needsQuestions");
  keepFocus(questions, () => {
    questions.innerHTML = memo.questions.map((question) => questionMarkup(question, state.answers[question.key])).join("");
  });
  $("#questionBlock").hidden = memo.questions.length === 0;

  renderMemoText(generated);
  $("#copyMemo").disabled = false;
}

/** Copy with the Clipboard API; where it is refused, select the text and try the older copy command. */
async function copyMemo() {
  const memo = $("#memo");
  const status = $("#memoStatus");
  status.textContent = "";
  try {
    if (!navigator.clipboard?.writeText) throw new Error("unavailable");
    await navigator.clipboard.writeText(memo.textContent);
    status.textContent = "コピーしました";
  } catch {
    memo.focus();
    const range = document.createRange();
    range.selectNodeContents(memo);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }
    status.textContent = copied ? "コピーしました" : "コピーできませんでした。テキストを選択して手動でコピーしてください";
  }
}

export function bindNeeds(app) {
  const { store } = app.extensions;

  $("#aspectChips").addEventListener("click", (event) => {
    const chip = event.target.closest("[data-aspect]");
    if (!chip) return;
    store.setPick(chip.dataset.aspect, chip.getAttribute("aria-pressed") !== "true");
  });
  $("#needsQuestions").addEventListener("change", (event) => {
    const fieldset = event.target.closest("[data-question]");
    if (!fieldset) return;
    const { question, type } = fieldset.dataset;
    const value = type === "checkbox" ? $$("input:checked", fieldset).map((input) => input.value) : event.target.value;
    store.answer(question, value);
  });

  $("#copyMemo").addEventListener("click", copyMemo);
}
