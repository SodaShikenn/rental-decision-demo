import { test } from "node:test";
import assert from "node:assert/strict";
import { DEMO_PROPERTIES } from "../../../apps/shortlist/models.js";
import { recalculatedMessage, respondToChat } from "../../../apps/chat/services.js";

const preferences = { budget: 130000, priorities: new Set(["commute", "late"]), weekend: true };
const context = { properties: DEMO_PROPERTIES, preferences };

test("cheaper option names the lowest rent and the commute cost", () => {
  const answer = respondToChat("1万円安くするなら？", context);
  assert.match(answer, /高円寺サイドノート/);
  assert.match(answer, /13,000安くなりますが、通勤は14分長くなります/);
});

test("candidates with unknown rent are never offered as the cheapest", () => {
  const imported = { id: "uploaded-listing", name: "謎の物件", rent: null, enriched: false, tradeoff: "" };
  const answer = respondToChat("安くするなら？", { ...context, properties: [...DEMO_PROPERTIES, imported] });
  assert.doesNotMatch(answer, /謎の物件/);
});

test("no nonsense difference when the top candidate's rent is unknown", () => {
  const imported = { id: "uploaded-listing", name: "未取得ハウス", rent: null, enriched: false, tradeoff: "" };
  const onlyImportedWins = { ...context, properties: [imported, { ...DEMO_PROPERTIES[2], rent: 116000 }], preferences: { ...preferences, budget: 90000 } };
  const answer = respondToChat("1万円安くするなら？", onlyImportedWins);
  assert.match(answer, /差額は比較できません/);
  assert.doesNotMatch(answer, /NaN|-￥/);
});

test("reason answer falls back to default priority labels when none are selected", () => {
  const answer = respondToChat("判断理由を教えて", { ...context, preferences: { ...preferences, priorities: new Set() } });
  assert.doesNotMatch(answer, /undefined/);
});

test("names from extracted listings are escaped", () => {
  const hostile = { ...DEMO_PROPERTIES[0], id: "x", name: "<img src=x onerror=alert(1)>", tradeoff: "<b>t</b>", rent: 1000 };
  const answer = respondToChat("おすすめは？", { ...context, properties: [hostile] });
  assert.doesNotMatch(answer, /<img|<b>/);
  assert.doesNotMatch(recalculatedMessage(hostile), /<img|<b>/);
});
