import test from "node:test";
import assert from "node:assert/strict";
import {
  DESTINATIONS,
  suggestedDestination,
  matchingDestination,
  defaultSchedule,
} from "../../../apps/commute/destinations.js";

test("suggestion follows candidate areas without inventing a work destination", () => {
  assert.equal(
    suggestedDestination([
      { address: "東京都渋谷区富ヶ谷" },
      { district: "世田谷区" },
    ]).key,
    "shibuya",
  );
  assert.equal(
    suggestedDestination([{ address: "東京都新宿区" }]).key,
    "shinjuku",
  );
  assert.equal(
    suggestedDestination([{ name: "渋谷ハイツ", address: "大阪市" }]),
    null,
  );
  assert.equal(suggestedDestination([]), null);
});
test("a preset resolves only one exact Tokyo station; ambiguous entities stay selectable", () => {
  const hub = DESTINATIONS[0],
    place = { id: "shibuya", name: "渋谷駅", address: "東京都渋谷区" };
  assert.equal(matchingDestination([place], hub), place);
  assert.equal(
    matchingDestination([place, { ...place, id: "other" }], hub),
    null,
  );
  assert.equal(
    matchingDestination([{ ...place, name: "渋谷駅前" }], hub),
    null,
  );
  assert.equal(
    matchingDestination([{ ...place, address: "大阪市" }], hub),
    null,
  );
});
test("schedule starts next Japan weekday at 08:00 / 18:00, independent of OS zone", () => {
  assert.deepEqual(defaultSchedule(new Date("2026-09-25T02:00:00Z")), {
    date: "2026-09-28",
    morning: "08:00",
    evening: "18:00",
  });
  assert.equal(
    defaultSchedule(new Date("2026-09-24T16:00:00Z")).date,
    "2026-09-28",
  );
});
