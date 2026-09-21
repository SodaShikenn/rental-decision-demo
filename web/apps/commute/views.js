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
export function resultsMarkup(result) {
  const question = commuteQuestion(result);
  return `<p>${mapsCredit} · ${e(formatTime(result.checkedAt))}取得 · ${sourceLink(result.destination.url, result.destination.name)}</p><p class="section-hint">${e(result.destination.address)} ${attribution(result.destination.attributions)}</p>
    <p class="section-hint">${result.schedule.mode === "TRANSIT" ? `${e(formatTime(result.schedule.at))} ${result.schedule.timeKind === "arrival" ? "到着" : "出発"}指定` : "徒歩の推定。時刻表は使用しません。"} · 日本時間 · 全候補で同じ条件</p>
    <div class="journey-results">${result.candidates.map((c) => `<article class="journey-candidate"><h4>${e(c.name)}</h4>${c.origin ? `<p class="section-hint">出発：${e(c.origin.address)}</p>` : ""}${c.routes.length ? c.routes.map((r, i) => `<div class="route-option"><strong>${r.minutes}分</strong> <span>徒歩 ${unknown(r.walkingMinutes)}分 · 乗換 ${unknown(r.transfers)}回</span>${i === c.recommended ? `<span class="route-reason">取得した経路内で「${OBJECTIVES[result.schedule.objective]}」に合う</span>` : ""}<p>${fareText(r.fare)}</p><details><summary>経路の詳細</summary>${r.lines.map((l) => `<p>${e(l.name)}：${e(l.from)} → ${e(l.to)}<br>乗車 ${e(formatTime(l.departure))} / 降車 ${e(formatTime(l.arrival))}<br>${l.agencies.map((a) => sourceLink(a.uri, a.name)).join(" · ")}</p>`).join("") || "<p>路線情報はありません。</p>"}${r.warnings.map((w) => `<p>${e(w)}</p>`).join("")}</details></div>`).join("") : `<p>${{ address_unverified: "住所を特定できません。番地まで確認してください。", no_route: "対応する経路が返りませんでした。", unavailable: "この候補の経路を取得できませんでした。" }[c.status] || "経路は未取得です。"}</p>`}${sourceLink(c.url, "地図で経路を確認（日時は再設定）")}</article>`).join("")}</div>
    <p class="section-hint">取得した候補経路内の比較です。入口・運行・運賃は変わります。乗車・降車時刻には前後の徒歩を含みません。</p>
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
export const markup = `<details class="feature-section" id="commuteSection"><summary>勤務先への通勤を比べる</summary><p>候補から同じ目的地までの経路を比較します。目的地と取得結果はこのタブだけで使用します。</p>
<form id="destinationForm" class="inline-form"><label>勤務先・駅・住所<input id="destinationQuery" maxlength="300" required minlength="2" placeholder="例：渋谷駅" /></label><button class="button" type="submit">目的地を探す</button></form><div id="destinationChoices"></div><p id="destinationConfirmed"></p>
<form id="commuteForm" class="feature-form"><label>日時（日本時間）<input name="at" type="datetime-local" required /></label><label>基準<select name="timeKind"><option value="arrival">この時刻に到着</option><option value="departure">この時刻に出発</option></select></label><label>移動方法<select name="mode"><option value="TRANSIT">公共交通＋徒歩</option><option value="WALK">徒歩</option></select></label><label>通う頻度<select name="daysPerWeek">${[0, 1, 2, 3, 4, 5, 6, 7].map((n) => `<option value="${n}" ${n === 3 ? "selected" : ""}>週${n}日</option>`).join("")}</select></label><label>今回の経路比較<select name="objective">${Object.entries(
  OBJECTIVES,
)
  .map(([key, label]) => `<option value="${key}">${label}</option>`)
  .join(
    "",
  )}</select></label><button class="button" type="submit">全候補の通勤を比較</button></form><p id="commuteStatus" role="status"></p><div id="commuteResults"></div></details>`;
