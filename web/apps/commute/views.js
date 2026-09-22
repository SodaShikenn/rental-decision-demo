import { escapeHTML as e } from "../../helper.js";
import {
  sourceLink,
  attribution,
  mapsCredit,
  formatTime,
} from "../../shared/maps.js";
import { OBJECTIVES, commuteQuestion } from "./services.js";
const unknown = (value) => (value == null ? "未取得" : value);
function fareText(fare) {
  if (!fare?.currencyCode) return "運賃未取得";
  const value = Number(fare.units || 0) + Number(fare.nanos || 0) / 1e9;
  return Number.isFinite(value)
    ? `${value.toLocaleString("ja-JP")} ${e(fare.currencyCode)}（片道目安）`
    : "運賃未取得";
}
function legMarkup(leg, label, objective) {
  if (!leg)
    return `<section class="journey-leg"><h5>${label}</h5><p>未取得</p></section>`;
  return `<section class="journey-leg"><h5>${label}</h5>${leg.routes.length ? leg.routes.map((r, i) => `<div class="route-option"><strong>${r.minutes}分</strong> <span>徒歩 ${unknown(r.walkingMinutes)}分 · 乗換 ${unknown(r.transfers)}回</span>${i === leg.recommended ? `<span class="route-reason">取得した経路内で「${OBJECTIVES[objective]}」に合う</span>` : ""}<p>${fareText(r.fare)}</p><details><summary>経路の詳細</summary>${r.lines.map((l) => `<p>${e(l.name)}：${e(l.from)} → ${e(l.to)}<br>乗車 ${e(formatTime(l.departure))} / 降車 ${e(formatTime(l.arrival))}<br>${l.agencies.map((a) => sourceLink(a.uri, a.name)).join(" · ")}</p>`).join("") || "<p>路線情報はありません。</p>"}${r.warnings.map((w) => `<p>${e(w)}</p>`).join("")}</details></div>`).join("") : `<p>${{ address_unverified: "住所を特定できません。番地まで確認してください。", no_route: "対応する経路が返りませんでした。", unavailable: "この候補の経路を取得できませんでした。" }[leg.status] || "経路は未取得です。"}</p>`}${sourceLink(leg.url, "地図で経路を確認（日時は再設定）")}</section>`;
}
export function resultsMarkup(result) {
  const question = commuteQuestion(result);
  const legs = result.candidates.flatMap((c) => [
    c,
    ...(c.returnTrip ? [c.returnTrip] : []),
  ]);
  const checked = legs.filter((leg) => leg.status === "checked").length;
  const unavailable = legs.filter((leg) => leg.status === "unavailable").length;
  const noRoutes = legs.filter((leg) => leg.status === "no_route").length;
  return `<p>${mapsCredit} · ${e(formatTime(result.checkedAt))}取得 · ${sourceLink(result.destination.url, result.destination.name)}</p><p class="section-hint">${e(result.destination.address)} ${attribution(result.destination.attributions)}</p>
    <p class="section-hint">${result.schedule.mode === "TRANSIT" ? `行き：${e(formatTime(result.schedule.at))} ${result.schedule.timeKind === "arrival" ? "到着" : "出発"}${result.schedule.returnAt ? ` ／ 帰り：${e(formatTime(result.schedule.returnAt))} 出発` : ""}` : "徒歩の推定。時刻表は使用しません。"} · 日本時間</p>
    <div class="commute-availability">${checked} / ${legs.length}経路を取得${noRoutes ? ` · ${noRoutes}経路は検索結果なし` : ""}${unavailable ? ` · ${unavailable}経路は接続エラー` : ""}${result.schedule.mode === "TRANSIT" && noRoutes ? "<p>Google Maps API から対応する公共交通経路が返りませんでした。下の地図リンクで日時を設定して確認できます。徒歩時間での代用はしません。</p>" : ""}</div>
    <div class="journey-results">${result.candidates.map((c) => `<article class="journey-candidate"><h4>${e(c.name)}</h4>${c.origin ? `<p class="section-hint">住所：${e(c.origin.address)}</p>` : ""}<div class="journey-legs">${legMarkup(c, "行き · 候補 → 目的地", result.schedule.objective)}${result.schedule.returnAt ? legMarkup(c.returnTrip, "帰り · 目的地 → 候補", result.schedule.objective) : ""}</div></article>`).join("")}</div>
    <p class="section-hint">取得した候補経路内の比較です。入口・運行・運賃は変わります。詳細内の乗車・降車時刻には前後の徒歩を含みません。</p>
    ${
      question
        ? `<div class="context-question"><p>${e(question.evidence)}</p><h4>${e(question.text)}</h4><div class="choice-row">${Object.entries(
            OBJECTIVES,
          )
            .map(
              ([key, label]) =>
                `<button class="button" data-commute-choice="${key}">${label}</button>`,
            )
            .join(
              "",
            )}<button class="button button--text" data-commute-choice="later">まだ決めない</button></div><div id="commuteConfirm"></div></div>`
        : ""
    }`;
}
export const markup = `<section class="feature-section" id="commuteSection" aria-labelledby="commuteSectionTitle">
<h3 id="commuteSectionTitle">どこへ通いますか？</h3>
<label class="destination-preset">東京の主な通勤先<select id="destinationPreset"></select></label>
<p id="destinationSuggestion" class="section-hint"></p>
<form id="destinationForm" class="inline-form" hidden><label>勤務先・駅・住所<input id="destinationQuery" enterkeyhint="search" maxlength="300" required minlength="2" placeholder="例：勤務先の住所" /></label><button class="button" type="submit">目的地を探す</button></form><div id="destinationChoices"></div><p id="destinationConfirmed"></p>
<form id="commuteForm" class="feature-form commute-form">
<label>比較する日（日本時間）<input name="date" type="date" required /></label>
<label>行き · 目的地に到着<input name="morning" type="time" value="08:00" required /></label>
<label>帰り · 目的地を出発<input name="evening" type="time" value="18:00" required /></label>
<details class="commute-options"><summary>移動方法・出勤日数など</summary><div class="commute-option-fields">
<label>移動方法<select name="mode"><option value="TRANSIT">公共交通＋徒歩</option><option value="WALK">徒歩</option></select></label>
<label>通う頻度<select name="daysPerWeek">${[0, 1, 2, 3, 4, 5, 6, 7].map((n) => `<option value="${n}" ${n === 3 ? "selected" : ""}>週${n}日</option>`).join("")}</select></label>
<label>今回の経路比較<select name="objective">${Object.entries(OBJECTIVES)
  .map(([key, label]) => `<option value="${key}">${label}</option>`)
  .join("")}</select></label>
</div></details><button class="button button--primary" type="submit">朝・夕の経路を確認</button></form>
<p class="section-hint">駅の代表地点までの比較です。勤務先の建物までは含みません。目的地と経路は再読み込みで消えます。</p>
<p id="commuteCoverage" class="commute-availability">日本の電車・バスはアプリ内で所要時間を取得できません。各候補の Google Maps リンクで日時を設定して確認できます。<a href="https://developers.google.com/maps/faq#transit_directions_countries" target="_blank" rel="noopener noreferrer">対応範囲 ↗</a></p>
<p id="commuteStatus" role="status" aria-live="polite"></p><div id="commuteResults"></div></section>`;
