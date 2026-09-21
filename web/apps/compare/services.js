// Comparison logic (≈ services.py). Pure functions over confirmed candidates: no DOM and no shared
// state, so they are unit-tested in web/tests. Every cell is a value printed on the sheet (or the
// move-in estimate built from those values), with the evidence it was read from. Nothing is scored
// or sorted: the columns keep the order the sheets were added in.
import { man, tsubo } from "../../helper.js";
import { estimateCosts } from "../costs/services.js";
import { fold } from "../glossary/services.js";
import { CHECK_SUMMARY_ORDER, EQUIPMENT_ASPECTS, LINE_ALIASES, ROWS, WARNING_NOTES } from "./models.js";
import { monthlyReferences } from "../research/monthly.js";

/** Minutes on foot from the station text: "小田急線「下北沢」駅 徒歩2分" → 2. */
export function walkMinutes(station) {
  const match = station?.normalize("NFKC").match(/歩\s*(\d+)\s*分/);
  return match ? Number(match[1]) : null;
}

/** The station's name: "…「代々木八幡駅」徒歩10分" → "代々木八幡", "…線 下北沢駅 徒歩8分" → "下北沢". */
export function stationName(station) {
  const match = station?.match(/「([^」]+?)駅?」/) ?? station?.match(/([^\s「」・/]+?)駅/);
  return match?.[1] ?? null;
}

/** Rent plus the management fee. Unknown rent means an unknown total; an unknown fee counts as 0. */
export const monthlyCost = ({ rent, managementFee }) => (rent == null ? null : rent + (managementFee ?? 0));

/** Sheet text folded for matching: the glossary's folding (NFKC, no whitespace, OCR look-alikes), and 力 read as カ. */
export const foldText = (text) => fold(text).replace(/力/g, "カ");

// Station mentions. Bracket form: 小田急線「下北沢」駅徒歩2分. Bare form: 京王線 笹塚駅 徒歩11分, where the
// station must start the line or follow a separator, so 「人気エリア下北沢駅徒歩2分」 is not a mention.
const BRACKET = /([^「」]*?)「([^」]+?)駅?」駅?\s*徒?歩\s*(\d+)\s*分/g;
const BARE = /(?:^|[\s・/,，、])([^\s「」・/,，、線]{1,6}?)駅\s*徒?歩\s*(\d+)\s*分/g;
const BARE_STATION_TAIL = /(?:^|[\s・/,，、])[^\s「」・/,，、線]{1,6}?駅[\s\S]*$/;
const SEPARATOR_EDGES = /^[\s・/,，、]+|[\s・/,，、]+$/g;
// A leading bullet the OCR read as a letter or digit (「O東京地下鉄千代田線」), or punctuation (「,井の頭線」).
const LEADING_NOISE = /^(?:[^\p{L}]|[OoＯ0○◯](?=[\p{Script=Han}\p{Script=Katakana}\p{Script=Hiragana}]))+/u;
const TRAILING_NOISE = /[^\p{L}]+$/u;
const ALIAS_TO_LINE = new Map(Object.entries(LINE_ALIASES).flatMap(([line, aliases]) => aliases.map((alias) => [foldText(alias), line])));

/**
 * Railway lines named in a station text, under the portals' names: "小田急・京王井の頭線 下北沢駅 徒歩8分"
 * → ["小田急線", "京王井の頭線"]. A name not in LINE_ALIASES is kept verbatim when it reads as a line (…線).
 */
export function lineNames(text) {
  const head = String(text ?? "").normalize("NFKC").split("「")[0].replace(BARE_STATION_TAIL, "");
  const names = [];
  for (const part of foldText(head).split(/[・/,，、]/)) {
    const name = part.replace(LEADING_NOISE, "").replace(TRAILING_NOISE, "");
    const line = ALIAS_TO_LINE.get(name) ?? (/(?:線|ライン)$/.test(name) ? name : null);
    if (line && !names.includes(line)) names.push(line);
  }
  return names;
}

const lineText = (line) => (typeof line === "string" ? line : line?.text ?? "");

/**
 * Every station printed on the sheet, with its line names and minutes on foot:
 * [{ index, nameIndex, printed, lines, station, minutes }]. `index` is the OCR line of the station,
 * `nameIndex` the line the name was read from (the previous line when it ends with 線 and the
 * station's own line starts with the station), `printed` the name as printed.
 */
export function stationMentions(lines = []) {
  const texts = lines.map((line) => lineText(line).normalize("NFKC"));
  const mentions = [];
  const push = (index, nameIndex, printed, station, minutes) => {
    const name = printed.replace(SEPARATOR_EDGES, "");
    mentions.push({ index, nameIndex, printed: name, lines: lineNames(name), station: station.replace(/駅$/, ""), minutes: Number(minutes) });
  };
  texts.forEach((text, index) => {
    const bracketed = [...text.matchAll(BRACKET)];
    if (bracketed.length) {
      bracketed.forEach((match) => push(index, index, match[1], match[2], match[3]));
      return;
    }
    let from = 0;
    for (const match of text.matchAll(BARE)) {
      const start = match.index + (/^[\s・/,，、]/.test(match[0]) ? 1 : 0);
      let printed = text.slice(from, start);
      let nameIndex = index;
      from = match.index + match[0].length;
      const previous = texts[index - 1]?.trim() ?? "";
      if (!printed.replace(SEPARATOR_EDGES, "") && previous.endsWith("線")) {
        printed = previous;
        nameIndex = index - 1;
      }
      push(index, nameIndex, printed, match[1], match[2]);
    }
  });
  return mentions;
}

/**
 * Indexes of the OCR lines that a money term or a pre-contract check was read from (their
 * `sourceText` split on 「 / 」). Equipment words on those lines are part of a fee
 * (「抗菌代(エアコン洗净)」), not a description of the room.
 */
export function citedLineIndexes(candidate) {
  const segments = new Set([...(candidate.costs ?? []), ...(candidate.checks ?? [])].flatMap((item) => String(item.sourceText ?? "").split(" / ")));
  return new Set((candidate.sheet?.lines ?? []).flatMap((line, index) => (segments.has(line.text) ? [index] : [])));
}

/**
 * EQUIPMENT_ASPECTS printed on the sheet: [{ key, label, term, lines }]. An aspect found on one line
 * cites it; a word the OCR split across two adjacent lines (「独立洗」「面台」) cites both.
 */
export function equipmentOnSheet(candidate) {
  const cited = citedLineIndexes(candidate);
  const texts = (candidate.sheet?.lines ?? []).map((line, index) => (cited.has(index) ? null : foldText(line.text)));
  return EQUIPMENT_ASPECTS.flatMap(({ key, label, term, aliases }) => {
    const needles = aliases.map(foldText);
    const has = (text) => needles.some((needle) => text.includes(needle));
    const single = texts.findIndex((text) => text != null && has(text));
    if (single !== -1) return [{ key, label, term, lines: [single] }];
    const pair = texts.findIndex((text, index) => text != null && texts[index + 1] != null && has(text + texts[index + 1]));
    return pair === -1 ? [] : [{ key, label, term, lines: [pair, pair + 1] }];
  });
}

/** "min〜max" with the unit once ("2〜10分"), or null when fewer than two values differ. */
export function spread(values, { unit = "", scale = 1 } = {}) {
  const numbers = values.filter((value) => typeof value === "number" && Number.isFinite(value));
  if (numbers.length < 2) return null;
  const [min, max] = [Math.min(...numbers), Math.max(...numbers)];
  if (min === max) return null;
  const format = (value) => String(Number((value / scale).toFixed(2)));
  return `${format(min)}〜${format(max)}${unit}`;
}

/** Yen in 万 without the unit: 105000 → "10.5". */
export const manNumber = (value) => String(Number((value / 10000).toFixed(2)));

/** The smallest box around several [x, y, w, h] boxes (missing boxes are skipped), or null. */
export function unionBox(boxes) {
  const present = boxes.filter(Boolean);
  if (!present.length) return null;
  const left = Math.min(...present.map(([x]) => x));
  const top = Math.min(...present.map(([, y]) => y));
  const right = Math.max(...present.map(([x, , w]) => x + w));
  const bottom = Math.max(...present.map(([, y, , h]) => y + h));
  return [left, top, right - left, bottom - top];
}

const NO_EVIDENCE = { evidence: null, sourceText: null, confidence: null };

/** Evidence of the first of `keys` that the sheet printed. */
function fieldEvidence(property, keys) {
  for (const key of keys) {
    const field = property.sheet?.fields?.[key];
    if (field?.evidence) return { evidence: field.evidence, sourceText: field.sourceText, confidence: field.confidence };
  }
  return NO_EVIDENCE;
}

/** Evidence of whole OCR lines: their joint box, their text, and the lowest OCR confidence among them. */
function linesEvidence(property, indexes) {
  const lines = indexes.map((index) => property.sheet?.lines?.[index]).filter(Boolean);
  if (!lines.length) return NO_EVIDENCE;
  const confidences = lines.map((line) => line.confidence).filter((value) => typeof value === "number");
  return { evidence: unionBox(lines.map((line) => line.box)), sourceText: lines.map((line) => line.text).join(" / "), confidence: confidences.length ? Math.min(...confidences) : null };
}

/** The OCR lines a check or cost was read from (its `sourceText` segments). */
function sourceLineIndexes(property, sourceText) {
  const segments = new Set(String(sourceText ?? "").split(" / "));
  return (property.sheet?.lines ?? []).flatMap((line, index) => (segments.has(line.text) ? [index] : []));
}

/** The sheet's own caveat on a value (「最小タイプの値」「図面内で不一致」), from warnings naming those fields. */
export function warningNotes(property, keys) {
  return (property.sheetWarnings ?? []).filter((warning) => WARNING_NOTES[warning.code] && warning.fields?.some((field) => keys.includes(field))).map((warning) => WARNING_NOTES[warning.code]);
}

/**
 * A cell: the printed value (text, sub), whether the sheet gave it (unknown), where it was read
 * (evidence box, OCR text, confidence), and whether a person corrected the reading (edited, with the
 * reading before correction in rawValue). `fields` are the sheet fields behind the cell.
 * Two cells may report that nothing was found (no equipment words, no checks): that is a count of
 * zero, not a value printed on the sheet, so they carry no evidence and say so in their text.
 */
function cell(property, fields, values) {
  const editedKey = fields.find((key) => property.provenance?.editedFields?.includes(key));
  return {
    text: "",
    sub: "",
    unknown: false,
    ...fieldEvidence(property, fields),
    edited: Boolean(editedKey),
    rawValue: editedKey ? property.sheet?.fields?.[editedKey]?.value ?? null : null,
    fields,
    ...values,
  };
}

const feeName = (property) => (/共益費/.test(property.sheet?.fields?.managementFee?.sourceText ?? "") ? "共益費" : "管理費");

function monthlyCell(property) {
  const { rent, managementFee } = property;
  const fees = feeName(property);
  if (rent == null) {
    const references = monthlyReferences(property);
    if (references.length) {
      const values = references.map((reference) => reference.monthly);
      const low = Math.min(...values), high = Math.max(...values);
      return cell(property, ["rent", "managementFee"], { text: `参考 ${man(low)}${high > low ? `〜${man(high)}` : ""}`, sub: references.length === 1 ? `${references[0].room || "部屋番号不明"}${references[0].room ? "号室" : ""}の募集・部屋の一致未確認` : "同じ建物の募集・部屋の一致未確認", unknown: true, references, ...NO_EVIDENCE });
    }
    const research = property.monthlyResearch;
    if (research?.status === "searching") return cell(property, ["rent", "managementFee"], { text: "調査中", sub: "月額の掲載を自動で検索中", unknown: true, ...NO_EVIDENCE });
    if (research?.status === "error") return cell(property, ["rent", "managementFee"], { text: "未取得", sub: "自動調査に接続できませんでした · 再検索", unknown: true, ...NO_EVIDENCE });
    const sub = managementFee == null ? "賃料の記載なし" : `賃料の記載なし・${fees}${manNumber(managementFee)}万`;
    return cell(property, ["rent", "managementFee"], { text: "未取得", sub, unknown: true, ...NO_EVIDENCE });
  }
  const sub = managementFee == null ? `${manNumber(rent)}万・${fees}の記載なし` : managementFee === 0 ? `${manNumber(rent)}万（${fees}込み）` : `${manNumber(rent)}万＋${manNumber(managementFee)}万`;
  return cell(property, ["rent", "managementFee"], { text: man(monthlyCost(property)), sub });
}

function initialCell(property, settings, rentOverride) {
  const estimate = estimateCosts(property, settings, { rentOverride });
  const { amount, complete } = estimate.initial;
  return cell(property, ["rent", "managementFee"], {
    text: complete ? man(amount) : `${man(amount)}＋未取得`,
    sub: estimate.rentAssumed ? `仮の賃料 ${man(rentOverride)}で計算` : "",
    unknown: !complete,
    ...(complete ? {} : NO_EVIDENCE),
    estimate,
  });
}

function layoutCell(property) {
  const { layout, areaSqm } = property;
  if (layout == null && areaSqm == null) return cell(property, ["layout", "areaSqm"], { text: "未取得", unknown: true });
  const [note] = warningNotes(property, ["layout", "areaSqm"]);
  return cell(property, ["layout", "areaSqm"], {
    text: `${layout ?? "間取り未取得"} · ${areaSqm != null ? `${areaSqm}㎡` : "面積未取得"}`,
    sub: note ?? (areaSqm != null ? `${tsubo(areaSqm)}坪` : ""),
  });
}

function stationCell(property) {
  const { station } = property;
  if (!station) return cell(property, ["station"], { text: "未取得", unknown: true, mentions: [] });
  const name = stationName(station);
  const minutes = walkMinutes(station);
  return cell(property, ["station"], {
    text: name ? (minutes == null ? name : `${name} 徒歩${minutes}分`) : station,
    sub: stationMentions([station])[0]?.printed ?? "",
    mentions: stationMentions(property.sheet?.lines ?? []),
  });
}

function ageCell(property, today) {
  const year = property.constructionYear;
  if (!year) return cell(property, ["constructionYear"], { text: "未取得", unknown: true });
  const age = today.getFullYear() - year;
  return cell(property, ["constructionYear"], { text: `${year}年（${age <= 0 ? "新築" : `築${age}年`}）` });
}

function equipmentCell(property) {
  const items = equipmentOnSheet(property);
  // Finding none is not a missing value: the sheet may describe its equipment in other words.
  if (!items.length) return cell(property, [], { text: "決まった言葉の記載は見つかりませんでした", items });
  return cell(property, [], { text: items.map((item) => item.label).join("・"), items, ...linesEvidence(property, items[0].lines) });
}

/**
 * The first two checks to name for a sheet: its first check in each CHECK_SUMMARY_ORDER category,
 * then the rest in sheet order. Only the sheet's own checks count.
 */
export function summaryChecks(checks, count = 2) {
  const firsts = CHECK_SUMMARY_ORDER.map((category) => checks.find((check) => check.category === category)).filter(Boolean);
  return [...firsts, ...checks.filter((check) => !firsts.includes(check))].slice(0, count);
}

function checksCell(property) {
  const checks = property.checks ?? [];
  if (!checks.length) return cell(property, [], { text: "0件", sub: "決まった言葉の記載は見つかりませんでした", checks });
  // Joined with 「／」 because titles contain 「・」.
  const titles = summaryChecks(checks).map((check) => check.title);
  const [first] = checks;
  const fromLines = linesEvidence(property, sourceLineIndexes(property, first.sourceText));
  return cell(property, [], {
    text: `${checks.length}件`,
    sub: titles.join("／"),
    checks,
    evidence: first.evidence ?? fromLines.evidence,
    sourceText: first.sourceText,
    confidence: fromLines.confidence,
  });
}

/**
 * The table: one row per ROWS entry, one cell per sheet in the order given. `spread` is the range
 * across sheets when the values differ ("2〜10分"). The initial-cost cell carries the whole estimate
 * (for the breakdown) and uses the rent a person entered for a sheet that prints none.
 * @param settings       { moveIn, brokerageMonths } for the move-in estimate
 * @param rentOverrides  { [id]: yen } rent entered for a sheet without one
 */
export function compareRows(properties, settings, rentOverrides = {}, today = new Date()) {
  const cells = {
    monthly: (property) => monthlyCell(property),
    initial: (property) => initialCell(property, settings, rentOverrides[property.id] ?? null),
    layout: (property) => layoutCell(property),
    station: (property) => stationCell(property),
    age: (property) => ageCell(property, today),
    equipment: (property) => equipmentCell(property),
    checks: (property) => checksCell(property),
  };
  const spreads = {
    monthly: () => spread(properties.map(monthlyCost), { unit: "万", scale: 10000 }),
    layout: () => spread(properties.map((property) => property.areaSqm), { unit: "㎡" }),
    station: () => spread(properties.map((property) => walkMinutes(property.station)), { unit: "分" }),
    age: () => spread(properties.map((property) => property.constructionYear), { unit: "年" }),
  };
  const subs = { initial: `仲介${settings.brokerageMonths}ヶ月・前家賃込み` };
  return {
    rows: ROWS.map(({ key, label, sub }) => ({
      key,
      label,
      sub: subs[key] ?? sub,
      spread: spreads[key]?.() ?? null,
      cells: properties.map(cells[key]),
    })),
  };
}
