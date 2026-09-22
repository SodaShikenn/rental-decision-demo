// What each part of the product does today (≈ models.py). One registry drives every status chip and
// the list in この画面について, so marking a feature live is a one-line change here.

export const STATUS_KINDS = {
  live: { label: "稼働中" },
  demo: { label: "デモ" },
  planned: { label: "未接続" },
};

// What the extraction server reported about itself (see fetchServerState in services.js).
const EXTRACTION_STATES = {
  none: { kind: "demo", now: "解析サーバーが未設定のため、サンプル図面を事前に読み取った記録（OCR は実測）を表示します。", next: "server/ を起動し、web/env.js に URL を設定" },
  checking: { kind: "demo", now: "解析サーバーの状態を確認しています。", next: "応答がない場合は解析サーバーの起動を確認" },
  live: { kind: "live", now: "解析サーバーの OCR（Docling）が文字を読み取り、Gemini が項目に対応付けます。", next: "" },
  mock: { kind: "demo", now: "解析サーバーはモックモードです。テスト用の固定値を返し、画像の内容は読み取りません。", next: "server/.env で EXTRACTION_MODE=live と GEMINI_API_KEY を設定" },
  unconfigured: { kind: "planned", now: "解析サーバーに Gemini API キーが設定されていないため、読み取りできません。", next: "server/.env に GEMINI_API_KEY を設定" },
  disabled: { kind: "planned", now: "解析サーバーで読み取りが停止されています。", next: "EXTRACTION_ENABLED=true に戻す" },
  unreachable: { kind: "planned", now: "解析サーバーに接続できません。", next: "解析サーバーの起動と web/env.js の URL を確認" },
};

export const EXTRACTION_STATE_KEYS = Object.keys(EXTRACTION_STATES);

/**
 * @param {{ extraction: keyof EXTRACTION_STATES, model?: string }} status — what the extraction server reported
 * @returns {{ key: string, name: string, kind: "live"|"demo"|"planned", now: string, next: string }[]}
 */
export function capabilityList({ extraction, model, maps = false, research = false }) {
  const reading = EXTRACTION_STATES[extraction] ?? EXTRACTION_STATES.none;
  return [
    {
      key: "extraction",
      name: "募集図面の読み取り",
      kind: reading.kind,
      now: extraction === "live" && model ? reading.now.replace("Gemini", `Gemini（${model}）`) : reading.now,
      next: reading.next,
    },
    {
      key: "review",
      name: "読み取り結果の照合・出典記録",
      kind: "live",
      now: "未確認の項目は未取得のまま候補を追加できます。後から編集でき、必要なときに元の図面も確認できます。",
      next: "",
    },
    {
      key: "checks",
      name: "契約前の確認事項",
      kind: "live",
      now: "図面の文字から、違約金・更新料・償却・必須の付帯費用・先行契約などを決まった言葉で探し、該当箇所を示します。書き方によっては見落とします。",
      next: "",
    },
    {
      key: "costs",
      name: "初期費用の目安",
      kind: "live",
      now: "図面の費用項目に、図面に載らない仲介手数料・日割り家賃・前家賃を加えて目安を計算します。見積書の代わりにはなりません。",
      next: "",
    },
    { key: "glossary", name: "用語辞典", kind: "live", now: "間取り・構造・設備・契約の言葉を説明し、各図面に出てくる言葉から引けます。", next: "" },
    {
      key: "inventory",
      name: "物件データ",
      kind: "demo",
      now: "実際の募集図面3件とサンプル図面1件を記録時点の値で表示しています。",
      next: "解析サーバーを接続すると、手元の図面を読み取って加えられます",
    },
    {
      key: "needs",
      name: "条件メモ",
      kind: "live",
      now: "候補の特徴から質問し、回答で確認した条件、選んだ設備、保留したことをメモにします。数値条件との比較はルールベースで、LLM は使っていません。別のAI相談からも、回答に基づく希望を確認してメモに反映できます。",
      next: "",
    },
    { key: "rentHistory", name: "賃料の推移", kind: "planned", now: "表示していません。", next: "掲載・成約賃料の提供元と接続" },
    { key: "reviews", name: "ネットの口コミ・内見記録", kind: research ? "live" : "planned", now: research ? "候補の公開口コミを自動検索し、建物名・住所を照合した出典付き要約を表示します。別の部屋の声と自分の内見記録は分けて扱います。" : "Geminiを接続すると公開口コミを自動検索できます。自分の内見記録は接続なしでも残せます。", next: research ? "" : "Gemini とオンライン調査を設定" },
    { key: "routes", name: "駅・周辺施設への徒歩経路", kind: maps ? "live" : "planned", now: maps ? "候補ごとに Google Maps で取得し、掲載の徒歩時間と照合します。同じ目的地・日時での通勤比較も可能ですが、公共交通の経路が返らない地域・条件があります。" : "地図の確認サーバーに接続すると利用できます。", next: maps ? "" : "地図の確認サーバーを接続" },
    { key: "places", name: "周辺の駅・買い物", kind: maps ? "live" : "planned", now: maps ? "駅・スーパー・コンビニに加え、公園・ジム・カフェと徒歩経路を取得し、利用したい場所から希望を確認します。" : "地図の確認サーバーに接続すると利用できます。", next: maps ? "" : "地図の確認サーバーを接続" },
    { key: "persistence", name: "保存・共有", kind: "live", now: "候補・画像・希望・メモをこのブラウザに自動保存します。保存状態は画面上部で確認できます。地図情報は再取得が必要です。HTML出力と、バックエンド接続時の期限付き共有・削除に対応します。公開デモの共有には公開APIが必要です。", next: "" },
  ];
}

export function statusCounts(capabilities) {
  return Object.fromEntries(Object.keys(STATUS_KINDS).map((kind) => [kind, capabilities.filter((item) => item.kind === kind).length]));
}
