// Insights DOM: why the selected candidate fits, its rent history, and resident reviews.
import { $, escapeHTML, yen } from "../../helper.js";
import { provenanceText } from "../intake/services.js";
import { isProvisional, priorityLabel, rankProperties } from "../shortlist/services.js";

function priorityDetail(priority, property) {
  if (priority === "commute") return `通勤 ${property.commute}分`;
  if (priority === "late") return `夜の買い物利便性 ${property.late}/10`;
  if (priority === "quiet") return `静けさ ${property.quiet}/10`;
  return `作業空間 ${property.space}/10`;
}

function renderChart(property) {
  if (property.hasRentHistory === false) {
    $("#rentChart").innerHTML = '<div class="empty-data">画像から確認できるのは現在の募集賃料のみです。履歴データの接続が必要です。</div>';
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
  $("#rentChart").innerHTML = `
    <svg class="chart-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <polyline fill="none" stroke="#195c43" stroke-width="2.4" vector-effect="non-scaling-stroke" points="${points}" />
      <circle cx="100" cy="${points.split(" ").at(-1).split(",")[1]}" r="2.8" fill="#d8f64b" stroke="#195c43" vector-effect="non-scaling-stroke" />
    </svg>`;
}

export function renderSelected(app) {
  const { store } = app.extensions;
  const { preferences, properties } = store.state;
  const property = store.selected();
  const provisional = isProvisional(property);
  const priorities = [...preferences.priorities];
  const priorityNames = priorities.map(priorityLabel).join("・");
  const fitText = provisional
    ? `募集図面で確認した項目（賃料・間取りなど）のみで暫定評価しています。「${priorityNames}」の実測データは未取得です。`
    : `優先した「${priorityNames}」では、${priorities.map((priority) => priorityDetail(priority, property)).join("、")}です。`;
  const whyText = provisional
    ? `${property.rent == null ? "賃料未取得" : yen(property.rent)}、${escapeHTML(property.area)}を原本確認用の候補情報として追加しました。`
    : `${property.tags.map(escapeHTML).join("、")}は、現在の暮らし方と合う要素です。`;
  const rank = rankProperties(properties, preferences).findIndex((item) => item.id === property.id) + 1;

  $("#selectedCard").innerHTML = `
    <p class="eyebrow">CURRENTLY SELECTED / ${String(rank).padStart(2, "0")}</p>
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
  $("#chartTitle").textContent = provisional ? `${property.name}｜賃料履歴は未取得` : `${property.name}｜掲載賃料の推移`;
  $("#chartPeriod").textContent = provisional ? "現在の募集賃料のみ" : "過去12か月の掲載賃料";
  $("#chartFootnote").textContent = provisional
    ? "掲載・成約履歴の提供元へ接続するまで、推移は評価に使用しません。"
    : "掲載価格の推移を想定したデモデータです。実取引賃料ではありません。";
  $("#reviewCount").textContent = `${property.reviews.length} 件`;
  $("#reviews").innerHTML = property.reviews.length
    ? property.reviews.map((review) => `
      <div class="review"><div class="review-meta"><span>${escapeHTML(review.from)}</span><span>DEMO</span></div><span>${escapeHTML(review.text)}</span></div>
    `).join("")
    : '<div class="empty-data">再利用許諾済みの居住者レビューは未取得です。</div>';
}
