import { escapeHTML as e } from "../../helper.js";
import { VIEWS } from "./navigation.js";

export function navigationMarkup() {
  return VIEWS.map(
    ({ key, label }) =>
      `<button id="tab-${key}" role="tab" aria-controls="panel-${key}" aria-selected="${key === "compare"}" tabindex="${key === "compare" ? "0" : "-1"}" data-workspace-tab="${key}">${label}${key === "compare" ? ' <span id="candidateCount" class="nav-count"></span>' : ""}</button>`,
  ).join("");
}
export function switcherMarkup() {
  return [...new Set(VIEWS.map((v) => v.group))]
    .map(
      (group) =>
        `<optgroup label="${group}">${VIEWS.filter((v) => v.group === group)
          .map((v) => `<option value="${v.key}">${v.label}</option>`)
          .join("")}</optgroup>`,
    )
    .join("");
}
export function headingMarkup(view) {
  const title = view.title
    .split(/(?<=、)/u)
    .map((part) => `<span>${part}</span>`)
    .join("");
  return `<p class="eyebrow">${view.eyebrow}</p><h2 id="heading-${view.key}">${title}</h2><p>${view.description}</p>`;
}
export function helpMarkup(view) {
  return `<h3>このページの使い方</h3><ol>${view.steps.map((step) => `<li>${step}</li>`).join("")}</ol><a href="#${view.next}" class="feature-next">${view.nextLabel} <span aria-hidden="true">→</span></a>`;
}
export function candidatesMarkup(properties) {
  if (!properties.length)
    return '<p>候補がありません。<a href="#compare">画像かリンクを追加して始める →</a></p>';
  return `<span class="candidate-scope-label">対象の候補 ${properties.length}件</span><span>${properties.map((p) => e(p.name)).join(" · ")}</span><a href="#compare">候補を管理 ↗</a>`;
}
