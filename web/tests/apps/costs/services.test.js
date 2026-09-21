import { test } from "node:test";
import assert from "node:assert/strict";
import { SHEETS } from "../../../data/sheets.js";
import { candidateFromSheet } from "../../../apps/intake/services.js";
import { defaultMoveIn, estimateCosts, proratedDays } from "../../../apps/costs/services.js";

const byId = Object.fromEntries(SHEETS.map((sheet) => [sheet.id, candidateFromSheet(sheet)]));
const settings = { moveIn: "2026-10-15", brokerageMonths: 1 };
const amounts = (rows) => Object.fromEntries(rows.filter((row) => row.included).map((row) => [row.label, row.amount]));

test("move-in day and default date", () => {
  assert.deepEqual(proratedDays("2026-10-15"), { days: 17, length: 31 });
  assert.deepEqual(proratedDays("2027-02-01"), { days: 28, length: 28 });
  assert.equal(defaultMoveIn(new Date(2026, 8, 21)), "2026-10-21");
});

test("the sample sheet: every printed cost, plus brokerage and prepaid rent (checked by hand)", () => {
  const estimate = estimateCosts(byId.monohouse, settings);
  assert.deepEqual(amounts(estimate.rows.initial), {
    "敷金 1ヶ月": 95000,
    "礼金 0ヶ月": 0,
    "日割り家賃（入居月の17日分）": 52097, // 95,000 × 17 / 31
    "前家賃（翌月分）": 95000,
    "仲介手数料（1ヶ月＋税）": 104500,
    "火災保険": 18000,
    "保証会社 初回保証料（賃料等の50%）": 47500,
    "鍵交換費用": 16500,
  });
  assert.deepEqual(estimate.initial, { amount: 428597, complete: true });
  assert.deepEqual(estimate.monthly, { amount: 95950, complete: true }); // + 1% guarantor fee
  assert.equal(estimate.moveOut.amount, 95000); // the amortized deposit never comes back
});

test("totals for the recorded candidates, including tax on 税別 fees and optional items left out", () => {
  const totals = Object.fromEntries(["louvre-shoto", "bresport"].map((id) => [id, estimateCosts(byId[id], settings)]));
  assert.equal(totals["louvre-shoto"].initial.amount, 658823);
  assert.equal(totals["louvre-shoto"].monthly.amount, 110330);
  assert.equal(totals["louvre-shoto"].yearly.amount, 15000);
  assert.equal(totals["louvre-shoto"].renewal.amount, 157500); // 1.5 months
  assert.equal(totals.bresport.initial.amount, 572790);
  assert.equal(amounts(totals.bresport.rows.initial)["契約事務手数料"], 27500); // 25,000 税別
  assert.equal(totals.bresport.monthly.amount, 132300);
  assert.equal(totals.bresport.rows.monthly.find((row) => row.label === "駐輪場").included, false);
});

test("a sheet without rent is incomplete until the person enters one; free rent covers prepaid rent", () => {
  const unknown = estimateCosts(byId["granpaseo-4"], settings);
  assert.deepEqual(unknown.initial, { amount: 20000, complete: false });
  assert.equal(amounts(unknown.rows.initial)["敷金 0ヶ月"], 0);
  const assumed = estimateCosts(byId["granpaseo-4"], settings, { rentOverride: 100000 });
  assert.equal(assumed.rentAssumed, true);
  assert.deepEqual(amounts(assumed.rows.initial), {
    "敷金 0ヶ月": 0,
    "礼金 0ヶ月": 0,
    "日割り家賃（入居月の17日分）": 0,
    "前家賃（翌月分）": 0,
    "仲介手数料（1ヶ月＋税）": 110000,
    "火災保険（2年間）": 20000,
    "保証会社 初回保証料（総賃料の50%）": 55000, // 50% of 110,000 (rent + 共益費)
  });
  assert.deepEqual(assumed.initial, { amount: 185000, complete: true });
});

test("settings and toggles change the estimate", () => {
  const half = estimateCosts(byId.monohouse, { ...settings, brokerageMonths: 0.5 });
  assert.equal(half.initial.amount, 428597 - 52250);
  const withoutKey = estimateCosts(byId.monohouse, settings, { toggled: ["cost-7"] });
  assert.equal(withoutKey.initial.amount, 428597 - 16500);
  const withBike = estimateCosts(byId.bresport, settings, { toggled: ["cost-9"] });
  assert.equal(withBike.monthly.amount, 132300 + 500);
});

test("a candidate with no money terms keeps deposit and key money unknown", () => {
  const estimate = estimateCosts({ rent: 88000, managementFee: 5000, costs: [] }, settings);
  assert.equal(estimate.initial.complete, false);
  assert.deepEqual(estimate.rows.initial.slice(0, 2).map((row) => [row.amount, row.note]), [[null, "図面に記載がありません"], [null, "図面に記載がありません"]]);
});

test("saying you use a bicycle counts the optional bicycle parking", () => {
  const withBike = estimateCosts(byId.bresport, { ...settings, situations: new Set(["bicycle"]) });
  assert.equal(withBike.monthly.amount, 132300 + 500);
  assert.equal(withBike.rows.monthly.find((row) => row.label === "駐輪場").included, true);
});
