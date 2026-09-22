import test from "node:test";
import assert from "node:assert/strict";
import { candidateLinks, directionsLink } from "../../../apps/commute/links.js";
import { linksMarkup } from "../../../apps/commute/views.js";

test("Maps handoff encodes Japanese locations and reverses endpoints without unsupported time fields", () => {
  const origin = "東京都世田谷区羽根木2-28-19";
  const target = "東京都 渋谷駅 & 西口";
  const [row] = candidateLinks(
    [{ id: "one", name: "物件", address: origin }],
    target,
    "transit",
  );
  const outgoing = new URL(row.outbound),
    returning = new URL(row.returning);
  assert.equal(outgoing.origin, "https://www.google.com");
  assert.equal(outgoing.searchParams.get("origin"), origin);
  assert.equal(outgoing.searchParams.get("destination"), target);
  assert.equal(returning.searchParams.get("origin"), target);
  assert.equal(returning.searchParams.get("destination"), origin);
  assert.deepEqual(
    [...outgoing.searchParams.keys()],
    ["api", "origin", "destination", "travelmode"],
  );
  assert.equal(outgoing.searchParams.get("api"), "1");
  assert.equal(outgoing.searchParams.get("travelmode"), "transit");
  assert.equal(
    new URL(directionsLink(origin, target, "walking")).searchParams.get(
      "travelmode",
    ),
    "walking",
  );
});

test("Missing locations never fall back to device location; qualified building names are visibly tentative", () => {
  const rows = candidateLinks(
    [
      { id: "missing", name: "不明" },
      { id: "named", name: "建物", district: "世田谷区" },
    ],
    "東京都 渋谷駅",
    "transit",
  );
  assert.equal(rows[0].outbound, "");
  assert.equal(rows[0].returning, "");
  assert.equal(rows[1].approximate, true);
  assert.equal(
    new URL(rows[1].outbound).searchParams.get("origin"),
    "世田谷区 建物",
  );
  assert.match(linksMarkup(rows, "東京都 渋谷駅"), /地点の確認が必要/);
  for (const [origin, destination, mode] of [
    [" ", "駅", "transit"],
    ["家", "", "transit"],
    ["家", "駅", "invalid"],
    ["家".repeat(300), "駅", "transit"],
  ])
    assert.equal(directionsLink(origin, destination, mode), "");
});

test("Map cards escape imported content and label external links; empty candidates have an actionable state", () => {
  const rows = candidateLinks(
    [{ name: "<img src=x onerror=alert(1)>", address: '東京都 "&<住所>' }],
    "駅",
    "transit",
  );
  const html = linksMarkup(rows, "駅");
  assert.ok(!html.includes("<img"));
  assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, /新しいタブ/);
  assert.equal(linksMarkup(rows, ""), "");
  assert.match(linksMarkup([], "駅"), /候補を追加/);
});
