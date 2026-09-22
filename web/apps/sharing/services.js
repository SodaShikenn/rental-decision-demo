import { observedValue, priorityMemo } from "../priorities/services.js";
import { buildTenantMemo } from "../needs/services.js";
import { safeLink } from "../../shared/maps.js";

/** Build a fresh allowlisted document, never serialize application state wholesale. */
export function buildBrief(
  state,
  { includeDestination = false, destination = "" } = {},
) {
  return {
    title: "住まい選びの条件メモ",
    generatedAt: new Date().toISOString(),
    candidates: state.properties.map((p) => ({
      name: p.name,
      monthly: observedValue(p, "budget"),
      area: observedValue(p, "area"),
      sources: [
        ...(safeLink(p.sourceUrl)
          ? [{ label: "掲載元", url: safeLink(p.sourceUrl), retrievedAt: "" }]
          : []),
        ...Object.entries(p.fieldSources || {})
          .filter(([, s]) => safeLink(s.url))
          .map(([key, s]) => ({
            label: `掲載情報：${key}`,
            url: safeLink(s.url),
            retrievedAt: s.retrievedAt || "",
          })),
      ].slice(0, 8),
    })),
    preferences: priorityMemo(state.priorities),
    questions: buildTenantMemo(state).ask,
    destination: includeDestination ? destination : "",
  };
}
