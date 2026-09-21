// Candidate-first discovery: observations are evidence; requirements require a response.
import { observedValue, formatPriority, PRIORITIES } from "./services.js";
import { equipmentOnSheet } from "../compare/services.js";
import { estimateCosts } from "../costs/services.js";

export function candidateAnalysis(properties, settings) {
  const usable = properties.filter((property) => property.provenance?.mode !== "mock");
  const dimensions = PRIORITIES.map((definition) => {
    const entries = usable.flatMap((property) => {
      const value = observedValue(property, definition.key);
      return value == null ? [] : [{ id: property.id, name: property.name, value }];
    });
    const values = [...new Set(entries.map((entry) => entry.value))].sort((a, b) => a - b);
    return { ...definition, entries, values, missing: properties.length - entries.length };
  });
  const equipment = new Map();
  for (const property of usable) {
    for (const item of equipmentOnSheet(property)) {
      const entry = equipment.get(item.key) ?? { key: item.key, label: item.label, names: [] };
      entry.names.push(property.name);
      equipment.set(item.key, entry);
    }
  }
  const clauses = usable.flatMap((property) => (property.checks ?? []).map((check) => ({ name: property.name, title: check.title, code: check.code })));
  const initial = usable.flatMap((property) => {
    const estimate = estimateCosts(property, settings);
    return estimate.initial.complete ? [{ name: property.name, amount: estimate.initial.amount }] : [];
  });
  return { dimensions, equipment: [...equipment.values()].sort((a, b) => b.names.length - a.names.length), clauses, initial };
}

export function discoveryQuestions(analysis) {
  return analysis.dimensions.filter((item) => item.values.length).map((dimension) => {
    const { key, entries, values } = dimension;
    const evidence = entries.map((item) => `${item.name}：${formatPriority(key, item.value)}`).join("／");
    const question = {
      budget: "この月額の違いを見ると、どこまでなら候補に残したいですか？",
      walk: "候補の駅までの距離を見ると、徒歩はどこまでなら受け入れられそうですか？",
      area: "候補の広さを見ると、どのくらいの広さを確保したいですか？",
    }[key];
    return {
      key, question, evidence,
      // An answer is only valid for this exact evidence, not a different set of candidates.
      fingerprint: JSON.stringify(entries.map(({ id, value }) => [id, value])),
      options: values.map((value) => ({ value, label: `${formatPriority(key, value)}${key === "area" ? "以上を目安に" : "までを目安に"}` })),
    };
  });
}

export function nextDiscoveryQuestion(questions, priorities, responses) {
  return questions.find((question) => priorities[question.key].level === "later" && responses[question.key] !== question.fingerprint) ?? null;
}
