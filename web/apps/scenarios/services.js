import { observedValue } from "../priorities/services.js";
import { nearestKnown } from "../leisure/services.js";

/** No aggregate score: each comparison names a dimension, source time, and missing values. */
export function scenarioRows(state, commute, leisure, daysPerWeek) {
  const notes = state.priorities.notes || [];
  const preference = notes.find((n) => n.source === "commute");
  const objective =
    preference?.details?.objective || commute?.schedule.objective || "fastest";
  const key = {
    fastest: "minutes",
    transfers: "transfers",
    walking: "walkingMinutes",
  }[objective];
  const interests = notes
    .filter((n) => n.source?.startsWith("leisure:"))
    .map((n) => n.source.slice(8));
  const rows = state.properties.map((p) => {
    const observed = commute?.candidates.find((c) => c.id === p.id);
    const known = (observed?.routes || []).filter((r) => r[key] != null);
    const route =
      [...known].sort((a, b) => a[key] - b[key] || a.minutes - b.minutes)[0] ||
      null;
    const returning =
      [...(observed?.returnTrip?.routes || [])]
        .filter((r) => r[key] != null)
        .sort((a, b) => a[key] - b[key] || a.minutes - b.minutes)[0] || null;
    const monthly = observedValue(p, "budget");
    return {
      id: p.id,
      name: p.name,
      monthly,
      route,
      returning,
      weeklyRoundTripMinutes:
        daysPerWeek === 0
          ? 0
          : route && returning
            ? (route.minutes + returning.minutes) * daysPerWeek
            : null,
      objective,
      objectiveConfirmed: !!preference,
      weeklyOutboundMinutes: route
        ? route.minutes * daysPerWeek
        : daysPerWeek === 0
          ? 0
          : null,
      leisure: interests.map((kind) => ({
        kind,
        minutes: nearestKnown(leisure, p.id, kind),
      })),
      gaps: [
        ...(monthly == null ? ["月額の確定"] : []),
        ...(daysPerWeek > 0 && !route ? ["勤務先への経路確認"] : []),
        ...(daysPerWeek > 0 && commute?.schedule.returnAt && !returning
          ? ["帰りの経路確認"]
          : []),
      ],
      advantages: [],
    };
  });
  const costs = rows.filter((r) => r.monthly != null);
  const times = rows.filter((r) => r.route);
  rows.forEach((row) => {
    if (
      costs.length > 1 &&
      row.monthly === Math.min(...costs.map((r) => r.monthly))
    )
      row.advantages.push(
        `月額は確認できた${costs.length}件中で最小。未確認候補は比較対象外。`,
      );
    if (
      daysPerWeek > 0 &&
      times.length > 1 &&
      row.route?.[key] === Math.min(...times.map((r) => r.route[key]))
    )
      row.advantages.push(
        `通勤の比較軸では取得できた${times.length}件中で最小。未取得経路は比較対象外。`,
      );
    row.leisure
      .filter((i) => i.minutes == null)
      .forEach((i) => row.gaps.push(`${i.kind} の営業状態・徒歩経路の確認`));
  });
  return rows;
}

/** These observations are ephemeral. Only accepted intentions, never these strings, are persisted. */
export function journeyEvidence(properties, commute, leisure) {
  return properties.flatMap((p, index) => {
    const evidence = [];
    const add = (suffix, text) =>
      evidence.push({
        id: `journey${index}-${suffix}`,
        candidate: p.name,
        kind: "maps",
        text: text.slice(0, 1500),
      });
    const journey = commute?.candidates.find((c) => c.id === p.id);
    if (journey)
      add(
        "commute",
        `Google Maps 取得 ${commute.checkedAt}。同一目的地への通勤、${commute.schedule.mode}、${commute.schedule.at} ${commute.schedule.timeKind}、週${commute.schedule.daysPerWeek}日という試算（希望として未確認の場合あり）。状態 ${journey.status}。${journey.routes.map((r) => `片道 ${r.minutes}分、徒歩 ${r.walkingMinutes ?? "未取得"}分、乗換 ${r.transfers ?? "未取得"}回`).join("／")}。${commute.schedule.returnAt ? `帰りは ${commute.schedule.returnAt} 出発、状態 ${journey.returnTrip?.status || "未取得"}。${(journey.returnTrip?.routes || []).map((r) => `${r.minutes}分`).join("／")}` : "帰りは未取得"}。掲載の駅徒歩と別の指標。`,
      );
    const nearby = leisure?.candidates.find((c) => c.id === p.id);
    if (nearby)
      add(
        "leisure",
        `Google Maps 取得 ${leisure.checkedAt}。状態 ${nearby.status}。候補施設は網羅的ではなく最寄り保証なし。${nearby.groups.map((g) => `${g.kind}：${g.places.map((v) => `${v.name} 徒歩${v.route?.minutes ?? "未取得"}分、営業状態 ${v.businessStatus}`).join("、") || "取得なし"}`).join("／")}。施設の存在は好み・安全性・用途適合の証拠ではない。`,
      );
    return evidence;
  });
}
