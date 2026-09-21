// Ordering logic (≈ services.py). Pure functions: no DOM, no shared state, so they are unit-tested
// in web/tests. The match formula is illustrative and has not been calibrated with users; it orders
// candidates by the renter's own conditions and never picks one for them.
import { estimateCosts } from "../costs/services.js";
import { CRITERIA, SITUATIONS, STATIONS } from "./models.js";

// Score used for anything the sheet did not give (for example an unprinted rent).
const NEUTRAL = 5;
const PRIORITY_WEIGHT = 2.5;

export const priorityLabel = (key) => CRITERIA.find((criterion) => criterion.key === key)?.priority ?? key;

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

/** [latitude, longitude] of the candidate's station, or null when it is not on the map. */
export const stationPosition = (property) => STATIONS[stationName(property.station)] ?? null;

/** Rent plus the management fee. Unknown rent means an unknown total; an unknown fee counts as 0. */
export const monthlyCost = ({ rent, managementFee }) => (rent == null ? null : rent + (managementFee ?? 0));

/** Within budget scores 25; each 700 yen over costs a point. Unknown cost scores the midpoint. */
export function budgetScore(cost, budget) {
  if (cost == null) return 12.5;
  return cost <= budget ? 25 : Math.max(0, 25 - (cost - budget) / 700);
}

const clamp = (value) => Math.max(0, Math.min(10, value));
/** 10 within a 5-minute walk, one point less per extra minute. */
export const walkScore = (minutes) => clamp(10 - Math.max(0, minutes - 5));
/** 0 at 15㎡, half a point per ㎡, 10 from 35㎡. */
export const spaceScore = (sqm) => clamp((sqm - 15) / 2);
/** 10 when new, one point less every 3 years. */
export const ageScore = (year, currentYear) => clamp(10 - Math.max(0, currentYear - year) / 3);

/** A criterion's 0–10 score, or null when the sheet did not give the value it needs. */
export function criterionScore(property, key, currentYear = new Date().getFullYear()) {
  if (key === "walk") {
    const minutes = walkMinutes(property.station);
    return minutes == null ? null : walkScore(minutes);
  }
  if (key === "space") return property.areaSqm ? spaceScore(property.areaSqm) : null;
  if (key === "age") return property.constructionYear ? ageScore(property.constructionYear, currentYear) : null;
  return null;
}

/**
 * Each component of the score, priorities first. `neutral` marks a component that uses an assumed
 * value because the sheet did not give one; `note` says which.
 */
export function scoreBreakdown(property, { budget, priorities }, currentYear) {
  const cost = monthlyCost(property);
  const feeUnknown = cost != null && property.managementFee == null;
  const rows = [{
    key: "budget",
    label: "予算（月額）",
    points: budgetScore(cost, budget),
    neutral: cost == null || feeUnknown,
    note: cost == null ? "賃料未取得のため中立値" : feeUnknown ? "管理費未取得・賃料のみで計算" : null,
  }];
  const ordered = [...CRITERIA].sort((a, b) => priorities.has(b.key) - priorities.has(a.key));
  for (const { key, label, priority } of ordered) {
    const isPriority = priorities.has(key);
    const value = criterionScore(property, key, currentYear);
    rows.push({
      key,
      label: isPriority ? `${priority}（譲れない条件）` : label,
      points: (value ?? NEUTRAL) * (isPriority ? PRIORITY_WEIGHT : 1),
      neutral: value == null,
      note: value == null ? "未取得のため中立値" : null,
    });
  }
  return rows;
}

/** A score is provisional when any part of it rests on an assumed value. */
export const isProvisional = (property, preferences, currentYear) => scoreBreakdown(property, preferences, currentYear).some((row) => row.neutral);

export function scoreProperty(property, preferences, currentYear) {
  const total = scoreBreakdown(property, preferences, currentYear).reduce((sum, row) => sum + row.points, 0);
  return Math.round(Math.min(99, total));
}

export function rankProperties(properties, preferences, currentYear) {
  return [...properties].sort((a, b) => scoreProperty(b, preferences, currentYear) - scoreProperty(a, preferences, currentYear));
}

/** Order candidates by the key the renter chose (SORTS); candidates without the value go last. */
export function sortProperties(properties, preferences, costAdjustments = {}, currentYear) {
  if ((preferences.sortBy ?? "match") === "match") return rankProperties(properties, preferences, currentYear);
  const value = {
    monthly: (property) => monthlyCost(property),
    initial: (property) => {
      const { initial } = estimateCosts(property, preferences, costAdjustments[property.id]);
      return initial.complete ? initial.amount : null;
    },
    walk: (property) => walkMinutes(property.station),
    space: (property) => (property.areaSqm ? -property.areaSqm : null),
    age: (property) => (property.constructionYear ? -property.constructionYear : null),
  }[preferences.sortBy];
  return [...properties].sort((a, b) => {
    const [first, second] = [value(a), value(b)];
    if (first == null || second == null) return (first == null) - (second == null);
    return first - second;
  });
}

/** What the renter's situations bring forward: pre-contract check codes, glossary terms, cost labels. */
export function situationFocus(situations = []) {
  const keys = new Set(situations);
  const chosen = SITUATIONS.filter((situation) => keys.has(situation.key));
  return {
    checks: new Set(chosen.flatMap((situation) => situation.checks)),
    terms: new Set(chosen.flatMap((situation) => situation.terms)),
    costs: chosen.flatMap((situation) => situation.costs),
  };
}

/** The candidate's pre-contract checks that concern the renter's situations. */
export function relevantChecks(property, situations) {
  const { checks } = situationFocus(situations);
  return (property.checks ?? []).filter((check) => checks.has(check.code));
}
