import { escapeHTML as e } from "../../helper.js";
import {
  sourceLink,
  attribution,
  mapsCredit,
  formatTime,
} from "../../shared/maps.js";
import { CATEGORIES, availableInterests } from "./services.js";
export const markup = `<details class="feature-section" id="leisureSection"><summary>周辺から余暇の希望を見つける</summary><p>候補の周りに何があるかを見てから、使いたい場所を考えます。</p><button class="button" id="discoverLeisure">全候補の公園・ジム・カフェを調べる</button><p id="leisureStatus" role="status"></p><div id="leisureResults"></div><div id="leisureQuestion"></div><div id="leisureConfirm"></div><details id="regularDestination" hidden><summary>すでに通っている場所と比べたい</summary><form id="regularForm" class="inline-form"><label>施設名・住所<input id="regularQuery" required minlength="2" maxlength="300" /></label><button class="button">場所を探す</button></form><div id="regularChoices"></div></details></details>`;
export function resultsMarkup(result) {
  return `<p>${mapsCredit} · ${e(formatTime(result.checkedAt))}取得</p><p class="section-hint">${result.destination ? "選んだ場所までの徒歩経路。長距離は地図で交通手段を確認してください。" : "半径1.5km・カテゴリごとに直線距離順で最大2件。徒歩最短・網羅性の保証はありません。"}</p>${result.candidates.map((c) => `<article class="leisure-candidate"><h4>${e(c.name)}</h4>${c.status !== "checked" ? `<p>${c.status === "address_unverified" ? "住所を確認してください。" : "周辺情報を取得できませんでした。"}</p>` : c.groups.map((g) => `<div><h4>${CATEGORIES[g.kind]}</h4>${g.error ? `<p>${e(g.error)}</p>` : !g.places.length ? "<p>検索結果なし。施設が存在しないという意味ではありません。</p>" : g.places.map((p) => `<p>${sourceLink(p.url, p.name)} · 徒歩 ${p.route?.minutes == null ? "未取得" : `${p.route.minutes}分`} · ${p.route?.meters == null ? "距離未取得" : `${p.route.meters}m`}<br><span class="section-hint">${e(p.address)} · ${p.businessStatus === "OPERATIONAL" ? "営業状態：営業施設（今の営業は未確認）" : p.businessStatus === "CLOSED_PERMANENTLY" ? "閉業" : p.businessStatus === "CLOSED_TEMPORARILY" ? "一時休業" : "営業状態未確認"}</span><br>${sourceLink(p.routeUrl, "徒歩経路")} ${attribution(p.attributions)}</p>${p.hours?.length ? `<details><summary>掲載営業時間</summary>${p.hours.map((h) => `<p>${e(h)}</p>`).join("")}<p>訪問予定時刻の営業は未確認です。</p></details>` : ""}`).join("")}</div>`).join("")}</article>`).join("")}`;
}
export function questionMarkup(result) {
  const interests = availableInterests(result);
  return interests.length
    ? `<div class="context-question"><h4>この周辺なら、普段使いしたい場所はありますか？</h4><p>近いことだけで、好みや使いやすさは判断しません。</p><div class="choice-row">${interests.map((i) => `<button class="button" data-interest="${i.key}">${i.label}を使いたい</button>`).join("")}<button class="button" data-interest="none">どれも重視しない</button><button class="button" data-interest="later">まだ分からない</button></div></div>`
    : "<p>場所の情報が足りないため、希望は推測しません。</p>";
}
