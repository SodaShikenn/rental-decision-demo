// Rule-based answers (≈ services.py). Not an LLM: every answer is derived from the current shortlist,
// so its reasoning stays inspectable. Answers compare facts and trade-offs against the candidate the
// renter is looking at; they never pick one. Returns HTML with all data escaped.
import { escapeHTML, man, yen } from "../../helper.js";
import { estimateCosts } from "../costs/services.js";
import { lookupTerm } from "../glossary/services.js";
import { isProvisional, monthlyCost, priorityLabel, rankProperties, relevantChecks, scoreBreakdown, walkMinutes } from "../shortlist/services.js";

const strong = (text) => `<strong>${escapeHTML(text)}</strong>`;
const areaText = (property) => (property.areaSqm ? `${property.areaSqm}㎡` : "未取得");

/** What `option` gives up against `viewed`, on values both sheets printed. */
function tradeoffs(option, viewed) {
  const [walk, viewedWalk] = [walkMinutes(option.station), walkMinutes(viewed.station)];
  const lost = [];
  if (walk != null && viewedWalk != null && walk > viewedWalk) lost.push(`駅徒歩は${walk}分（今見ている候補は${viewedWalk}分）`);
  if (option.areaSqm && viewed.areaSqm && option.areaSqm < viewed.areaSqm) lost.push(`広さは${option.areaSqm}㎡（同${viewed.areaSqm}㎡）`);
  if (option.constructionYear && viewed.constructionYear && option.constructionYear < viewed.constructionYear) {
    lost.push(`築年は${option.constructionYear}年（同${viewed.constructionYear}年）`);
  }
  return lost.length ? `その代わり、${lost.join("、")}です。` : "駅徒歩・広さ・築年でも見劣りしません。";
}

export function respondToChat(question, { properties, preferences, costAdjustments = {}, selectedId = null }) {
  const ordered = rankProperties(properties, preferences);
  // Answers are about the candidate open in the detail panel, or the first one by match.
  const viewed = properties.find((property) => property.id === selectedId) ?? ordered[0];
  const lower = question.toLowerCase();

  const term = lookupTerm(question);
  if (term) return `${strong(term.term)}：${escapeHTML(term.text)}（用語辞典より）`;
  if (lower.includes("初期費用") || lower.includes("初期")) {
    const estimates = properties.map((property) => ({ property, ...estimateCosts(property, preferences, costAdjustments[property.id]) }));
    const known = estimates.filter(({ initial }) => initial.complete).sort((a, b) => a.initial.amount - b.initial.amount);
    if (!known.length) return "初期費用を計算できる候補がありません。図面の賃料を確認してください。";
    const listed = known.map((estimate) => `${escapeHTML(estimate.property.name)} ${man(estimate.initial.amount)}${estimate.rentAssumed ? "（仮の賃料）" : ""}`).join("、");
    const partial = estimates.filter(({ initial }) => !initial.complete).map(({ property }) => escapeHTML(property.name));
    return `初期費用の目安を安い順に並べると、${listed}です。${partial.length ? `${partial.join("、")}は賃料が図面にないため計算できません（初期費用の試算で賃料を入れると計算できます）。` : ""}仲介手数料${preferences.brokerageMonths}ヶ月・入居${escapeHTML(preferences.moveIn ?? "")}で計算しています。`;
  }
  if (lower.includes("注意") || lower.includes("確認") || lower.includes("見落と")) {
    const checks = viewed.checks ?? [];
    if (!checks.length) return `${strong(viewed.name)}の図面からは、決まった言葉で書かれた注意点は見つかりませんでした。重要事項説明で条件を確認してください。`;
    const relevant = relevantChecks(viewed, preferences.situations);
    const first = relevant.length ? relevant : checks.filter((check) => ["cost", "exit"].includes(check.category)).slice(0, 3);
    return `${strong(viewed.name)}の図面で${relevant.length ? "あなたの状況に関係するのは" : "特に確認したいのは"}、${first.map((check) => strong(check.title)).join("・")}です。全部で${checks.length}件あり、詳細パネルの「契約前に確認すること」に理由と図面の該当箇所をまとめています。`;
  }
  if (lower.includes("1万円") || lower.includes("安く")) {
    const priced = properties.filter((property) => monthlyCost(property) != null).sort((a, b) => monthlyCost(a) - monthlyCost(b));
    const cheapest = priced[0];
    if (!cheapest) return "月額が分かる候補がありません。図面の賃料と管理費を確認してください。";
    if (cheapest.id === viewed.id) return `今見ている${strong(viewed.name)}が、月額${man(monthlyCost(viewed))}で最も安い候補です。`;
    if (monthlyCost(viewed) == null) {
      return `月額が最も安いのは${strong(cheapest.name)}（月額${man(monthlyCost(cheapest))}）です。今見ている候補は賃料が図面に記載されていないため、差額は比べられません。`;
    }
    const saving = monthlyCost(viewed) - monthlyCost(cheapest);
    return `月額が最も安いのは${strong(cheapest.name)}で、今見ている${strong(viewed.name)}より月${yen(saving)}安くなります。${escapeHTML(tradeoffs(cheapest, viewed))}`;
  }
  if (lower.includes("駅")) {
    const nearest = properties.filter((property) => walkMinutes(property.station) != null).sort((a, b) => walkMinutes(a.station) - walkMinutes(b.station))[0];
    if (!nearest) return "駅からの徒歩分数が分かる候補がありません。";
    const cost = monthlyCost(nearest);
    return `駅から最も近いのは${strong(nearest.name)}（${escapeHTML(nearest.station)}）です。月額は${cost == null ? "未取得" : man(cost)}、広さは${areaText(nearest)}です。`;
  }
  if (lower.includes("通勤")) {
    return "通勤時間は、経路検索（Routes API）が未接続のため比較に含めていません。各候補の最寄駅と徒歩分数は図面の記載どおりに表示しています。";
  }
  if (lower.includes("口コミ") || lower.includes("評判")) {
    return "口コミは、再利用が許諾された提供元に未接続のため表示していません。推測や転載はしていません。";
  }
  if (lower.includes("理由") || lower.includes("なぜ") || lower.includes("並び")) {
    const [first] = ordered;
    const rows = scoreBreakdown(first, preferences);
    const [budget, ...criteria] = rows;
    const top = criteria.filter((row) => !row.neutral).sort((a, b) => b.points - a.points).slice(0, 2);
    const reasons = [
      budget.neutral ? "予算は賃料未取得のため中立値" : budget.points === 25 ? "月額が上限内" : `月額が上限を超えるため予算は${budget.points.toFixed(1)}点`,
      ...top.map((row) => `${row.label}で${row.points.toFixed(1)}点`),
    ];
    const caveat = isProvisional(first, preferences) ? "図面にない値を中立値で計算した暫定の並びです。" : "";
    return `一致度の順で${strong(first.name)}が先頭なのは、${escapeHTML(reasons.join("、"))}だからです。${caveat}一致度は選んだ条件から計算した目安なので、条件を変えると並びも変わります。`;
  }
  const priorities = [...preferences.priorities].map(priorityLabel).join("・") || "なし";
  return `候補${properties.length}件を、あなたの条件（譲れない条件：${escapeHTML(priorities)}）との一致度で並べています。「初期費用が安いのは？」「契約前の注意点は？」のように、比べたいことを聞いてください。`;
}
