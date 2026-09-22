// One navigation registry. Views own their DOM; switching routes never remounts a feature.
export const VIEWS = [
  { key: "compare", label: "候補比較", group: "比べる" },
  {
    key: "commute",
    label: "通勤",
    group: "比べる",
    title: "通勤を比較",
    description: "候補から目的地までを、同じ日時・移動方法で比べます。",
    steps: [
      "勤務先や駅を探して、地点を確認",
      "到着・出発時刻を選んで経路を取得",
      "時間・乗換・徒歩のどれを大切にするか確認",
    ],
    next: "scenarios",
    nextLabel: "出勤頻度を変えて試算する",
  },
  {
    key: "surroundings",
    label: "駅・買い物",
    group: "比べる",
    title: "駅・買い物への徒歩経路",
    description: "図面の徒歩時間を残して、地図で取得した経路と照合します。",
    steps: [
      "調べたい候補を選ぶ",
      "掲載の時間と、取得した徒歩経路を見比べる",
      "入口や営業時間など、現地で確かめたい点を整理",
    ],
    next: "leisure",
    nextLabel: "周辺の余暇施設も見る",
  },
  {
    key: "leisure",
    label: "余暇",
    group: "比べる",
    title: "周辺の余暇施設",
    description:
      "公園・ジム・カフェを調べてから、使いたい場所を一緒に考えます。",
    steps: [
      "候補周辺の施設と徒歩経路を取得",
      "使いたい施設と頻度を選ぶ",
      "大切にしたいことを確認してメモへ",
    ],
    next: "scenarios",
    nextLabel: "通勤や費用との組み合わせを見る",
  },
  {
    key: "reviews",
    label: "口コミ分析",
    group: "確かめる",
    title: "口コミ分析",
    description:
      "部屋から建物、近隣へ。公開の口コミを自動で調べ、候補を理解する手がかりにします。",
    steps: [
      "候補を選ぶと、公開の口コミを自動検索",
      "部屋 → 同じ建物 → 近隣の順で、見つかった範囲を表示",
      "気になる点を選ぶと、確認事項へ自動で整理",
    ],
    next: "needs",
    nextLabel: "内見に持っていくメモを見る",
  },
  {
    key: "scenarios",
    label: "暮らしの試算",
    group: "確かめる",
    title: "暮らしの試算",
    description:
      "月額・取得した通勤経路・確認した余暇の希望を、同じ条件で並べます。",
    steps: [
      "通勤・余暇タブで必要な情報を取得",
      "週に何日通うかを変えて比較",
      "納得した頻度だけ、希望として確認",
    ],
    next: "needs",
    nextLabel: "希望と確認事項をまとめる",
  },
  { key: "needs", label: "条件メモ", group: "持ち出す" },
  {
    key: "sharing",
    label: "共有・出力",
    group: "持ち出す",
    title: "共有・出力",
    description:
      "共有する内容を確認して、ファイル保存や期限付きリンクを作成します。",
    steps: [
      "含めたい個人情報を選ぶ",
      "プレビューで実際の共有内容を確認",
      "HTML保存、または共有リンクを作成",
    ],
    next: "needs",
    nextLabel: "条件メモをコピーする",
  },
];

const keys = new Set(VIEWS.map((view) => view.key));
const aliases = {
  commuteSection: "commute",
  leisureSection: "leisure",
  reviewsSection: "reviews",
  scenarioSection: "scenarios",
  sharingSection: "sharing",
};
export function resolveView(target) {
  return keys.has(target)
    ? target
    : Object.hasOwn(aliases, target)
      ? aliases[target]
      : "compare";
}
export function isWorkspaceTarget(target) {
  return (
    keys.has(target) ||
    Object.hasOwn(aliases, target) ||
    ["compareTable", "discovery", "fitSummary", "preferences"].includes(target)
  );
}
