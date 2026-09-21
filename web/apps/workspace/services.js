export const PERSPECTIVES = {
  cost: { label: '費用', title: '毎月と、入居時の負担', description: '月額は賃料＋管理費。金額を押すと、内訳や出典を確認できます。', rows: ['monthly', 'initial'], priority: 'budget' },
  space: { label: '広さ・建物', title: '部屋の広さと、建物のこと', description: '図面を開いて間取りを確認。複数タイプの値は、部屋の値と区別します。', rows: ['layout', 'age'], priority: 'area' },
  access: { label: '駅・買い物', title: '駅への近さと、いつもの買い物', description: '掲載の徒歩時間と地図の経路を確認。駅徒歩は通勤時間とは異なります。', rows: ['station'], priority: 'walk' },
  living: { label: '設備・契約', title: '暮らしに関わる設備と、契約条件', description: '記載のあるものから比較します。記載がないことは「ない」とは限りません。', rows: ['equipment', 'checks'], priority: null },
  all: { label: '一覧', title: '候補の情報を、ひと通り', description: '候補は追加した順。気になる項目を押すと、根拠を確認できます。', rows: ['monthly', 'initial', 'layout', 'station', 'age', 'equipment', 'checks'], priority: null },
};
export const perspectiveOf = (workspace) => PERSPECTIVES[workspace?.dimension] ?? PERSPECTIVES.cost;
export function normalizePair(properties, pair = []) {
  const ids = properties.map((p) => p.id);
  return [...new Set([...pair.filter((id) => ids.includes(id)), ...ids])].slice(0, 2);
}
export function visibleCandidates(properties, workspace) {
  if (!workspace?.mobile) return properties;
  const pair = normalizePair(properties, workspace.pair);
  return pair.map((id) => properties.find((p) => p.id === id));
}
export function replacePair(properties, pair, slot, id) {
  const next = normalizePair(properties, pair);
  if (!properties.some((p) => p.id === id) || ![0, 1].includes(slot)) return next;
  const previous = next[slot];
  const other = 1 - slot;
  if (next[other] === id) next[other] = previous;
  next[slot] = id;
  return normalizePair(properties, next);
}
export function contextualQuestion(questions, priorities, responses, workspace) {
  const key = perspectiveOf(workspace).priority;
  const eligible = questions.filter((q) => priorities[q.key].level === 'later' && responses[q.key] !== q.fingerprint);
  return (key ? eligible.find((q) => q.key === key) : workspace?.dimension === 'living' ? null : eligible[0]) ?? null;
}
