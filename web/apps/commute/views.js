import { escapeHTML as e } from "../../helper.js";

export function linksMarkup(rows, destination) {
  if (!rows.length) return "<p>候補を追加すると、通勤経路を確認できます。</p>";
  if (!destination) return "";
  return `<div class="commute-links">${rows
    .map(
      (row) => `<article class="commute-candidate">
    <div><h4>${e(row.name)}</h4><p class="section-hint">${e(row.origin || "所在地は未取得です。候補の情報を補完すると確認できます。")}${row.approximate ? " · 建物名で検索するため、地点の確認が必要です。" : ""}</p></div>
    ${
      row.outbound && row.returning
        ? `<div class="commute-actions">
      <a class="button button--primary" data-commute-link="outbound" href="${e(row.outbound)}" target="_blank" rel="noopener noreferrer" aria-label="${e(row.name)}から${e(destination)}への行きを Google Maps で確認（新しいタブ）">行きの経路 ↗</a>
      <a class="button" data-commute-link="return" href="${e(row.returning)}" target="_blank" rel="noopener noreferrer" aria-label="${e(destination)}から${e(row.name)}への帰りを Google Maps で確認（新しいタブ）">帰りの経路 ↗</a>
    </div>`
        : row.origin
          ? '<p class="section-hint">検索条件が長すぎます。目的地を短い名称・住所にしてください。</p>'
          : ""
    }
  </article>`,
    )
    .join("")}</div>`;
}

export const markup = `<section class="feature-section" id="commuteSection" aria-labelledby="commuteSectionTitle">
<h3 id="commuteSectionTitle">どこへ通いますか？</h3>
<label class="destination-preset">東京の主な通勤先<select id="destinationPreset"></select></label>
<p id="destinationSuggestion" class="section-hint"></p>
<form id="destinationForm" class="inline-form" hidden><label>勤務先・駅・住所<input id="destinationQuery" maxlength="300" placeholder="例：勤務先の住所" /></label></form>
<form id="commuteForm" class="feature-form commute-form">
<label>移動方法<select name="mode"><option value="transit">公共交通＋徒歩</option><option value="walking">徒歩</option></select></label>
<details class="commute-options"><summary>確認する日時を変更 · 初期値は朝8時／夕18時</summary><div class="commute-option-fields">
<label>地図で確認する日（日本時間）<input name="date" type="date" /></label>
<label>行き · 到着時刻<input name="morning" type="time" value="08:00" /></label>
<label>帰り · 出発時刻<input name="evening" type="time" value="18:00" /></label>
</div></details></form>
<div class="commute-handoff"><p id="commuteSchedule"></p><p id="commuteTimeNotice" class="section-hint">起点・終点・公共交通は入力済みで開きます。日時は引き継げないため、Google Maps で上記の日時を設定してください。</p></div>
<div class="commute-results-heading"><h3>候補から Google Maps で確認</h3><p class="section-hint">新しいタブで開きます。所要時間・運賃・運行状況は地図上で確認できます。</p></div>
<p id="commuteStatus" role="status" aria-live="polite"></p><div id="commuteResults"></div>
<p class="section-hint">駅を選ぶと駅までの経路です。起終点の位置も地図で確認してください。検索結果はこのアプリに取り込まれません。</p></section>`;
