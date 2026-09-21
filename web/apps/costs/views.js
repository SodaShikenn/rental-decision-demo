// Move-in cost markup for the comparison table's popover: one sheet's estimate, where every row says
// where its amount comes from. Rows are read-only; the assumptions are stated in one line instead.
import { escapeHTML, man, termButton, yen } from "../../helper.js";
import { termFor } from "../glossary/services.js";
import { ROW_TERMS, SOURCES } from "./models.js";

const clip = (text, length = 40) => (text.length > length ? `${text.slice(0, length)}…` : text);
const dateText = (iso) => {
  const [year, month, day] = iso.split("-").map(Number);
  return `${year}/${month}/${day}`;
};

/** "42.86万円", or "2万円＋未取得" when an included row has no amount yet. */
export function totalText({ amount, complete }) {
  return complete ? man(amount) : `${man(amount)}＋未取得`;
}

const amountText = (amount) => (amount == null ? '<span class="unknown">未取得</span>' : yen(amount));

function sourceCell(row) {
  if (row.source === "sheet" && row.cost?.sourceText) {
    return `<span class="source-label">${SOURCES.sheet}</span>「${escapeHTML(clip(row.cost.sourceText))}」`;
  }
  return `<span class="source-label">${SOURCES[row.source]}</span>`;
}

function rowMarkup(row) {
  const term = ROW_TERMS[row.key] ?? termFor(row.label);
  // Optional items start outside the total; the estimate has no switches, so say so instead.
  const note = row.included ? row.note : "任意の項目のため、合計に含めていません";
  return `
    <tr${row.included ? "" : ' class="is-excluded"'}>
      <td>${escapeHTML(row.label)}${term ? termButton(term, row.label) : ""}${note ? `<small>${escapeHTML(note)}</small>` : ""}</td>
      <td class="num">${amountText(row.amount)}</td>
      <td class="cost-source">${sourceCell(row)}</td>
    </tr>`;
}

function laterMarkup(estimate) {
  const list = (rows) => rows.map((row) => `${escapeHTML(row.label)} ${row.amount == null ? "未取得" : yen(row.amount)}`).join("、");
  const extras = estimate.rows.monthly.filter((row) => row.key !== "rent" && row.included);
  const lines = [
    ["入居後の毎月", `${estimate.monthly.complete ? yen(estimate.monthly.amount) : "未取得"}${extras.length ? `（家賃＋管理費に、${extras.map((row) => escapeHTML(row.label)).join("・")}を含む）` : ""}`],
    ["毎年", list(estimate.rows.yearly.filter((row) => row.included))],
    ["更新時（多くは2年ごと）", list(estimate.rows.renewal)],
    ["退去時", list(estimate.rows.moveOut)],
  ].filter(([, text]) => text);
  return `<dl class="costs-later">${lines.map(([term, text]) => `<div><dt>${term}</dt><dd>${text}</dd></div>`).join("")}</dl>`;
}

/**
 * One sheet's move-in estimate: the rows paid at contract, the monthly rows, what comes later, a rent
 * input when the sheet prints none, and the assumptions the estimate rests on.
 * @param rentOverride yen the person entered for a sheet without rent, or null
 * @param settings     { moveIn, brokerageMonths } the estimate was made with
 */
export function breakdownMarkup(property, estimate, rentOverride, settings) {
  const rentInput = property.rent == null
    ? `<div class="rent-assume">
        <label for="rentAssumed">この図面には賃料の記載がありません。問い合わせた賃料を入れると計算できます</label>
        <span class="rent-assume-input"><input id="rentAssumed" data-property="${escapeHTML(property.id)}" type="text" inputmode="numeric" autocomplete="off" placeholder="例：98000" value="${rentOverride ?? ""}" />円</span>
      </div>`
    : "";
  const total = estimate.initial.complete ? yen(estimate.initial.amount) : `${yen(estimate.initial.amount)}＋<span class="unknown">未取得</span>`;
  return `
    ${rentInput}
    ${estimate.rentAssumed ? `<p class="costs-assumed">賃料 ${yen(rentOverride)}（入力した仮の値）で計算しています。</p>` : ""}
    <div class="table-wrap">
      <table class="costs-table">
        <thead><tr><th scope="col">入居時に払うもの</th><th class="num" scope="col">金額</th><th scope="col">根拠</th></tr></thead>
        <tbody>${estimate.rows.initial.map(rowMarkup).join("")}</tbody>
        <tfoot><tr><th scope="row">初期費用の目安</th><td class="num">${total}</td><td></td></tr></tfoot>
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
    <p class="costs-note">入居${dateText(settings.moveIn)}想定・仲介手数料${settings.brokerageMonths}ヶ月＋税・前家賃込み。目安で、見積書の代わりにはなりません。</p>`;
}
