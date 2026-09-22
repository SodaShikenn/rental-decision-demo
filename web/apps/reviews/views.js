import { escapeHTML as e } from "../../helper.js";
import {
  sourceLink,
  formatTime,
  mapsCredit,
  attribution,
} from "../../shared/maps.js";
import { reviewTopics } from "./services.js";
export const markup = `<section class="feature-section" id="reviewsSection" aria-labelledby="reviewsSectionTitle">
  <h3 id="reviewsSectionTitle">この住まいの、気になる声。</h3>
  <p>まず部屋の口コミを探し、なければ同じ建物、さらに近隣のアパート・マンションへ。見つかった声だけを、出典とともに整理します。</p>
  <ol class="review-search-order" aria-label="口コミを探す順番"><li>この部屋</li><li>同じ建物</li><li>近隣300m以内</li></ol>
  <div class="review-toolbar"><label>調べる候補<select id="reviewCandidate"></select></label><button class="button" id="reviewSearch">再検索</button></div>
  <p class="section-hint">候補の掲載情報を使って自動分析します。希望の入力は不要です。</p>
  <p id="reviewStatus" role="status" aria-live="polite"></p><div id="reviewResults" aria-busy="false"></div><div id="reviewSuggestions"></div><p id="reviewExternal" class="section-hint"></p>
</section>`;
const SCOPES = {
  nearby_building: "近隣の参考情報",
  same_unit: "同じ部屋について",
  same_building: "建物について・部屋は未確認",
  other_unit: "同じ建物の別の部屋・部屋の一致は未確認",
};
export function resultsMarkup(result) {
  const reviews = result.reviews || [],
    topics = reviewTopics(reviews);
  if (!reviews.length) return "";
  return `<div class="review-summary"><strong>${result.tier === "nearby" ? "近くの建物から、周辺を知る手がかり" : result.tier === "building" ? "同じ建物で見つかった声" : "この物件で見つかった声"} · ${result.sourceCount}出典</strong><span>${e(formatTime(result.checkedAt))} 検索</span></div>
    <p class="section-hint">公開情報に基づくAIの要約です。住人であることは未確認で、現在の部屋にも当てはまるとは限りません。元のページも確認してください。</p>
    ${result.tier === "nearby" ? '<p class="review-reference-notice">対象の物件・建物の口コミは未取得のため、近隣の声を参考に表示しています。防音・管理・日当たりなど、別の建物の評価をこの候補に当てはめることはできません。</p>' : ""}
    ${reviews.map((r, i) => `<article class="review-entry" id="review-${i}"><div class="review-meta"><span class="review-scope">${e(SCOPES[r.scope] || "対象未確認")}${r.room ? ` · ${e(r.room)}号室` : ""}</span><span>${e(r.publishedDate || "投稿日不明")}</span></div>${r.reference ? `<p class="review-reference"><strong>${e(r.reference.name)}</strong> · 直線 約${e(r.reference.distanceMeters)}m<br><span>${e(r.reference.address)}</span></p>` : ""}<p>${e(r.text)}</p><p class="review-source">${sourceLink(r.url, r.sourceTitle || "出典を読む")}${r.reference ? `<br>${mapsCredit} · ${sourceLink(r.reference.url, "位置を確認")} ${attribution(r.reference.attributions)}` : ""}</p></article>`).join("")}
    ${topics.length ? `<div class="context-question"><h4>内見で、この声を確かめよう</h4><p>意見が分かれていても、どちらも手がかりに。以下は語句による分類で、評価の結論ではありません。</p>${topics.map((t) => `<p>${e(t.label)}：${t.indices.map((i) => `<a href="#review-${i}">要約${i + 1}</a>`).join("、")}</p><button class="button" data-review-topic="${t.key}">${e(t.question)} を確認事項に加える</button>`).join("")}</div>` : ""}
    ${result.otherPages?.length ? `<details class="review-excluded"><summary>口コミとして採用しなかったページ（${result.otherPages.length}件）</summary>${result.otherPages.map((s) => `<p>${sourceLink(s.url, s.title || "出典")}<br><span class="section-hint">${e(s.reason)}</span></p>`).join("")}</details>` : ""}`;
}
