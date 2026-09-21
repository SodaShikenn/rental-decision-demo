// Move-in cost DOM: settings shared by every candidate, a comparison of totals, and the selected
// candidate's breakdown, where each row says where its amount comes from.
import { $, escapeHTML, man, termButton, yen } from "../../helper.js";
import { termFor } from "../glossary/services.js";
import { BROKERAGE_OPTIONS, ROW_TERMS, SOURCES } from "./models.js";
import { estimateCosts } from "./services.js";

const clip = (text, length = 40) => (text.length > length ? `${text.slice(0, length)}…` : text);

/** "42.86万円", or "2万円＋未取得" when an included row has no amount yet. */
export function totalText({ amount, complete }) {
  return complete ? man(amount) : `${man(amount)}＋未取得`;
}

function sourceCell(row) {
  if (row.source === "sheet" && row.cost?.sourceText) {
    return `<span class="source-label">${SOURCES.sheet}</span>「${escapeHTML(clip(row.cost.sourceText))}」`;
  }
  return `<span class="source-label">${SOURCES[row.source]}</span>`;
}

function rowMarkup(row) {
  const term = ROW_TERMS[row.key] ?? termFor(row.label);
  const label = `${escapeHTML(row.label)}${term ? termButton(term, row.label) : ""}`;
  const name = row.toggleable ? `<label class="cost-toggle"><input type="checkbox" data-toggle="${escapeHTML(row.key)}"${row.included ? " checked" : ""} />${label}</label>` : label;
  return `
    <tr${row.included ? "" : ' class="is-excluded"'}>
      <td>${name}${row.note ? `<small>${escapeHTML(row.note)}</small>` : ""}</td>
      <td class="num">${row.amount == null ? '<span class="unknown">未取得</span>' : yen(row.amount)}</td>
      <td class="cost-source">${sourceCell(row)}</td>
    </tr>`;
}

function laterMarkup(estimate) {
  const extras = estimate.rows.monthly.filter((row) => row.key !== "rent" && row.included);
  const lines = [
    ["入居後の毎月", `${estimate.monthly.complete ? yen(estimate.monthly.amount) : "未取得"}${extras.length ? `（家賃＋管理費に、${extras.map((row) => escapeHTML(row.label)).join("・")}を含む）` : ""}`],
    ["毎年", estimate.rows.yearly.filter((row) => row.included).map((row) => `${escapeHTML(row.label)} ${row.amount == null ? "未取得" : yen(row.amount)}`).join("、")],
    ["更新時（多くは2年ごと）", estimate.rows.renewal.map((row) => `${escapeHTML(row.label)} ${row.amount == null ? "未取得" : yen(row.amount)}`).join("、")],
    ["退去時", estimate.rows.moveOut.map((row) => `${escapeHTML(row.label)} ${row.amount == null ? "未取得" : yen(row.amount)}`).join("、")],
  ].filter(([, text]) => text);
  return `<dl class="costs-later">${lines.map(([term, text]) => `<div><dt>${term}</dt><dd>${text}</dd></div>`).join("")}</dl>`;
}

function compareMarkup(estimates, selectedId) {
  const max = Math.max(1, ...estimates.map(({ estimate }) => estimate.initial.amount));
  return [...estimates]
    .sort((a, b) => Number(b.estimate.initial.complete) - Number(a.estimate.initial.complete) || a.estimate.initial.amount - b.estimate.initial.amount)
    .map(({ property, estimate }) => {
      const selected = property.id === selectedId;
      return `
        <li>
          <button type="button" class="compare-row${selected ? " is-selected" : ""}" data-property="${escapeHTML(property.id)}"${selected ? ' aria-current="true"' : ""}>
            <span class="compare-name">${escapeHTML(property.name)}</span>
            <span class="compare-bar${estimate.initial.complete ? "" : " is-partial"}"><span style="width:${Math.round((estimate.initial.amount / max) * 100)}%"></span></span>
            <span class="compare-total">${totalText(estimate.initial)}</span>
            <span class="compare-monthly">毎月 ${estimate.monthly.complete ? man(estimate.monthly.amount) : "未取得"}</span>
          </button>
        </li>`;
    })
    .join("");
}

function detailMarkup(property, estimate, adjustment) {
  const rentInput = property.rent == null
    ? `<div class="rent-assume">
        <label for="rentAssumed">この図面には賃料がありません。問い合わせた賃料を入れると計算できます</label>
        <span class="rent-assume-input"><input id="rentAssumed" type="text" inputmode="numeric" autocomplete="off" placeholder="例：98000" value="${adjustment.rentOverride ?? ""}" />円</span>
      </div>`
    : "";
  return `
    <h3>${escapeHTML(property.name)}の内訳</h3>
    ${rentInput}
    ${estimate.rentAssumed ? `<p class="costs-assumed">賃料 ${yen(adjustment.rentOverride)}（入力した仮の値）で計算しています。</p>` : ""}
    <div class="table-wrap">
      <table class="costs-table">
        <thead><tr><th scope="col">入居時に払うもの</th><th class="num" scope="col">金額</th><th scope="col">根拠</th></tr></thead>
        <tbody>${estimate.rows.initial.map(rowMarkup).join("")}</tbody>
        <tfoot><tr><th scope="row">初期費用の合計</th><td class="num">${estimate.initial.complete ? yen(estimate.initial.amount) : `${yen(estimate.initial.amount)}＋未取得`}</td><td></td></tr></tfoot>
      </table>
    </div>
    ${estimate.rows.monthly.length > 1 ? `
    <div class="table-wrap">
      <table class="costs-table">
        <thead><tr><th scope="col">毎月払うもの</th><th class="num" scope="col">金額</th><th scope="col">根拠</th></tr></thead>
        <tbody>${estimate.rows.monthly.map(rowMarkup).join("")}</tbody>
      </table>
    </div>` : ""}
    ${laterMarkup(estimate)}
    <p class="costs-note">チェックを外した項目は合計から除きます（交渉や任意の項目の確認に）。日割り家賃・前家賃・仲介手数料は図面に載らない費用で、一般的な慣行で計算しています。正式な金額は見積書で確認してください。</p>`;
}

export function renderCosts(app) {
  const { state } = app.extensions.store;
  const { properties, preferences, selectedId, costAdjustments } = state;
  const estimates = properties.map((property) => ({ property, estimate: estimateCosts(property, preferences, costAdjustments[property.id]) }));
  $("#costsCompare").innerHTML = compareMarkup(estimates, selectedId);
  const selected = estimates.find(({ property }) => property.id === selectedId) ?? estimates[0];
  const focused = document.activeElement?.id === "rentAssumed";
  $("#costsDetail").innerHTML = detailMarkup(selected.property, selected.estimate, costAdjustments[selected.property.id] ?? {});
  if (focused) {
    const input = $("#rentAssumed");
    input?.focus();
    input?.setSelectionRange?.(input.value.length, input.value.length);
  }
}

export function bindCosts(app) {
  const { store } = app.extensions;
  const { preferences } = store.state;
  const moveIn = $("#moveIn");
  moveIn.value = preferences.moveIn;
  moveIn.addEventListener("change", () => {
    if (!moveIn.value) return;
    store.updatePreferences((prefs) => {
      prefs.moveIn = moveIn.value;
    });
  });
  const options = $("#brokerageOptions");
  options.innerHTML = BROKERAGE_OPTIONS.map(({ months, label }) => `
    <label><input type="radio" name="brokerage" value="${months}"${months === preferences.brokerageMonths ? " checked" : ""} />${label}</label>`).join("");
  options.addEventListener("change", (event) => {
    store.updatePreferences((prefs) => {
      prefs.brokerageMonths = Number(event.target.value);
    });
  });
  $("#costsCompare").addEventListener("click", (event) => {
    const row = event.target.closest("[data-property]");
    if (row) store.select(row.dataset.property);
  });
  const detail = $("#costsDetail");
  detail.addEventListener("change", (event) => {
    const key = event.target.dataset.toggle;
    if (!key) return;
    store.adjustCosts(store.state.selectedId, (adjustment) => {
      adjustment.toggled = adjustment.toggled.includes(key) ? adjustment.toggled.filter((item) => item !== key) : [...adjustment.toggled, key];
    });
  });
  detail.addEventListener("input", (event) => {
    if (event.target.id !== "rentAssumed") return;
    const value = Number(event.target.value.normalize("NFKC").replace(/[,円\s]/g, ""));
    store.adjustCosts(store.state.selectedId, (adjustment) => {
      adjustment.rentOverride = Number.isFinite(value) && value > 0 ? value : null;
    });
  });
}
