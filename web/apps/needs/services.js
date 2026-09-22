import { priorityMemo } from "../priorities/services.js";
// Condition-memo logic (≈ services.py). Pure and DOM-free, with `today` injected, so every line is
// unit-tested in web/tests. The memo reads the confirmed sheets on screen and restates what they share
// as search conditions and questions for the agent. It never mutates or reorders its input, never
// scores or ranks a sheet, and writes the absence of a word as 記載なし, never as ない.
import { man, yen } from "../../helper.js";
import { WARNING_NOTES } from "../compare/models.js";
import { equipmentOnSheet, lineNames, manNumber, monthlyCost, stationMentions, stationName, walkMinutes } from "../compare/services.js";
import { fieldLabel } from "../intake/models.js";
import { districtFromAddress } from "../intake/services.js";
import {
  ANSWER_LINES,
  ASK_HEADING,
  ASK_TEMPLATES,
  ASPECTS,
  FIELD_ASK,
  FIELD_UNITS,
  FOOTER,
  GENERAL_ASK,
  LADDERS,
  MAJORITY,
  PER_SHEET_CAP,
  PER_SHEET_ORDER,
  PLACEHOLDER,
  QUESTIONS,
  SEARCH_HEADING,
  SHARED_CAP,
} from "./models.js";

const fill = (template, values) => template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""));
const codesOf = (property) => new Set((property.checks ?? []).map((check) => check.code));
const hasAny = (property, codes) => codes.some((code) => codesOf(property).has(code));
const names = (properties) => properties.map((property) => property.name).join("・");
const TEMPLATES = new Map(ASK_TEMPLATES.map((template) => [template.key, template]));
/** "min〜max{unit}", or the one value when they are equal. */
const range = (values, format = String, unit = "") => {
  const [min, max] = [Math.min(...values), Math.max(...values)];
  return min === max ? `${format(min)}${unit}` : `${format(min)}〜${format(max)}${unit}`;
};

/**
 * Group values by key, keeping the order keys first appear in, then list the largest groups first
 * (the sort is stable, so equal counts stay in sheet order): [{ key, items }].
 */
function groupBy(entries) {
  const groups = new Map();
  for (const [key, item] of entries) groups.set(key, [...(groups.get(key) ?? []), item]);
  return [...groups].map(([key, items]) => ({ key, items })).sort((a, b) => b.items.length - a.items.length);
}

/** Per aspect (ASPECTS order), the sheets where it is printed, with the OCR lines or money term it was read from. */
export function aspectCounts(properties) {
  const equipment = properties.map((property) => new Map(equipmentOnSheet(property).map((item) => [item.key, item])));
  return ASPECTS.map((aspect) => {
    const sheets = properties.flatMap((property, index) => {
      if (aspect.source === "term") {
        const item = equipment[index].get(aspect.key);
        if (!item) return [];
        const text = item.lines.map((line) => property.sheet?.lines?.[line]?.text ?? "").join(" / ");
        return [{ id: property.id, name: property.name, lines: item.lines, sourceText: text }];
      }
      const cost = (property.costs ?? []).find((item) => item.kind === aspect.kind && item.amount === 0);
      return cost ? [{ id: property.id, name: property.name, lines: [], sourceText: cost.sourceText }] : [];
    });
    return { key: aspect.key, label: aspect.label, term: aspect.term, source: aspect.source, count: sheets.length, sheets };
  });
}

/**
 * Chips for every aspect printed on at least one sheet, the most common first (ties in ASPECTS order).
 * A chip starts pressed when MAJORITY(n) sheets print it; a person's choice (pickOverrides[key] true or
 * false) wins either way. With fewer than two sheets there is nothing to count, so there are no chips.
 */
export function chipStates(counts, n, pickOverrides = {}) {
  if (n < 2) return [];
  const majority = MAJORITY(n);
  return counts
    .map((aspect, order) => ({ aspect, order }))
    .filter(({ aspect }) => aspect.count >= 1)
    .sort((a, b) => b.aspect.count - a.aspect.count || a.order - b.order)
    .map(({ aspect }) => {
      const defaultPressed = aspect.count >= majority;
      return { ...aspect, n, defaultPressed, pressed: pickOverrides[aspect.key] ?? defaultPressed };
    });
}

/** How many of n sheets: "4件すべて", "4件中2件", or for one sheet its name. */
const share = (count, n, only) => (n === 1 ? only.name : count === n ? `${n}件すべて` : `${n}件中${count}件`);

/** Questions triggered by clauses on the sheets on screen (QUESTIONS order, at most three), with their text. */
export function deriveQuestions(properties) {
  const n = properties.length;
  const on = (code) => properties.filter((property) => codesOf(property).has(code));
  const text = {
    moveSoon() {
      const penalty = on("short_term_penalty");
      if (!penalty.length) return null;
      const notice = on("notice_period").length;
      const aside = notice ? (n === 1 ? "（解約予告の期間の記載もあり）" : `（解約予告の期間の記載は${notice}件）`) : "";
      return { sheets: penalty, notice, text: `${share(penalty.length, n, penalty[0])}に短期解約違約金の記載があります${aside}。2年以内に引っ越す可能性はありますか？` };
    },
    viewFirst() {
      const viewing = on("before_viewing");
      const photos = on("photos_differ");
      const sheets = properties.filter((property) => viewing.includes(property) || photos.includes(property));
      if (!sheets.length) return null;
      const parts = [];
      if (viewing.length) parts.push(`${share(viewing.length, n, viewing[0])}に内見の時期・先行契約の記載があります${n === 1 ? "" : `（${names(viewing)}）`}`);
      if (photos.length) parts.push(`${names(photos)}は掲載写真が別の部屋のものです`);
      return { sheets, viewing: viewing.length, photos: photos.length, text: `${parts.join("。")}。内見してから決めたいですか？` };
    },
    floor() {
      const ground = on("ground_floor");
      const noElevator = on("no_elevator");
      // The room number the server read the floor from, unless the name already shows it.
      const room = (property) => property.checks.find((check) => check.code === "ground_floor")?.sourceText?.split(" / ")[0] ?? "";
      const parts = properties.flatMap((property) => [
        ...(ground.includes(property) ? [`${property.name}は1階${property.name.includes(room(property)) ? "" : `（${room(property)}）`}`] : []),
        ...(noElevator.includes(property) ? [`${property.name}はエレベーターなし`] : []),
      ]);
      if (!parts.length) return null;
      const sheets = properties.filter((property) => ground.includes(property) || noElevator.includes(property));
      return { sheets, ground: ground.map((property) => property.id), noElevator: noElevator.map((property) => property.id), text: `${parts.join("、")}です。` };
    },
  };
  return QUESTIONS.flatMap((question) => {
    const built = text[question.key]();
    if (!built) return [];
    const { sheets, ...rest } = built;
    return [{ key: question.key, type: question.type, options: question.options, initial: question.initial, count: sheets.length, sheets: sheets.map((property) => property.id), ...rest }];
  }).slice(0, 3);
}

/** A ladder step at or above `value`, or null above the top step. */
const stepUp = (steps, value) => steps.find((step) => step >= value) ?? null;

/** " 70,000円" or " 25,000円（税別）": the printed amount of the money term behind a check, or "". */
function printedAmount(property, template) {
  if (!template.amount) return "";
  const split = (text) => String(text ?? "").split(" / ");
  const segments = new Set((property.checks ?? []).filter((check) => template.codes.includes(check.code)).flatMap((check) => split(check.sourceText)));
  // The money term read from the same OCR line as the check. A range (「38,500〜66,000円」) has no one amount.
  const cost = (property.costs ?? []).find(
    (item) => item.unit === "yen" && template.amount.test(item.label) && !item.label.includes("〜") && split(item.sourceText).some((segment) => segments.has(segment)),
  );
  return cost ? ` ${yen(cost.amount)}${cost.taxExcluded ? "（税別）" : ""}` : "";
}

/** Lines under ■ 探す条件: area, lines, stations, walk, rent, layout, area, age, answers, then the chosen aspects. */
export function searchLines(properties, chips = [], answers = {}, today = new Date()) {
  const n = properties.length;
  if (!n) return [];
  const single = n === 1;
  const lines = [];

  const districts = groupBy(properties.map((property) => [property.district ?? districtFromAddress(property.address), property]).filter(([key]) => key));
  if (districts.length) lines.push(`・エリア：${districts.map(({ key, items }) => (single ? key : `${key}（${items.length}件）`)).join("・")}`);

  // A line counts once per sheet, whether it is printed next to the confirmed station or anywhere else.
  const railways = groupBy(properties.flatMap((property) => {
    const found = [...stationMentions(property.sheet?.lines ?? []).flatMap((mention) => mention.lines), ...lineNames(property.station)];
    return [...new Set(found)].map((line) => [line, property]);
  }));
  if (railways.length) {
    if (single) lines.push(`・沿線：${railways.map(({ key }) => key).join("・")}`);
    else {
      const shared = railways.filter(({ items }) => items.length >= 2).map(({ key, items }, index) => `${key}（${index === 0 ? `${n}件中` : ""}${items.length}件）`);
      const once = railways.filter(({ items }) => items.length === 1).map(({ key }) => key);
      const tail = once.length ? `${shared.length ? "／ほか" : ""}1件のみ：${once.join("・")}` : "";
      lines.push(`・沿線：${shared.join("・")}${tail}`);
    }
  }

  const stations = groupBy(properties.map((property) => [stationName(property.station), walkMinutes(property.station)]).filter(([key]) => key));
  if (stations.length) {
    lines.push(`・駅：${stations.map(({ key, items }) => {
      const minutes = items.filter((value) => value != null);
      const walk = minutes.length ? `徒歩${minutes.join("・")}分` : "";
      if (items.length === 1 || single) return walk ? `${key}（${walk}）` : key;
      return `${key}（${items.length}件${walk ? `：${walk}` : ""}）`;
    }).join("・")}`);
  }

  const walks = properties.map((property) => walkMinutes(property.station)).filter((value) => value != null);
  if (walks.length) {
    const step = stepUp(LADDERS.walk, Math.max(...walks));
    lines.push(`・駅徒歩：${step == null ? "こだわらない" : `${step}分以内`}（図面：${walks.join("・")}分）`);
  }

  const priced = properties.filter((property) => property.rent != null);
  const unpriced = properties.filter((property) => property.rent == null);
  if (priced.length) {
    const monthly = priced.map(monthlyCost);
    const [low, high] = [Math.min(...monthly), Math.max(...monthly)];
    const cap = Math.ceil(high / LADDERS.rentStep) * LADDERS.rentStep;
    const printed = low === high ? `${manNumber(low)}万円` : `${manNumber(low)}万〜${manNumber(high)}万円`;
    const detail = single ? printed : `${printed}の${priced.length}件${unpriced.length ? `。${names(unpriced)}は賃料の記載なし` : ""}`;
    lines.push(`・賃料：${man(cap)}以下、管理費・共益費込み（図面：${detail}）`);
  } else {
    lines.push(`・賃料：図面に記載なし${single ? "" : `（${names(unpriced)}）`}`);
  }

  const layouts = groupBy(properties.filter((property) => property.layout).map((property) => [property.layout.normalize("NFKC").replace(/\s*\+.*$/, ""), property]));
  if (layouts.length) {
    if (single) lines.push(`・間取り：${properties[0].layout}`);
    else {
      lines.push(`・間取り：${layouts.map(({ key, items }, index) => {
        const variants = items.filter((property) => property.layout !== key).map((property) => `${property.name}は${property.layout}`);
        return `${key}（${index === 0 ? `${n}件中` : ""}${items.length}件${variants.length ? `。${variants.join("、")}` : ""}）`;
      }).join("・")}`);
    }
  }

  const sized = properties.filter((property) => property.areaSqm);
  if (sized.length) {
    const areas = sized.map((property) => property.areaSqm);
    const floor = Math.floor(Math.min(...areas) / LADDERS.areaStep) * LADDERS.areaStep;
    const notes = sized.flatMap((property) => (property.sheetWarnings ?? [])
      .filter((warning) => WARNING_NOTES[warning.code] && warning.fields?.includes("areaSqm"))
      .map((warning) => `${property.name}は${WARNING_NOTES[warning.code]}`));
    lines.push(`・専有面積：${floor}㎡以上（図面：${range(areas, String, "㎡")}${notes.length ? `。${notes.join("、")}` : ""}）`);
  }

  const years = properties.map((property) => property.constructionYear).filter(Boolean);
  if (years.length) {
    const step = stepUp(LADDERS.age, Math.max(0, today.getFullYear() - Math.min(...years)));
    const condition = step == null ? "こだわらない" : step === 0 ? "新築" : `${step}年以内`;
    lines.push(`・築年数：${condition}（図面：${range(years, String, "年")}）`);
  }

  lines.push(...answerLines(properties, answers));

  if (!single) {
    const pressed = chips.filter((chip) => chip.pressed);
    if (!pressed.length) {
      const hint = chips.length ? "上のボタンから選べます" : "";
      const none = chips.some((chip) => chip.defaultPressed) ? "" : `比べた${n}件に共通して記載のある設備・条件は見つかりませんでした`;
      lines.push(`・こだわり条件：（${[none, hint].filter(Boolean).join("。")}）`);
    } else {
      const items = pressed.map((chip, index) => {
        if (index === 0) return `${chip.label}（${n}件中${chip.count}件に記載）`;
        return `${chip.label}（${chip.count}件${chip.count === pressed[index - 1].count ? "" : "に記載"}）`;
      });
      lines.push(`・こだわり条件：${items.join("・")}${keyMoneyCaveat(properties, pressed)}`);
    }
  }
  return lines;
}

/** 礼金なし, when chosen: sheets counted for it that amortize the deposit, which is as unrecoverable as 礼金. */
function keyMoneyCaveat(properties, pressed) {
  const chip = pressed.find((item) => item.key === "noKeyMoney");
  if (!chip) return "";
  const counted = new Set(chip.sheets.map((sheet) => sheet.id));
  const notes = properties.filter((property) => counted.has(property.id)).flatMap((property) => (property.costs ?? [])
    .filter((cost) => cost.kind === "amortization")
    .map((cost) => `${property.name}は${cost.label}${cost.unit === "months" ? `${cost.amount}ヶ月` : cost.unit === "yen" ? yen(cost.amount) : ""}`));
  return notes.length ? `※${notes.join("、")}（戻らない点は礼金と同じ）` : "";
}

/** Search lines added by the answers to the questions on screen (a stored answer to a question no longer asked is ignored). */
function answerLines(properties, answers) {
  const n = properties.length;
  const lines = [];
  for (const question of deriveQuestions(properties)) {
    const answer = answers[question.key];
    if (question.key === "moveSoon" && answer === "yes") {
      lines.push(`${ANSWER_LINES.moveSoon}（${n === 1 ? "図面に違約金の記載あり" : `比べた${n}件は${question.count}件に違約金の記載あり`}）`);
    }
    if (question.key === "viewFirst" && answer === "yes") {
      const evidence = question.viewing ? `内見の時期・先行契約の記載が${question.viewing}件` : `掲載写真が別の部屋の図面が${question.photos}件`;
      lines.push(`${ANSWER_LINES.viewFirst}（${evidence}）`);
    }
    if (question.key === "floor" && Array.isArray(answer)) {
      if (answer.includes("upper")) lines.push(ANSWER_LINES.upper);
      if (answer.includes("elevator")) lines.push(ANSWER_LINES.elevator);
    }
  }
  return lines;
}

/** Ask-line keys a yes brings to the top, in QUESTIONS order. */
function priorityKeys(properties, answers) {
  return deriveQuestions(properties).filter((question) => answers[question.key] === "yes").flatMap((question) => QUESTIONS.find((item) => item.key === question.key).first);
}

/** One sheet's own asks: missing rent, its warnings, then its clauses not asked of all (PER_SHEET_ORDER), capped. */
function sheetAsks(property, shared, priority) {
  const items = [];
  const fieldName = (key) => (key ? fieldLabel(key).replace(/（.+）$/, "") : "値");
  const clause = (key) => {
    const template = TEMPLATES.get(key);
    if (!template || shared.has(key) || !hasAny(property, template.codes)) return null;
    return fill(template.text, { amount: printedAmount(property, template) });
  };
  // Missing rent and warnings, clauses a yes brought forward, PER_SHEET_ORDER, then clauses asked of
  // all sheets elsewhere whose shared line did not qualify or fit.
  const order = [...new Set(["rent", "warnings", ...priority, ...PER_SHEET_ORDER, ...TEMPLATES.keys()])];
  for (const key of order) {
    if (key === "rent") {
      if (property.rent == null) {
        const types = (property.sheetWarnings ?? []).some((warning) => warning.code === "multiple_candidates");
        items.push(types ? FIELD_ASK.rentOfType : FIELD_ASK.rent);
      }
    } else if (key === "warnings") {
      for (const warning of property.sheetWarnings ?? []) {
        const field = warning.fields?.[0];
        const label = fieldName(field);
        if (warning.code === "inconsistent_values") {
          const [a, b] = warning.message.match(/\d[\d,]*(?:\.\d+)?/g) ?? [];
          items.push(b == null ? fill(FIELD_ASK.inconsistentUnparsed, { label }) : fill(FIELD_ASK.inconsistent_values, { label, a, b, unit: FIELD_UNITS[field] ?? "" }));
        } else if (FIELD_ASK[warning.code]) {
          items.push(fill(FIELD_ASK[warning.code], { label }));
        }
      }
    } else {
      const text = clause(key);
      if (text) items.push(text);
    }
  }
  return [...new Set(items)].slice(0, PER_SHEET_CAP);
}

/**
 * Lines under ■ 不動産会社に聞くこと: the general line, then clauses on more than half of the sheets as
 * one line each (at most SHARED_CAP, in ASK_TEMPLATES order, with the ones a yes brought forward
 * first), then one line per sheet. With one sheet, its clauses are listed without counts.
 */
export function askLines(properties, answers = {}) {
  const n = properties.length;
  if (!n) return [];
  const priority = priorityKeys(properties, answers);
  const counted = ASK_TEMPLATES.map((template) => ({ template, sheets: properties.filter((property) => hasAny(property, template.codes)) }));
  const qualifies = ({ sheets }) => (n === 1 ? sheets.length === 1 : sheets.length > n / 2);
  const shared = counted.filter(qualifies).slice(0, SHARED_CAP);
  const rank = (key) => (priority.includes(key) ? priority.indexOf(key) : priority.length);
  const ordered = shared.map((entry, index) => ({ ...entry, index })).sort((a, b) => rank(a.template.key) - rank(b.template.key) || a.index - b.index);
  const lines = [`・${GENERAL_ASK}`];
  for (const { template, sheets } of ordered) {
    const text = fill(template.text, { amount: "" });
    lines.push(n === 1 ? `・${text}` : `・${text}（${sheets.length === n ? `${n}件とも` : names(sheets)}）`);
  }
  const sharedKeys = new Set(shared.map(({ template }) => template.key));
  for (const property of properties) {
    const items = sheetAsks(property, sharedKeys, priority);
    if (items.length) lines.push(`・${property.name}：${items.join("／")}`);
  }
  return lines;
}

const dateText = (today) => `${today.getFullYear()}/${today.getMonth() + 1}/${today.getDate()}`;

/**
 * The whole memo for the sheets on screen: { heading, search, ask, footer, chips, questions }.
 * @param pickOverrides { [aspectKey]: true | false } chips the person pressed or released
 * @param answers       { moveSoon: "yes" | "no" | "later", viewFirst: …, floor: ["upper", "elevator"] }
 */
export function buildMemo(properties, pickOverrides = {}, answers = {}, today = new Date()) {
  const n = properties.length;
  if (!n) return { heading: "", search: [], ask: [], footer: "", chips: [], questions: [], placeholder: PLACEHOLDER };
  const chips = chipStates(aspectCounts(properties), n, pickOverrides);
  return {
    heading: fill(SEARCH_HEADING, { n, date: dateText(today) }),
    search: searchLines(properties, chips, answers, today),
    ask: askLines(properties, answers),
    footer: FOOTER(n),
    chips,
    questions: deriveQuestions(properties),
    placeholder: null,
  };
}

/** The memo as plain text: 「■」 heads, 「・」 bullets, one blank line between blocks. */
export function memoText(memo) {
  if (memo.placeholder) return memo.placeholder;
  return [memo.heading, ...memo.search, "", ASK_HEADING, ...memo.ask, "", memo.footer].join("\n");
}

/** Tenant choices are the memo's requirements; shared listing attributes stay out of this output. */
export function buildTenantMemo(state) {
  const counts = aspectCounts(state.properties);
  const explicit = Object.fromEntries(counts.map(({ key }) => [key, state.pickOverrides[key] === true]));
  const memo = buildMemo(state.properties, explicit, state.answers);
  const chosen = memo.chips.filter((chip) => chip.pressed).map((chip) => `・${chip.label}`);
  const responses = memo.questions.flatMap((question) => {
    const answer = state.answers[question.key];
    if (answer == null) return [];
    const labels = question.options.filter((option) => Array.isArray(answer) ? answer.includes(option.value) : answer === option.value).map((option) => option.label);
    return labels.length ? [`・${question.text} → ${labels.join("・")}`] : [];
  });
  const text = [priorityMemo(state.priorities), ...(chosen.length ? ["", "■ 自分で選んだ設備・条件", ...chosen] : []), ...(responses.length ? ["", "■ 確認したい暮らし・契約条件", ...responses] : []), ...(memo.ask.length ? ["", ASK_HEADING, ...memo.ask] : [])].join("\n");
  return { ...memo, text };
}
