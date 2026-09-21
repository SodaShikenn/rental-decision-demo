import test from "node:test";
import assert from "node:assert/strict";
import { buildBrief } from "../../../apps/sharing/services.js";
import { briefMarkup, exportHTML } from "../../../apps/sharing/views.js";
import { createStore } from "../../../extensions/ext_store.js";
test("share uses an allowlist and private details require explicit selection", () => {
  const { state } = createStore({
    properties: [
      {
        id: "a",
        name: "候補",
        rent: 100000,
        managementFee: null,
        sheet: { image: "private-image" },
        reviews: ["provider-review"],
      },
    ],
    settings: { moveIn: "2026-10-01" },
  });
  state.observations = [
    { candidateId: "a", text: "自分の記録", date: "2026-09-22" },
  ];
  state.advisor.history = [{ role: "user", text: "private-chat" }];
  const data = buildBrief(state, { destination: "private-workplace" }),
    json = JSON.stringify(data);
  for (const secret of [
    "private-image",
    "provider-review",
    "private-chat",
    "private-workplace",
    "自分の記録",
  ])
    assert.ok(!json.includes(secret));
  assert.equal(data.candidates[0].monthly, null);
  assert.equal(
    buildBrief(state, { includeDestination: true, destination: "勤務先" })
      .destination,
    "勤務先",
  );
  assert.equal(
    buildBrief(state, { includeObservations: true }).observations.length,
    1,
  );
});
test("shared and downloaded markup cannot execute untrusted content", () => {
  const brief = {
    title: "<img src=x onerror=bad()>",
    generatedAt: "today",
    candidates: [],
    preferences: "<script>bad()</script>",
    questions: ["<b>"],
    observations: [],
  };
  assert.ok(!briefMarkup(brief).includes("<script>"));
  const html = exportHTML(
    brief,
    [{ src: "javascript:bad()", name: "bad" }],
    [{ role: "user", text: "<script>bad()</script>" }],
  );
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("javascript:"));
  assert.match(html, /default-src 'none'/);
});
