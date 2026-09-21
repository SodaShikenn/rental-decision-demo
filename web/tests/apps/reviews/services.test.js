import test from "node:test";
import assert from "node:assert/strict";
import { reviewTopics, observation } from "../../../apps/reviews/services.js";
import { resultsMarkup } from "../../../apps/reviews/views.js";
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
    place: { name: "A", url: "javascript:alert(1)" },
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
test("own observations are explicitly separated and bounded", () => {
  assert.equal(
    observation("a", "  夜の内見  ", "2026-09-22").kind,
    "own_viewing",
  );
  assert.throws(() => observation("a", "x".repeat(1001), "2026-09-22"));
});
