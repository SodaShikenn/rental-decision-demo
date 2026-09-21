import { test } from "node:test";
import assert from "node:assert/strict";
import { GLOSSARY } from "../../../apps/glossary/models.js";
import { findTerms, glossaryEntry, lookupTerm, searchGlossary, termFor } from "../../../apps/glossary/services.js";

test("every entry is complete and every term is unique", () => {
  assert.equal(new Set(GLOSSARY.map((item) => item.term)).size, GLOSSARY.length);
  for (const item of GLOSSARY) assert.ok(item.text.length > 10 && item.aliases.length, item.term);
});

test("terms are found in sheet text, the longest spelling winning", () => {
  assert.deepEqual(findTerms("1K+WIC / 28.80m"), ["1K", "WIC（ウォークインクローゼット）"]);
  assert.deepEqual(findTerms("SRC造 11階建"), ["SRC造（鉄骨鉄筋コンクリート造）", "所在階・階建"]);
  assert.deepEqual(findTerms("2LDK"), ["LDK"]);
  assert.deepEqual(findTerms("敷金償却：1ヶ月"), ["敷金償却・敷引き"]);
  assert.deepEqual(findTerms("ス/トイレ别·浴室乾燥機·追い炊き·独立洗面台"), ["バス・トイレ別", "浴室乾燥機", "追い焚き", "独立洗面台"]);
  assert.equal(termFor("鍵交換代"), "鍵交換費用");
  assert.equal(termFor("家賃"), null);
});

test("search and questions", () => {
  assert.deepEqual(searchGlossary("追焚").map((item) => item.term), ["追い焚き"]);
  assert.ok(searchGlossary("", "設備").every((item) => item.category === "設備"));
  assert.equal(lookupTerm("敷金償却とは？").term, "敷金償却・敷引き");
  assert.equal(lookupTerm("追い焚きって何？").term, "追い焚き");
  assert.equal(lookupTerm("1万円安くするなら？"), null);
  assert.equal(glossaryEntry("存在しない"), null);
});
