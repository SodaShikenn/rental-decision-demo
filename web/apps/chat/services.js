// Rule-based trade-off answers (≈ services.py). Not an LLM: every answer is derived from the
// current shortlist so its reasoning stays inspectable. Returns HTML with all data escaped.
import { escapeHTML, yen } from "../../helper.js";
import { isProvisional, priorityLabel, rankProperties } from "../shortlist/services.js";

const strong = (text) => `<strong>${escapeHTML(text)}</strong>`;

export const recalculatedMessage = (best) => `条件を更新しました。${strong(best.name)}が最有力です。${escapeHTML(best.tradeoff)}`;

export function respondToChat(question, { properties, preferences }) {
  const [best] = rankProperties(properties, preferences);
  const lower = question.toLowerCase();

  if (lower.includes("1万円") || lower.includes("安く")) {
    const affordable = properties.filter((property) => property.rent != null).sort((a, b) => a.rent - b.rent)[0];
    if (isProvisional(affordable)) {
      return `家賃だけで比較すると${strong(affordable.name)}です。ただし、通勤と周辺施設は未取得のため、現時点では暫定候補です。`;
    }
    if (best.rent == null || isProvisional(best)) {
      return `家賃を抑えるなら${strong(affordable.name)}（${yen(affordable.rent)}/月）です。現在の最有力候補は賃料または通勤が未取得のため、差額は比較できません。`;
    }
    return `家賃を抑えるなら${strong(affordable.name)}です。${yen(best.rent - affordable.rent)}安くなりますが、通勤は${affordable.commute - best.commute}分長くなります。`;
  }
  if (lower.includes("買い物") || lower.includes("夜")) {
    const nightBest = properties.filter((property) => !isProvisional(property)).sort((a, b) => b.late - a.late)[0];
    return `夜の買い物を最優先するなら${strong(nightBest.name)}です。利便性は${nightBest.late}/10ですが、${escapeHTML(nightBest.tradeoff)}`;
  }
  if (lower.includes("理由") || lower.includes("なぜ")) {
    if (isProvisional(best)) return `${strong(best.name)}は家賃・間取りだけの暫定評価です。経路と周辺施設を取得するまで最終順位にはできません。`;
    const [first = "commute", second = "space"] = [...preferences.priorities];
    return `${strong(best.name)}は、${priorityLabel(first)}と${priorityLabel(second)}の両方でバランスが良く、予算との差額も小さいためです。`;
  }
  return `現在の条件では${strong(best.name)}が最有力です。「1万円安くするなら？」「夜の買い物を優先すると？」のように、妥協したい条件を聞いてください。`;
}
