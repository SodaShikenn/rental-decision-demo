/** Keyword groups are navigation aids, not sentiment analysis or factual conclusions. */
const TOPICS = [
  {
    key: "sound",
    label: "音に関する言及",
    words: /騒音|静か|うるさい|音漏れ|防音|noise|quiet/i,
    question: "時間帯を変えて、室内・共用部・周辺の音を確認する。",
  },
  {
    key: "management",
    label: "管理に関する言及",
    words: /管理|清掃|ゴミ|修理|management|clean/i,
    question: "共用部の清掃と、故障・問い合わせ時の対応を確認する。",
  },
  {
    key: "comfort",
    label: "室内環境に関する言及",
    words: /日当たり|湿気|カビ|暑い|寒い|mold|sunlight/i,
    question: "日当たり・換気・湿気は、希望する部屋と時間帯で確認する。",
  },
];
export function reviewTopics(reviews) {
  return TOPICS.map((topic) => ({
    ...topic,
    indices: reviews.flatMap((r, i) => (topic.words.test(r.text) ? [i] : [])),
  })).filter((t) => t.indices.length);
}
export function observation(candidateId, text, date) {
  if (
    !candidateId ||
    !text.trim() ||
    text.trim().length > 1000 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  )
    throw new Error("候補・日付・確認した内容を入力してください。");
  return {
    id: crypto.randomUUID(),
    candidateId,
    text: text.trim(),
    date,
    kind: "own_viewing",
  };
}
