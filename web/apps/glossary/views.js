// Glossary DOM: a dialog with search and categories, opened from the header or from any [data-term]
// button on the page (see termButton in helper.js).
import { $, $$, escapeHTML } from "../../helper.js";
import { CATEGORIES } from "./models.js";
import { glossaryEntry, searchGlossary } from "./services.js";

const view = { category: null, focus: null };

function render() {
  const query = $("#glossarySearch").value;
  const found = searchGlossary(query, view.category);
  // The term that was asked about comes first.
  const ordered = view.focus ? [...found.filter((item) => item.term === view.focus), ...found.filter((item) => item.term !== view.focus)] : found;
  $$("#glossaryTabs button").forEach((tab) => tab.setAttribute("aria-pressed", String((tab.dataset.category || null) === view.category)));
  $("#glossaryCount").textContent = `${ordered.length}語`;
  $("#glossaryList").innerHTML = ordered.length
    ? ordered.map((item) => `
      <div class="glossary-entry${item.term === view.focus ? " is-focus" : ""}">
        <dt>${escapeHTML(item.term)}<span class="glossary-category">${escapeHTML(item.category)}</span></dt>
        <dd>${escapeHTML(item.text)}</dd>
      </div>`).join("")
    : '<p class="empty-note">見つかりませんでした。別の言い方や、漢字の一部で探してみてください。</p>';
}

/** Open the dialog, optionally on one term. */
export function openGlossary(term = null) {
  const dialog = $("#glossaryDialog");
  const item = term ? glossaryEntry(term) : null;
  view.focus = item?.term ?? null;
  view.category = null;
  $("#glossarySearch").value = item ? item.term.replace(/（.*$/, "") : "";
  render();
  if (!dialog.open) dialog.showModal();
  $(".glossary-list").scrollTop = 0;
  (item ? $("#glossaryClose") : $("#glossarySearch")).focus();
}

export function bindGlossary() {
  const dialog = $("#glossaryDialog");
  $("#glossaryTabs").innerHTML = [["", "すべて"], ...CATEGORIES.map((category) => [category, category])]
    .map(([value, label]) => `<button type="button" data-category="${escapeHTML(value)}" aria-pressed="${value === ""}">${escapeHTML(label)}</button>`)
    .join("");
  $("#glossaryOpen").addEventListener("click", () => openGlossary());
  $("#glossaryClose").addEventListener("click", () => dialog.close());
  // A click on the backdrop (outside the panel) closes the dialog.
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  $("#glossarySearch").addEventListener("input", () => {
    view.focus = null;
    render();
  });
  $("#glossaryTabs").addEventListener("click", (event) => {
    const tab = event.target.closest("button[data-category]");
    if (!tab) return;
    view.category = tab.dataset.category || null;
    view.focus = null;
    $("#glossarySearch").value = "";
    render();
  });
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-term]");
    if (trigger && !dialog.contains(trigger)) openGlossary(trigger.dataset.term);
  });
}
