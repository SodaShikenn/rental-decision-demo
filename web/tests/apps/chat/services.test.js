import { test } from "node:test";
import assert from "node:assert/strict";
import { SHEETS } from "../../../data/sheets.js";
import { candidateFromSheet } from "../../../apps/intake/services.js";
import { SEED_SHEET_IDS } from "../../../apps/shortlist/models.js";
import { respondToChat } from "../../../apps/chat/services.js";

const preferences = { budget: 130000, priorities: new Set(["walk", "space"]), situations: new Set(), brokerageMonths: 1, moveIn: "2026-10-15" };
const candidates = SHEETS.map(candidateFromSheet);
const seeds = candidates.filter((candidate) => SEED_SHEET_IDS.includes(candidate.id));
const context = { properties: seeds, preferences, selectedId: "bresport" };
const QUESTIONS = ["初期費用が安いのは？", "契約前の注意点は？", "1万円安くするなら？", "駅近を優先すると？", "並び順の理由は？", "敷金償却とは？", "通勤時間は？", "こんにちは"];

test("answers compare facts and never choose for the renter", () => {
  for (const question of QUESTIONS) {
    for (const selectedId of ["bresport", "granpaseo-4", "louvre-shoto"]) {
      assert.doesNotMatch(respondToChat(question, { ...context, selectedId }), /最有力|おすすめ|すべき物件|決めました/, `${question} / ${selectedId}`);
    }
  }
});

test("the cheaper option is compared with the candidate being viewed", () => {
  const answer = respondToChat("1万円安くするなら？", context);
  assert.match(answer, /月額が最も安いのは<strong>ルーブル渋谷松濤 408号室<\/strong>で、今見ている<strong>Bresport（ブレスポート）<\/strong>より月20,000円安くなります/);
  assert.match(answer, /その代わり、駅徒歩は10分（今見ている候補は8分）、広さは20\.25㎡（同28\.8㎡）、築年は2001年（同2019年）です。/);
  // Only what is actually given up: the sample sheet is closer to the station than Bresport.
  const withSample = respondToChat("安くするなら？", { ...context, properties: candidates });
  assert.match(withSample, /月35,000円安くなります。その代わり、広さは21\.37㎡（同28\.8㎡）、築年は2001年（同2019年）です。/);
  assert.doesNotMatch(withSample, /駅徒歩は/);
});

test("a candidate without a printed rent is never offered as the cheapest or compared", () => {
  assert.doesNotMatch(respondToChat("安くするなら？", context), /GRAN PASEO/);
  const unpriced = respondToChat("1万円安くするなら？", { ...context, selectedId: "granpaseo-4" });
  assert.match(unpriced, /差額は比べられません/);
  assert.doesNotMatch(unpriced, /NaN|-￥/);
  assert.match(respondToChat("安くするなら？", { ...context, properties: candidates, selectedId: "monohouse" }), /今見ている<strong>モノハウス 104号室<\/strong>が、月額9\.5万円で最も安い候補です/);
});

test("the nearest station answer uses the walk printed on the sheets", () => {
  assert.match(respondToChat("駅近を優先すると？", context), /駅から最も近いのは<strong>GRAN PASEO明大前Ⅳ<\/strong>（井の頭線「東松原」駅 徒歩5分）/);
  assert.match(respondToChat("駅近を優先すると？", { ...context, properties: candidates }), /モノハウス 104号室/);
});

test("commute and reviews are answered as not connected, never estimated", () => {
  assert.match(respondToChat("通勤時間は？", context), /Routes API）が未接続/);
  assert.match(respondToChat("口コミの評判は？", context), /未接続のため表示していません/);
});

test("the order is explained from the renter's own conditions", () => {
  assert.match(respondToChat("並び順の理由は？", context), /一致度の順で<strong>Bresport（ブレスポート）<\/strong>が先頭なのは、月額が上限内、駅近（譲れない条件）で17\.5点、広さ（譲れない条件）で17\.3点だからです。一致度は選んだ条件から計算した目安/);
  const tight = respondToChat("なぜ？", { ...context, preferences: { ...preferences, budget: 110000 } });
  assert.match(tight, /予算は賃料未取得のため中立値/);
  assert.match(tight, /暫定の並びです/);
});

test("move-in costs are listed cheapest first, checks follow the renter's situation, terms come from the glossary", () => {
  const state = { ...context, properties: candidates };
  assert.match(respondToChat("初期費用が安いのは？", state), /安い順に並べると、モノハウス 104号室 42\.86万円、Bresport（ブレスポート） 57\.28万円、ルーブル渋谷松濤 408号室 65\.88万円です。GRAN PASEO明大前Ⅳは賃料が図面にないため計算できません/);
  assert.match(respondToChat("契約前の注意点は？", { ...state, selectedId: "monohouse" }), /特に確認したいのは、<strong>敷金・保証金の償却<\/strong>・<strong>保証会社の保証料<\/strong>・<strong>火災保険<\/strong>です。全部で10件/);
  const movingSoon = respondToChat("契約前の注意点は？", { ...state, selectedId: "monohouse", preferences: { ...preferences, situations: new Set(["moveSoon", "security"]) } });
  assert.match(movingSoon, /あなたの状況に関係するのは、<strong>短期解約違約金<\/strong>・<strong>1階の部屋<\/strong>です/);
  assert.match(respondToChat("追い焚きとは？", state), /^<strong>追い焚き<\/strong>：冷めた浴槽のお湯を温め直す機能/);
});

test("names from extracted listings are escaped", () => {
  const hostile = { ...seeds[0], id: "x", name: "<img src=x onerror=alert(1)>", station: "<b>駅</b> 徒歩1分", rent: 1000 };
  for (const question of QUESTIONS) {
    assert.doesNotMatch(respondToChat(question, { ...context, properties: [...seeds, hostile], selectedId: "x" }), /<img|<b>/);
  }
});
