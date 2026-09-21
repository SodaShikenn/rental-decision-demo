// Shortlist vocabulary (≈ models.py). Candidates are compared only on values printed on their
// listing sheets; what needs a data source that is not connected yet is listed separately, so the
// UI shows it as unavailable instead of estimating it.

/** Comparison criteria, each scored 0–10 from a value on the sheet (see services.js). */
export const CRITERIA = [
  { key: "walk", label: "駅徒歩", priority: "駅近" },
  { key: "space", label: "広さ", priority: "広さ" },
  { key: "age", label: "築年数", priority: "築浅" },
];

/** Conditions people ask for that need data sources which are not connected (see capabilities). */
export const UNAVAILABLE_PRIORITIES = [
  { label: "通勤時間", capability: "routes" },
  { label: "周辺の環境", capability: "places" },
];

/**
 * Ways to order the table. The tool orders; the renter decides. "match" is agreement with the renter's
 * own conditions (budget and non-negotiables), not a recommendation.
 */
export const SORTS = [
  { key: "match", label: "条件との一致度" },
  { key: "monthly", label: "月額が安い順" },
  { key: "initial", label: "初期費用が安い順" },
  { key: "walk", label: "駅から近い順" },
  { key: "space", label: "広い順" },
  { key: "age", label: "新しい順" },
];

/**
 * Situations that change what matters on a sheet. Each brings forward the pre-contract checks (codes
 * from server/apps/listing/checks.py), glossary terms, and optional costs that concern the renter.
 * Drawn from what renters are told to watch for on real sheets ("2年以内に引っ越すなら…", "外国籍の方は…").
 */
export const SITUATIONS = [
  { key: "moveSoon", label: "2年以内に引っ越すかも", checks: ["short_term_penalty", "notice_period", "free_rent"], terms: [], costs: [] },
  { key: "viewFirst", label: "内見してから決めたい", checks: ["before_viewing", "photos_differ", "as_is", "extra_terms"], terms: [], costs: [] },
  { key: "foreign", label: "外国籍", checks: ["foreign_terms", "guarantor_fees"], terms: ["保証会社（家賃保証会社）", "入居審査"], costs: [] },
  { key: "remoteWork", label: "在宅で仕事をする", checks: ["restrictions"], terms: ["インターネット無料", "RC造（鉄筋コンクリート造）", "鉄骨造（S造）", "木造"], costs: [] },
  { key: "cooking", label: "自炊が多い", checks: [], terms: ["コンロの口数・IH", "システムキッチン", "都市ガス・プロパンガス"], costs: [] },
  { key: "bicycle", label: "自転車を使う", checks: [], terms: [], costs: ["駐輪"] },
  { key: "bulky", label: "大きな家具・家電がある", checks: ["no_elevator"], terms: ["エレベーター", "室内洗濯機置場"], costs: [] },
  { key: "security", label: "1階は避けたい", checks: ["ground_floor"], terms: ["所在階・階建", "オートロック"], costs: [] },
];

/** Recorded sheets that seed the shortlist. The fourth sheet is the sample for adding a candidate. */
export const SEED_SHEET_IDS = ["louvre-shoto", "bresport", "granpaseo-4"];

/**
 * Approximate station positions [latitude, longitude] for the schematic map. Candidates are placed
 * at their nearest station, not at their address: turning an address into a position needs the
 * Geocoding API, which is not connected.
 */
export const STATIONS = {
  明大前: [35.6684, 139.6505],
  東松原: [35.6626, 139.6556],
  新代田: [35.6626, 139.6606],
  下北沢: [35.6614, 139.667],
  代々木上原: [35.669, 139.6797],
  代々木八幡: [35.6698, 139.6856],
  渋谷: [35.658, 139.7016],
};

/** Drawn on the map for orientation only. */
export const LANDMARK = "渋谷";
