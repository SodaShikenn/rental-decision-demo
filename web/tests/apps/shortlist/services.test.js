import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PREFERENCES } from "../../../config.js";
import { SHEETS } from "../../../data/sheets.js";
import { candidateFromSheet } from "../../../apps/intake/services.js";
import { SEED_SHEET_IDS } from "../../../apps/shortlist/models.js";
import {
  ageScore,
  budgetScore,
  isProvisional,
  monthlyCost,
  rankProperties,
  scoreBreakdown,
  scoreProperty,
  spaceScore,
  stationName,
  stationPosition,
  walkMinutes,
  walkScore,
} from "../../../apps/shortlist/services.js";

// Scores depend on building age, so the tests pin the year the sheets were recorded.
const YEAR = 2026;
const preferences = { ...DEFAULT_PREFERENCES, priorities: new Set(DEFAULT_PREFERENCES.priorities) };
const withPreferences = (overrides) => ({ ...preferences, ...overrides, priorities: new Set(overrides.priorities ?? preferences.priorities) });
const candidates = SHEETS.map(candidateFromSheet);
const seeds = candidates.filter((candidate) => SEED_SHEET_IDS.includes(candidate.id));
const byId = Object.fromEntries(candidates.map((candidate) => [candidate.id, candidate]));
const scores = (properties, prefs) => rankProperties(properties, prefs, YEAR).map((property) => [property.id, scoreProperty(property, prefs, YEAR)]);

test("station text from real sheets yields the walk and the station name", () => {
  const stations = Object.fromEntries(candidates.map(({ id, station }) => [id, [stationName(station), walkMinutes(station)]]));
  assert.deepEqual(stations, {
    monohouse: ["下北沢", 2],
    "louvre-shoto": ["代々木八幡", 10],
    bresport: ["下北沢", 8],
    "granpaseo-4": ["東松原", 5],
  });
  assert.equal(walkMinutes("京王井の頭線 新代田駅 歩13分"), 13);
  assert.equal(walkMinutes("JR中央線「高円寺」駅 徒歩６分"), 6); // full-width digits typed during review
  assert.equal(walkMinutes("バス停まで近い"), null);
  assert.deepEqual(stationPosition(byId.bresport), stationPosition(byId.monohouse));
  assert.equal(stationPosition({ station: "JR中央線「高円寺」駅 徒歩6分" }), null); // off the map
});

test("monthly cost adds the fee; an included fee is 0 and an unprinted rent is unknown", () => {
  assert.equal(monthlyCost(byId["louvre-shoto"]), 110000);
  assert.equal(monthlyCost(byId.monohouse), 95000); // 管理費込
  assert.equal(monthlyCost(byId["granpaseo-4"]), null); // the flyer prints no rent
  assert.equal(monthlyCost({ rent: 90000, managementFee: null }), 90000);
});

test("budget and criterion scores follow the published formula", () => {
  assert.equal(budgetScore(110000, 130000), 25);
  assert.equal(budgetScore(130000, 110000), 0);
  assert.equal(budgetScore(117000, 110000), 15);
  assert.equal(budgetScore(null, 130000), 12.5);
  assert.deepEqual([walkScore(2), walkScore(8), walkScore(15), walkScore(30)], [10, 7, 0, 0]);
  assert.deepEqual([spaceScore(15), spaceScore(28.8), spaceScore(40)], [0, 6.9, 10]);
  assert.deepEqual([ageScore(2026, YEAR), ageScore(2020, YEAR), ageScore(1990, YEAR)], [10, 8, 0]);
});

test("default preferences rank the recorded sheets as the UI shows them", () => {
  assert.deepEqual(scores(seeds, preferences), [
    ["bresport", 67],
    ["granpaseo-4", 56],
    ["louvre-shoto", 46],
  ]);
  // The sample sheet, once added, lands second.
  assert.deepEqual(scores(candidates, preferences).map(([id]) => id), ["bresport", "monohouse", "granpaseo-4", "louvre-shoto"]);
});

test("a lower budget or other priorities change the order", () => {
  assert.deepEqual(scores(seeds, withPreferences({ budget: 110000 })), [
    ["granpaseo-4", 56],
    ["louvre-shoto", 46],
    ["bresport", 42],
  ]);
  const newAndCheap = withPreferences({ budget: 100000, priorities: ["age"] });
  assert.equal(rankProperties(candidates, newAndCheap, YEAR)[0].id, "granpaseo-4");
  assert.equal(rankProperties(candidates, withPreferences({ budget: 125000, priorities: ["walk"] }), YEAR)[0].id, "monohouse");
});

test("unknown values are scored as visible neutral placeholders, never as cheap", () => {
  const rows = scoreBreakdown(byId["granpaseo-4"], preferences, YEAR);
  assert.deepEqual(rows[0], { key: "budget", label: "予算（月額）", points: 12.5, neutral: true, note: "賃料未取得のため中立値" });
  assert.equal(isProvisional(byId["granpaseo-4"], preferences, YEAR), true);
  assert.equal(isProvisional(byId.bresport, preferences, YEAR), false);
  const noFee = { ...byId.bresport, managementFee: null };
  assert.equal(scoreBreakdown(noFee, preferences, YEAR)[0].note, "管理費未取得・賃料のみで計算");
  assert.equal(isProvisional(noFee, preferences, YEAR), true);
  const nothing = { id: "x", rent: null, managementFee: null, station: null, areaSqm: null, constructionYear: null };
  assert.deepEqual(scoreBreakdown(nothing, preferences, YEAR).map((row) => row.neutral), [true, true, true, true]);
  assert.equal(scoreProperty(nothing, preferences, YEAR), 43); // 12.5 + 5×2.5 + 5×2.5 + 5 = 42.5
});

test("the breakdown lists priorities first and adds up to the score", () => {
  for (const property of candidates) {
    const rows = scoreBreakdown(property, preferences, YEAR);
    assert.deepEqual(rows.map((row) => row.key), ["budget", "walk", "space", "age"]);
    const total = rows.reduce((sum, row) => sum + row.points, 0);
    assert.equal(Math.round(Math.min(99, total)), scoreProperty(property, preferences, YEAR));
  }
  const ageFirst = scoreBreakdown(byId.bresport, withPreferences({ priorities: ["age"] }), YEAR);
  assert.deepEqual(ageFirst.map((row) => row.label), ["予算（月額）", "築浅（譲れない条件）", "駅徒歩", "広さ"]);
});

test("ranking does not mutate its input", () => {
  const input = [...seeds].reverse();
  const before = input.map((property) => property.id);
  rankProperties(input, preferences, YEAR);
  assert.deepEqual(input.map((property) => property.id), before);
});

test("the renter chooses the order; candidates without the value go last", async () => {
  const { sortProperties } = await import("../../../apps/shortlist/services.js");
  const order = (sortBy) => sortProperties(candidates, { ...preferences, sortBy, moveIn: "2026-10-15", brokerageMonths: 1 }, {}, YEAR).map((property) => property.id);
  assert.deepEqual(order("match"), ["bresport", "monohouse", "granpaseo-4", "louvre-shoto"]);
  assert.deepEqual(order("monthly"), ["monohouse", "louvre-shoto", "bresport", "granpaseo-4"]);
  assert.deepEqual(order("initial"), ["monohouse", "bresport", "louvre-shoto", "granpaseo-4"]);
  assert.deepEqual(order("walk"), ["monohouse", "granpaseo-4", "bresport", "louvre-shoto"]);
  assert.deepEqual(order("space"), ["bresport", "granpaseo-4", "monohouse", "louvre-shoto"]);
  assert.deepEqual(order("age"), ["granpaseo-4", "bresport", "monohouse", "louvre-shoto"]); // both 2001: input order kept
});

test("situations bring forward the checks that concern the renter", async () => {
  const { relevantChecks, situationFocus } = await import("../../../apps/shortlist/services.js");
  assert.deepEqual(relevantChecks(byId.bresport, new Set()), []);
  assert.deepEqual(relevantChecks(byId.bresport, new Set(["moveSoon", "foreign"])).map((check) => check.code), ["guarantor_fees", "short_term_penalty", "notice_period", "foreign_terms"]);
  assert.deepEqual(relevantChecks(byId["granpaseo-4"], new Set(["bulky"])).map((check) => check.code), ["no_elevator"]);
  assert.deepEqual(relevantChecks(byId.monohouse, new Set(["security"])).map((check) => check.code), ["ground_floor"]);
  assert.ok(situationFocus(new Set(["cooking"])).terms.has("コンロの口数・IH"));
});
