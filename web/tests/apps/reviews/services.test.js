import test from "node:test";
import assert from "node:assert/strict";
import { reviewTopics } from "../../../apps/reviews/services.js";
import { markup, resultsMarkup } from "../../../apps/reviews/views.js";
test("opposing reports stay together rather than producing a factual verdict", () => {
  const topics = reviewTopics([
    { text: "静かです" },
    { text: "騒音が気になります" },
  ]);
  assert.deepEqual(topics[0].indices, [0, 1]);
  assert.match(topics[0].question, /確認する/);
});
test("review markup escapes source content and rejects executable links", () => {
  const html = resultsMarkup({
    sourceCount: 1,
    otherPages: [
      { title: "<img>", reason: "advertisement", url: "javascript:alert(1)" },
    ],
    checkedAt: "2026-09-22",
    reviews: [
      {
        text: "<script>bad()</script>",
        author: { name: "投稿者", photo: "javascript:bad" },
        url: "https://example.com",
        publishedAt: null,
      },
    ],
  });
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("javascript:"));
  assert.match(html, /住人であることは未確認/);
});
test("missing reviews leave the evidence area blank and never ask for manual notes", () => {
  assert.equal(
    resultsMarkup({
      reviews: [],
      otherPages: [{ title: "広告", url: "https://example.com" }],
    }),
    "",
  );
  assert.doesNotMatch(markup, /textarea|observationForm|自分の内見記録/);
});
test("nearby references identify their building and distance without asserting candidate conditions", () => {
  const html = resultsMarkup({
    tier: "nearby",
    sourceCount: 1,
    checkedAt: "2026-09-22",
    reviews: [
      {
        text: "管理についての投稿",
        scope: "nearby_building",
        url: "https://example.com/review",
        sourceTitle: "出典",
        reference: {
          name: "別の公寓",
          address: "東京都渋谷区2-1",
          distanceMeters: 80,
          url: "https://maps.google.com",
          attributions: [],
        },
      },
    ],
  });
  assert.match(html, /別の公寓/);
  assert.match(html, /直線 約80m/);
  assert.match(html, /近隣の参考情報/);
  assert.match(html, /この候補に当てはめることはできません/);
});
