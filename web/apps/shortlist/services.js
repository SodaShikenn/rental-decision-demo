// Ranking logic (≈ services.py). Pure functions: no DOM, no shared state, so they are unit-tested
// in web/tests. The formula is illustrative and has not been calibrated with users.
import { PRIORITY_LABELS } from "./models.js";

export const priorityLabel = (key) => PRIORITY_LABELS[key];

/** Candidates added from a listing sheet have no route or neighbourhood data yet. */
export const isProvisional = (property) => property.enriched === false;

/** Unknown rent is neither affordable nor expensive: it scores the midpoint and stays provisional. */
export function budgetScore(rent, budget) {
  if (rent == null) return 12.5;
  return rent <= budget ? 25 : Math.max(0, 25 - (rent - budget) / 700);
}

export function scoreProperty(property, { budget, priorities, weekend }) {
  const commuteValue = isProvisional(property) ? 5 : Math.max(0, 10 - Math.max(0, property.commute - 20) / 3);
  let score = budgetScore(property.rent, budget) + commuteValue * 1.2;
  priorities.forEach((priority) => {
    const value = priority === "commute" ? commuteValue : (property[priority] ?? 5);
    score += value * 2.5;
  });
  if (weekend) score += (property.weekend ?? 5) * 0.6;
  return Math.round(Math.min(99, score));
}

export function rankProperties(properties, preferences) {
  return [...properties].sort((a, b) => scoreProperty(b, preferences) - scoreProperty(a, preferences));
}
