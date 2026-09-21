import { test } from "node:test";
import assert from "node:assert/strict";
import { SHEETS } from "../../../data/sheets.js";
import { buildCandidate, candidateFromSheet } from "../../../apps/intake/services.js";
import { EQUIPMENT_ASPECTS, ROWS } from "../../../apps/compare/models.js";
import { GLOSSARY } from "../../../apps/glossary/models.js";
import {
  citedLineIndexes,
  compareRows,
  equipmentOnSheet,
  lineNames,
  monthlyCost,
  spread,
  stationMentions,
  stationName,
  walkMinutes,
} from "../../../apps/compare/services.js";

const candidates = SHEETS.map(candidateFromSheet);
const byId = Object.fromEntries(candidates.map((candidate) => [candidate.id, candidate]));
const settings = { moveIn: "2026-10-21", brokerageMonths: 1 };
const TODAY = new Date(2026, 8, 21);
const mentionsOf = (id) => stationMentions(byId[id].sheet.lines).map(({ index, lines, station, minutes }) => [index, lines, station, minutes]);

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
});

test("monthly cost adds the fee; an included fee is 0 and an unprinted rent is unknown", () => {
  assert.equal(monthlyCost(byId["louvre-shoto"]), 110000);
  assert.equal(monthlyCost(byId.monohouse), 95000); // 管理費込
  assert.equal(monthlyCost(byId["granpaseo-4"]), null); // the flyer prints no rent
  assert.equal(monthlyCost({ rent: 90000, managementFee: null }), 90000);
});

test("line names are grouped under the portals' names, whatever the sheet printed", () => {
  const lines = Object.fromEntries(candidates.map(({ id, station }) => [id, lineNames(station)]));
  assert.deepEqual(lines, {
    monohouse: ["小田急線"],
    "louvre-shoto": ["小田急線"],
    bresport: ["小田急線", "京王井の頭線"],
    "granpaseo-4": ["京王井の頭線"],
  });
  assert.deepEqual(lineNames("O東京地下鉄千代田線"), ["東京メトロ千代田線"]); // a bullet read as O
  assert.deepEqual(lineNames(",井の頭線"), ["京王井の頭線"]);
  assert.deepEqual(lineNames("京王線・井の頭線"), ["京王線", "京王井の頭線"]);
  assert.deepEqual(lineNames("JR中央線「高円寺」駅 徒歩6分"), ["JR中央線"]); // unknown lines are kept verbatim
  assert.deepEqual(lineNames("下北沢駅徒歩2分"), []);
  assert.deepEqual(lineNames("最寄り駅"), []); // not a line name
});

test("every station printed on a sheet is found, with its line names and minutes", () => {
  assert.deepEqual(mentionsOf("monohouse"), [
    [7, ["小田急線"], "下北沢", 2],
    [8, ["京王井の頭線"], "下北沢", 2],
  ]);
  assert.deepEqual(mentionsOf("louvre-shoto"), [
    [2, ["小田急線"], "代々木八幡", 10],
    [3, ["東京メトロ千代田線"], "代々木公園", 10],
    [10, ["京王井の頭線"], "神泉", 13],
  ]);
  assert.deepEqual(mentionsOf("bresport"), [
    [23, ["小田急線", "京王井の頭線"], "下北沢", 8],
    [26, ["京王線"], "笹塚", 11],
    [30, ["京王井の頭線"], "新代田", 13],
  ]);
  assert.deepEqual(mentionsOf("granpaseo-4"), [
    [5, ["京王線", "京王井の頭線"], "明大前", 10],
    [6, ["京王線"], "代田橋", 10],
    [6, ["京王井の頭線"], "東松原", 5],
  ]);
  // 「人気エリア下北沢駅徒歩2分の好立地」 is advertising copy, not a station line.
  assert.deepEqual(stationMentions([byId.monohouse.sheet.lines[2]]), []);
  // The printed spelling is kept for the evidence popover; a name on the previous line is cited there.
  const printed = (id) => stationMentions(byId[id].sheet.lines).map((mention) => [mention.nameIndex, mention.printed]);
  assert.deepEqual(printed("louvre-shoto").map(([, text]) => text), ["小田急電鉄小田原線", "O東京地下鉄千代田線", "京王電鉄井の頭線"]);
  assert.deepEqual(printed("bresport"), [[22, "小田急・京王井の頭線"], [26, "京王線"], [29, "京王井の頭線"]]);
  assert.deepEqual(printed("granpaseo-4").map(([, text]) => text), ["京王線・井の頭線", "京王線", "井の頭線"]);
});

test("lines a fee or a check was read from are not read as equipment", () => {
  const cited = Object.fromEntries(candidates.map((candidate) => [candidate.id, citedLineIndexes(candidate)]));
  assert.ok(cited["louvre-shoto"].has(69)); // 抗菌代(エアコン洗净)
  assert.ok(cited["granpaseo-4"].has(19)); // …エアコンクリーニング費用…
  assert.ok(!cited.bresport.has(32)); // システムキッチン・…・エアコン
  assert.ok(!cited["louvre-shoto"].has(27)); // 面台防犯力メラ エアコン…
});

test("equipment printed on each sheet, including words the OCR split across two lines", () => {
  const found = Object.fromEntries(candidates.map((candidate) => [candidate.id, Object.fromEntries(equipmentOnSheet(candidate).map((item) => [item.label, item.lines]))]));
  assert.deepEqual(found.monohouse, {
    バス・トイレ別: [30],
    温水洗浄便座: [32],
    室内洗濯機置場: [30],
    システムキッチン: [30],
    オートロック: [33],
    TVモニター付きインターホン: [32, 33], // 「…モニター」「付きインターホン…」
    インターネット無料: [33, 34], // 「インターネット無」「料(JCOM)…」
  });
  assert.deepEqual(found["louvre-shoto"], {
    独立洗面台: [26, 27],
    室内洗濯機置場: [27],
    システムキッチン: [27, 28],
    オートロック: [26],
    TVモニター付きインターホン: [26],
    エアコン: [27], // not the 抗菌代 on line 69
  });
  assert.deepEqual(Object.keys(found.bresport), ["バス・トイレ別", "独立洗面台", "追い焚き", "浴室乾燥機", "温水洗浄便座", "システムキッチン", "オートロック", "インターネット無料", "エアコン"]);
  assert.ok(!("TVモニター付きインターホン" in found.bresport)); // 「モニター付きオートロック」 is a door lock
  assert.deepEqual(found["granpaseo-4"], { インターネット無料: [12] });
  // Every chip opens a glossary entry.
  const terms = new Set(GLOSSARY.map((item) => item.term));
  assert.ok(EQUIPMENT_ASPECTS.every((aspect) => terms.has(aspect.term)));
});

test("spread is the range across sheets, only when values differ", () => {
  assert.equal(spread([10, 8, 5, 2], { unit: "分" }), "2〜10分");
  assert.equal(spread([110000, null, 130000], { unit: "万", scale: 10000 }), "11〜13万");
  assert.equal(spread([20.25], { unit: "㎡" }), null);
  assert.equal(spread([2001, 2001], { unit: "年" }), null);
  assert.equal(spread([null, null]), null);
});

test("the table: one column per sheet in the order given, every value with its evidence", () => {
  const { rows } = compareRows(candidates, settings, {}, TODAY);
  assert.deepEqual(rows.map((row) => row.key), ROWS.map((row) => row.key));
  const byKey = Object.fromEntries(rows.map((row) => [row.key, row]));
  for (const row of rows) {
    assert.equal(row.cells.length, candidates.length);
    row.cells.forEach((cell, index) => {
      if (cell.unknown) return;
      const where = `${row.key} / ${candidates[index].id}`;
      assert.equal(cell.evidence?.length, 4, where);
      assert.ok(cell.sourceText, where);
      assert.ok(cell.confidence > 0 && cell.confidence <= 1, where);
      assert.equal(cell.edited, false, where);
    });
  }
  // 未取得 only where the sheet prints no rent.
  const unknown = rows.flatMap((row) => row.cells.flatMap((cell, index) => (cell.unknown ? [`${row.key}/${candidates[index].id}`] : [])));
  assert.deepEqual(unknown, ["monthly/granpaseo-4", "initial/granpaseo-4"]);
  assert.deepEqual(byKey.monthly.cells.map((cell) => [cell.text, cell.sub]), [
    ["9.5万円", "9.5万（管理費込み）"],
    ["11万円", "10.5万＋0.5万"],
    ["13万円", "12.5万＋0.5万"],
    ["未取得", "賃料の記載なし・共益費1万"],
  ]);
  assert.deepEqual(byKey.initial.cells.map((cell) => cell.text), ["41.02万円", "63.75万円", "54.76万円", "2万円＋未取得"]);
  assert.equal(byKey.initial.sub, "仲介1ヶ月・前家賃込み");
  assert.deepEqual(byKey.layout.cells.map((cell) => [cell.text, cell.sub]), [
    ["1K · 21.37㎡", "図面内で不一致"],
    ["1K · 20.25㎡", "6.13坪"],
    ["1K+WIC · 28.8㎡", "8.71坪"],
    ["1K · 21.74㎡", "最小タイプの値"],
  ]);
  assert.deepEqual(byKey.station.cells.map((cell) => [cell.text, cell.sub]), [
    ["下北沢 徒歩2分", "小田急線"],
    ["代々木八幡 徒歩10分", "小田急電鉄小田原線"],
    ["下北沢 徒歩8分", "小田急・京王井の頭線"],
    ["東松原 徒歩5分", "井の頭線"],
  ]);
  assert.deepEqual(byKey.age.cells.map((cell) => cell.text), ["2001年（築25年）", "2001年（築25年）", "2019年（築7年）", "2026年（新築）"]);
  assert.deepEqual(byKey.equipment.cells.map((cell) => cell.items.length), [7, 6, 9, 1]);
  assert.deepEqual(byKey.checks.cells.map((cell) => cell.text), ["10件", "12件", "12件", "10件"]);
  assert.deepEqual(Object.fromEntries(rows.map((row) => [row.key, row.spread])), {
    monthly: "9.5〜13万",
    initial: null,
    layout: "20.25〜28.8㎡",
    station: "2〜10分",
    age: "2001〜2026年",
    equipment: null,
    checks: null,
  });
});

test("the table keeps the input order, and one sheet has no spread", () => {
  const reversed = [...candidates].reverse();
  const before = JSON.stringify(reversed);
  const { rows } = compareRows(reversed, settings, {}, TODAY);
  assert.deepEqual(rows[0].cells.map((cell) => cell.text), ["未取得", "13万円", "11万円", "9.5万円"]);
  assert.equal(JSON.stringify(reversed), before); // neither reordered nor changed
  const single = compareRows([byId.bresport], settings, {}, TODAY);
  assert.ok(single.rows.every((row) => row.spread === null && row.cells.length === 1));
});

test("a rent entered for a sheet without one completes its estimate, marked as assumed", () => {
  const { rows } = compareRows(candidates, settings, { "granpaseo-4": 98000 }, TODAY);
  const initial = rows.find((row) => row.key === "initial").cells[3];
  assert.equal(initial.unknown, false);
  assert.equal(initial.sub, "仮の賃料 9.8万円で計算");
  assert.equal(initial.estimate.rentAssumed, true);
  assert.equal(rows.find((row) => row.key === "monthly").cells[3].text, "未取得"); // the sheet still prints no rent
});

test("a value corrected during review is marked, with the reading it replaced", () => {
  const sheet = SHEETS.find((item) => item.id === "monohouse");
  const corrected = buildCandidate(sheet.reading, { ...sheet.confirmed, areaSqm: 22.37 }, "2026-09-21T00:00:00Z", { id: "upload-1", image: sheet.image });
  const layout = compareRows([corrected], settings, {}, TODAY).rows.find((row) => row.key === "layout").cells[0];
  assert.equal(layout.text, "1K · 22.37㎡");
  assert.equal(layout.edited, true);
  assert.equal(layout.rawValue, 21.37);
});
