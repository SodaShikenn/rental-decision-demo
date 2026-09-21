// Condition-memo vocabulary (≈ models.py). The memo restates what the compared sheets have in common
// in the words of the listing portals' search filters, and lists what to ask the agent. Every line is
// built from printed values, counts, or the ladder steps below; the renter edits or deletes the rest.
import { EQUIPMENT_ASPECTS } from "../compare/models.js";

/**
 * What the chips count, in this order: equipment words found in the sheet text (see
 * compare/services.js equipmentOnSheet), then money terms printed as 0 (礼金 0ヶ月, 敷金なし).
 */
export const ASPECTS = [
  ...EQUIPMENT_ASPECTS.map(({ key, label, term }) => ({ key, label, term, source: "term" })),
  { key: "noKeyMoney", label: "礼金なし", term: "礼金", source: "cost", kind: "keyMoney" },
  { key: "noDeposit", label: "敷金なし", term: "敷金", source: "cost", kind: "deposit" },
];

/**
 * Steps of the portals' search filters. A walk or an age is rounded up to the next step, an area down
 * and a rent up to the next multiple, so every sheet compared still fits the condition.
 */
export const LADDERS = { walk: [1, 3, 5, 7, 10, 15, 20], areaStep: 5, age: [0, 1, 3, 5, 7, 10, 15, 20, 25, 30], rentStep: 5000 };

/** How many sheets must share an aspect before it starts in the memo: 3 of 3, 3 of 4, 4 of 6; never 2. */
export const MAJORITY = (n) => Math.max(3, Math.floor(n / 2) + 1);

/**
 * Questions asked only when a clause that triggers them is on a sheet on screen (`codes`, from
 * server/apps/listing/checks.py). `first` are the ask lines a yes brings to the top of 聞くこと.
 * Answers never hide, reorder, or score the sheets.
 */
export const QUESTIONS = [
  {
    key: "moveSoon",
    codes: ["short_term_penalty"],
    type: "radio",
    options: [{ value: "yes", label: "ある" }, { value: "no", label: "ない" }, { value: "later", label: "あとで" }],
    initial: "later",
    first: ["short_term_penalty", "notice_period"],
  },
  {
    key: "viewFirst",
    codes: ["before_viewing", "photos_differ"],
    type: "radio",
    options: [{ value: "yes", label: "はい" }, { value: "no", label: "いいえ" }, { value: "later", label: "あとで" }],
    initial: "later",
    first: ["before_viewing"],
  },
  {
    key: "floor",
    codes: ["ground_floor", "no_elevator"],
    type: "checkbox",
    options: [{ value: "upper", label: "2階以上がいい" }, { value: "elevator", label: "エレベーターが必要" }],
    initial: [],
    first: [],
  },
];

/** Search lines a question's answer adds under 探す条件 (after 築年数). */
export const ANSWER_LINES = {
  moveSoon: "・契約の縛り：短期解約違約金・長い解約予告の物件は避けたい",
  viewFirst: "・内見してから申し込みたい",
  upper: "・階：2階以上",
  elevator: "・エレベーターあり",
};

/**
 * What to ask the agent, per clause, in the order shared lines are listed. `codes` are the checks
 * that call for the line; `{amount}` is filled with the printed amount of the matching money term
 * (`amount` matches its label) on per-sheet lines. as_is and foreign_terms have no line.
 */
export const ASK_TEMPLATES = [
  { key: "short_term_penalty", codes: ["short_term_penalty"], text: "短期解約違約金の期間と金額" },
  { key: "notice_period", codes: ["notice_period"], text: "解約予告は何ヶ月前か" },
  { key: "before_viewing", codes: ["before_viewing"], text: "内見できる時期と、内見後に断れるか" },
  { key: "guarantor_fees", codes: ["guarantor_fees"], text: "保証会社の初回・毎月・毎年の保証料" },
  { key: "services", codes: ["required_services", "insurance"], text: "必須の付帯サービス・火災保険は外せるか、自分で選べるか" },
  { key: "renewal_fee", codes: ["renewal_fee"], text: "更新料と更新事務手数料の額" },
  { key: "free_rent", codes: ["free_rent"], text: "フリーレントの適用範囲と短期解約違約金の関係" },
  { key: "deposit_amortized", codes: ["deposit_amortized"], text: "敷金・保証金の償却分（戻らない額）" },
  { key: "extra_terms", codes: ["extra_terms"], text: "図面にない補足事項の全文" },
  { key: "photos_differ", codes: ["photos_differ"], text: "掲載写真はこの部屋のものか" },
  { key: "no_elevator", codes: ["no_elevator"], text: "エレベーターなし：階と搬入" },
  { key: "ground_floor", codes: ["ground_floor"], text: "1階：防犯・日当たり" },
  { key: "restrictions", codes: ["restrictions"], text: "ペット・楽器・在宅の仕事の制限" },
  { key: "cleaning", codes: ["cleaning"], text: "クリーニング費用{amount}の内訳と時期", amount: /クリ.?ニング/ },
  { key: "key_exchange", codes: ["key_exchange"], text: "鍵交換費用{amount}", amount: /鍵交換/ },
  { key: "admin_fee", codes: ["admin_fee"], text: "手数料（契約事務・引落など）{amount}", amount: /手数料/ },
  { key: "fixed_term", codes: ["fixed_term"], text: "定期借家：再契約の条件" },
];

/** Order of a sheet's own ask line: missing rent, the sheet's warnings, then clauses not asked of all. */
export const PER_SHEET_ORDER = [
  "rent",
  "warnings",
  "deposit_amortized",
  "free_rent",
  "extra_terms",
  "photos_differ",
  "no_elevator",
  "ground_floor",
  "restrictions",
  "cleaning",
  "key_exchange",
  "admin_fee",
  "fixed_term",
];

/** Ask lines for values the sheet did not settle. {label}, {a}, {b} and {unit} come from the field and the warning. */
export const FIELD_ASK = {
  rent: "賃料（図面に記載なし）",
  rentOfType: "希望タイプの賃料（図面に記載なし）",
  inconsistent_values: "{label}は{a}{unit}か{b}{unit}か（図面内で不一致）",
  inconsistentUnparsed: "{label}の値（図面内で不一致）",
  multiple_candidates: "検討するタイプの間取り・面積・共益費",
  illegible: "{label}の値（図面で判読困難）",
};
/** Units for FIELD_ASK, by field. */
export const FIELD_UNITS = { rent: "円", managementFee: "円", areaSqm: "㎡", constructionYear: "年" };

/** Always asked: what no sheet prints. */
export const GENERAL_ASK = "仲介手数料の額と、初期費用の見積書（図面に載らない仲介手数料・前家賃を含めて）";

export const SHARED_CAP = 6;
export const PER_SHEET_CAP = 4;

export const PLACEHOLDER = "図面を加えると、ここに条件メモができます";
export const SEARCH_HEADING = "■ 探す条件（募集図面{n}件から・{date}）";
export const ASK_HEADING = "■ 不動産会社に聞くこと";

/** The memo's last paragraph: where the values came from and what they cannot tell. */
export const FOOTER = (n) =>
  `値は募集図面の記載（OCRで読み取り、原本と照合済み）。募集状況は未確認。通勤時間・周辺環境・賃料の推移・口コミは図面にないため含みません。${
    n === 1 ? "この図面の値を並べたものなので" : `${n}件に共通する点を並べた推測なので`
  }、違うものは消してください。`;
