// Glossary lookups (≈ services.py): pure functions, unit-tested in web/tests.
import { GLOSSARY } from "./models.js";

// Look-alike glyphs Japanese OCR produces (simplified Chinese forms), as in server/apps/listing/checks.py.
const LOOKALIKES = { 别: "別", 净: "浄", 铁: "鉄", 键: "鍵", 换: "換", 约: "約", 须: "須", 证: "証", 违: "違", 费: "費", 险: "険", 现: "現", 况: "況", 务: "務", 项: "項", 赁: "賃", 卜: "ト" };
export const fold = (text) => String(text ?? "").normalize("NFKC").replace(/\s+/g, "").replace(/[别净铁键换约须证违费险现况务项赁卜]/g, (glyph) => LOOKALIKES[glyph]);
const byTerm = new Map(GLOSSARY.map((item) => [item.term, item]));

export const glossaryEntry = (term) => byTerm.get(term) ?? null;

/**
 * Glossary terms that appear in `text`, in order of first appearance. Where spellings overlap, the
 * longest wins, so "SRC" is not also read as "RC".
 */
export function findTerms(text) {
  const haystack = fold(text);
  const spans = [];
  for (const item of GLOSSARY) {
    for (const alias of item.aliases) {
      const needle = fold(alias);
      for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, at + 1)) {
        spans.push({ start: at, end: at + needle.length, term: item.term });
      }
    }
  }
  spans.sort((a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start);
  const taken = [];
  for (const span of spans) {
    if (!taken.some((other) => span.start < other.end && other.start < span.end)) taken.push(span);
  }
  taken.sort((a, b) => a.start - b.start);
  return [...new Set(taken.map((span) => span.term))];
}

/** The first glossary term in a label, for a "?" next to it, or null. */
export const termFor = (text) => findTerms(text)[0] ?? null;

/** Entries matching a search (term, spellings, or explanation), optionally within one category. */
export function searchGlossary(query, category = null) {
  const needle = fold(query).toLowerCase();
  return GLOSSARY.filter((item) => (!category || item.category === category) && (!needle || [item.term, ...item.aliases, item.text].some((text) => fold(text).toLowerCase().includes(needle))));
}

/** A question that asks what a term means, e.g. 「敷金償却とは？」, answered from the glossary. */
export function lookupTerm(question) {
  if (!/とは|って何|の意味|意味は|what/i.test(question)) return null;
  const [term] = findTerms(question);
  return term ? glossaryEntry(term) : null;
}
