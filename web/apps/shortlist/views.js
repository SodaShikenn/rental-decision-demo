// Shortlist DOM: routine controls, candidate cards, and mock-map pins.
import { MAX_PRIORITIES } from "../../config.js";
import { $, $$, escapeHTML, yen } from "../../helper.js";
import { isProvisional, priorityLabel, rankProperties, scoreProperty } from "./services.js";

function candidateCard(property, index, { selectedId, preferences }) {
  const provisional = isProvisional(property);
  return `
    <button type="button" class="candidate ${property.id === selectedId ? "selected" : ""}" data-property="${escapeHTML(property.id)}">
      <span class="candidate-rank">${String(index + 1).padStart(2, "0")}</span><span class="candidate-score">${provisional ? "暫定 " : ""}${scoreProperty(property, preferences)} / 99</span>
      <h3>${escapeHTML(property.name)}</h3>
      <p class="area">${escapeHTML(property.area)}</p>
      <p class="rent">${property.rent == null ? "賃料 未取得" : `${yen(property.rent)} <small>/ 月</small>`}</p>
      <div class="candidate-stats">
        <span>通勤<b>${provisional ? "未取得" : `${property.commute}分`}</b></span>
        <span>周辺情報<b>${provisional ? "未取得" : `${property.late}/10`}</b></span>
      </div>
    </button>
  `;
}

export function renderCandidates(app) {
  const { state } = app.extensions.store;
  const ranked = rankProperties(state.properties, state.preferences);
  $("#candidateGrid").innerHTML = ranked.map((property, index) => candidateCard(property, index, state)).join("");
  $("#decisionSummary").textContent = `予算 ${yen(state.preferences.budget)} / ${[...state.preferences.priorities].map(priorityLabel).join("・")} を優先中`;
  $("#shortlistCount").textContent = String(state.properties.length).padStart(2, "0");
}

export function bindControls(app) {
  const { store } = app.extensions;
  const { preferences } = store.state;

  $("#candidateGrid").addEventListener("click", (event) => {
    const card = event.target.closest("[data-property]");
    if (card) store.select(card.dataset.property);
  });
  $$(".map-pin[data-property]").forEach((pin) => pin.addEventListener("click", () => store.select(pin.dataset.property)));

  const budget = $("#budget");
  budget.addEventListener("input", () => {
    preferences.budget = Number(budget.value);
    $("#budgetOutput").value = yen(preferences.budget);
  });
  $("#priorityChips").addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    const key = button.dataset.priority;
    if (preferences.priorities.has(key)) preferences.priorities.delete(key);
    else if (preferences.priorities.size < MAX_PRIORITIES) preferences.priorities.add(key);
    $$(".priority-chip").forEach((chip) => chip.classList.toggle("active", preferences.priorities.has(chip.dataset.priority)));
  });
  $("#weekend").addEventListener("change", (event) => {
    preferences.weekend = event.target.checked;
  });
  $("#recalculate").addEventListener("click", () => {
    const [best] = rankProperties(store.state.properties, preferences);
    store.select(best.id);
    store.emit("recalculated", best);
  });
}
