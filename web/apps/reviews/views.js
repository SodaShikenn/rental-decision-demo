import { escapeHTML as e } from "../../helper.js";
import { sourceLink, formatTime } from "../../shared/maps.js";
import { reviewTopics } from "./services.js";
export const markup = `<section class="feature-section" id="reviewsSection" aria-labelledby="reviewsSectionTitle">
  <h3 id="reviewsSectionTitle">この建物、ネットではどう言われている？</h3>
  <p>候補を選ぶと、口コミサイトや公開の投稿を自動で調べます。見つかった声から、内見で確かめたいことを整理しましょう。</p>
  <div class="review-toolbar"><label>調べる候補<select id="reviewCandidate"></select></label><button class="button" id="reviewSearch">再検索</button></div>
  <p class="section-hint">建物名・住所・部屋番号・掲載リンクを使って検索します。画像や個人のメモは送信しません。</p>
  <p id="reviewStatus" role="status" aria-live="polite"></p><div id="reviewResults" aria-busy="false"></div><div id="reviewSuggestions"></div><p id="reviewExternal" class="section-hint"></p>
  <div class="review-own"><h3>自分の内見記録</h3><p class="section-hint">ネットの声とは別に、自分で見聞きしたことを残します。検索中でも記録できます。</p>
  <form id="observationForm" class="feature-form"><label>内見した日<input type="date" name="date" required /></label><label>自分で確認したこと<textarea name="text" maxlength="1000" rows="3" required placeholder="例：平日19時、窓を閉めた状態で道路の音を確認"></textarea></label><button class="button">自分の記録として保存</button></form><div id="ownObservations"></div></div></section>`;
const SCOPES = {
  same_unit: "同じ部屋について",
  same_building: "建物について・部屋は未確認",
  other_unit: "同じ建物の別の部屋・部屋の一致は未確認",
};
export function resultsMarkup(result) {
  const reviews = result.reviews || [],
    topics = reviewTopics(reviews);
  return `<div class="review-summary"><strong>${reviews.length ? `${result.sourceCount}つの出典から見つかった声` : "確認できる口コミは見つかりませんでした"}</strong><span>${e(formatTime(result.checkedAt))} 検索</span></div>
    <p class="section-hint">${reviews.length ? "以下は公開情報に基づくAIの要約です。住人であることは未確認で、現在の部屋にも当てはまるとは限りません。元のページも確認してください。" : "公開範囲で読み取れなかったり、建物を特定できない場合があります。口コミが見つからないことは、問題がない証拠ではありません。"}</p>
    ${reviews.map((r, i) => `<article class="review-entry" id="review-${i}"><div class="review-meta"><span class="review-scope">${e(SCOPES[r.scope] || "対象未確認")}${r.room ? ` · ${e(r.room)}号室` : ""}</span><span>${e(r.publishedDate || "投稿日不明")}</span></div><p>${e(r.text)}</p><p class="review-source">${sourceLink(r.url, r.sourceTitle || "出典を読む")}</p></article>`).join("")}
    ${topics.length ? `<div class="context-question"><h4>内見で、この声を確かめよう</h4><p>意見が分かれていても、どちらも手がかりに。以下は語句による分類で、評価の結論ではありません。</p>${topics.map((t) => `<p>${e(t.label)}：${t.indices.map((i) => `<a href="#review-${i}">要約${i + 1}</a>`).join("、")}</p><button class="button" data-review-topic="${t.key}">${e(t.question)} を確認事項に加える</button>`).join("")}</div>` : ""}
    ${result.otherPages?.length ? `<details class="review-excluded"><summary>口コミとして採用しなかったページ（${result.otherPages.length}件）</summary>${result.otherPages.map((s) => `<p>${sourceLink(s.url, s.title || "出典")}<br><span class="section-hint">${e(s.reason)}</span></p>`).join("")}</details>` : ""}`;
}
