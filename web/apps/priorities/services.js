import { yen } from "../../helper.js";
import { walkMinutes } from "../compare/services.js";

export const PRIORITIES = [
  { key: "budget", label: "月額の上限", unit: "円", row: "monthly", direction: "max" },
  { key: "walk", label: "駅まで徒歩", unit: "分以内", row: "station", direction: "max" },
  { key: "area", label: "部屋の広さ", unit: "㎡以上", row: "layout", direction: "min" },
];
export const LEVELS = { later: "未定", prefer: "できれば", must: "必須" };
export const emptyPriorities = () => ({ lifestyle: "", budget: { level: "later", value: null }, walk: { level: "later", value: null }, area: { level: "later", value: null }, focus: "", openQuestions: "", pending: [] });

// A missing management fee never silently becomes zero in a fit judgement.
export function observedValue(property, key) {
  if (property.provenance?.mode === "mock") return null;
  const fields = { budget: ["rent", "managementFee"], walk: ["station"], area: ["areaSqm"] }[key] ?? [];
  const edited = [...(property.provenance?.editedFields ?? []), ...(property.provenance?.confirmedFields ?? []), ...Object.keys(property.fieldSources ?? {})];
  if ((property.unconfirmedFields ?? []).some((field) => fields.includes(field))) return null;
  if ((property.sheetWarnings ?? []).some((warning) => ["inconsistent_values", "multiple_candidates", "illegible"].includes(warning.code) && warning.fields?.some((field) => fields.includes(field) && !edited.includes(field)))) return null;
  if (key === "budget") return property.rent == null || property.managementFee == null ? null : property.rent + property.managementFee;
  if (key === "walk") return walkMinutes(property.station);
  if (key === "area") return property.areaSqm ?? null;
  return null;
}

export function assessCandidate(property, priorities) {
  return PRIORITIES.filter(({ key }) => priorities[key]?.level !== "later" && priorities[key]?.value > 0).map((definition) => {
    const { key, direction } = definition;
    const preference = priorities[key];
    const value = observedValue(property, key);
    const fits = value == null ? null : direction === "min" ? value >= preference.value : value <= preference.value;
    return { ...definition, level: preference.level, limit: preference.value, value, status: fits == null ? "unknown" : fits ? "fits" : preference.level === "must" ? "conflict" : "tradeoff" };
  });
}

export const formatPriority = (key, value) => key === "budget" ? yen(value) : `${value}${key === "walk" ? "分" : "㎡"}`;

// One real pair with opposing advantages; never infer commute time from station walking time.
export function findTradeoff(properties) {
  for (let i = 0; i < properties.length; i++) {
    for (const b of properties.slice(i + 1)) {
      const a = properties[i];
      const ac = observedValue(a, "budget"), bc = observedValue(b, "budget");
      const aw = observedValue(a, "walk"), bw = observedValue(b, "walk");
      if ([ac, bc, aw, bw].some((value) => value == null) || ac === bc || aw === bw) continue;
      const cheaper = ac < bc ? a : b, closer = ac < bc ? b : a;
      if (observedValue(cheaper, "walk") <= observedValue(closer, "walk")) continue;
      return { cheaper, closer, saving: Math.abs(ac - bc), extraWalk: Math.abs(aw - bw) };
    }
  }
  return null;
}

export function priorityMemo(priorities) {
  const lines = ["■ 自分で選んだ条件"];
  if (priorities.lifestyle.trim()) lines.push(`暮らしの希望：${priorities.lifestyle.trim()}`);
  for (const { key, label } of PRIORITIES) {
    const item = priorities[key];
    if (item.level !== "later" && item.value > 0) lines.push(`・${LEVELS[item.level]}：${label} ${formatPriority(key, item.value)}${key === "area" ? "以上" : "以下"}`);
  }
  if (priorities.focus) lines.push(`・比較で重視：${{ budget: "月額の負担", walk: "駅への近さ", later: "まだ決めていない" }[priorities.focus]}`);
  for (const note of priorities.notes ?? []) lines.push(`・${LEVELS[note.level] ?? "未定"}：${note.text}`);
  if (lines.length === 1) lines.push("まだ決めていません。候補を比べながら整理します。");
  if (priorities.openQuestions.trim()) lines.push("", "■ まだ迷っていること・避けたいこと", priorities.openQuestions.trim());
  if (priorities.pending?.length) lines.push("", "■ まだ決められない条件", ...priorities.pending.map((key) => `・${PRIORITIES.find((item) => item.key === key)?.label ?? key}：ほかの条件と比べてから考えたい`));
  return lines.join("\n");
}
