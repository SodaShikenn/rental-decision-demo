// Condition-memo DOM: chips for what the sheets print (with counts), questions raised by clauses on the
// sheets, and the memo itself, which the person can edit and copy to take to a listing portal or an agent.
import { $, $$, escapeHTML } from "../../helper.js";
import { buildTenantMemo } from "./services.js";

// What the last render showed, so a chip whose count moved (a sheet was added or removed) flashes
// once, and an edited memo can say what changed since the edit began.
const view = { counts: null, sheetsAtEdit: null, textAtEdit: null };

function leadText(n) {
  return "自分で選んだ条件と、次に確認したいこと。必要に応じて書き換えられます。";
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

function noticeText(state, generated) {
  const n = state.properties.length;
  if (state.memoEditVersion != null && state.sheetsVersion !== state.memoEditVersion) {
    if (n > view.sheetsAtEdit) return "図面が増えました";
    if (n < view.sheetsAtEdit) return "図面が減りました";
    return "図面が変わりました";
  }
  if (view.textAtEdit != null && generated !== view.textAtEdit) return "選んだ条件が変わりました";
  return "";
}

/** Grow the textarea to its text, so the whole memo reads without an inner scrollbar. */
function fitMemo(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight + 2}px`;
}

/** Put the memo in the textarea unless the person is editing it; show 元に戻す and what changed since the edit. */
function renderMemoText(state, generated) {
  const textarea = $("#memo");
  const edited = state.memoEdit != null;
  if (!edited) {
    view.sheetsAtEdit = null;
    view.textAtEdit = null;
    if (textarea.value !== generated) textarea.value = generated;
  } else if (document.activeElement !== textarea && textarea.value !== state.memoEdit) {
    textarea.value = state.memoEdit;
  }
  fitMemo(textarea);
  $("#memoReset").hidden = !edited;
  const notice = edited ? noticeText(state, generated) : "";
  $("#memoNotice").hidden = !notice;
  $("#memoNoticeText").textContent = notice;
}

/** Only the memo text and its controls: after the person typed, or asked for the generated text back. */
export function renderMemo(app) {
  const { state } = app.extensions.store;
  renderMemoText(state, buildTenantMemo(state).text);
}

export function renderNeeds(app) {
  const { state } = app.extensions.store;
  const n = state.properties.length;
  const memo = buildTenantMemo(state);
  const generated = memo.text;

  $("#needsLead").textContent = leadText(n);

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

  renderMemoText(state, generated);
  $("#copyMemo").disabled = false;
}

/** Copy with the Clipboard API; where it is refused, select the text and try the older copy command. */
async function copyMemo() {
  const textarea = $("#memo");
  const status = $("#memoStatus");
  status.textContent = "";
  try {
    if (!navigator.clipboard?.writeText) throw new Error("unavailable");
    await navigator.clipboard.writeText(textarea.value);
    status.textContent = "コピーしました";
  } catch {
    textarea.focus();
    textarea.select();
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
  const textarea = $("#memo");

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

  textarea.addEventListener("input", () => {
    const generated = buildTenantMemo(store.state).text;
    if (store.state.memoEdit == null) {
      view.sheetsAtEdit = store.state.properties.length;
      view.textAtEdit = generated;
    }
    // Typing the generated text back is the same as not having edited it.
    store.setMemoEdit(textarea.value === generated ? null : textarea.value);
    $("#memoStatus").textContent = "";
  });
  const reset = () => {
    store.setMemoEdit(null);
    $("#memoStatus").textContent = "";
    textarea.focus();
  };
  $("#memoReset").addEventListener("click", reset);
  $("#memoRebuild").addEventListener("click", reset);
  $("#copyMemo").addEventListener("click", copyMemo);
  // Line wrapping changes with the width and once the web font arrives.
  window.addEventListener("resize", () => fitMemo(textarea));
  document.fonts?.ready.then(() => fitMemo(textarea));
}
