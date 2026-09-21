// What each part of the product does today (≈ models.py). One registry drives every status chip,
// the header summary, and the capability table, so marking a feature live is a one-line change here.

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
 * @param {{ extraction: keyof EXTRACTION_STATES, model?: string, mapsLive: boolean }} status — what is configured and reachable
 * @returns {{ key: string, name: string, kind: "live"|"demo"|"planned", now: string, next: string }[]}
 */
export function capabilityList({ extraction, model, mapsLive }) {
  const reading = EXTRACTION_STATES[extraction] ?? EXTRACTION_STATES.none;
  return [
    {
      key: "ranking",
      name: "条件による並べ替え",
      kind: "live",
      now: "選んだ条件との一致度や、月額・初期費用・駅徒歩などで並べ替えます。一致度は目安で、おすすめの順ではありません。",
      next: "",
    },
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
      now: "信頼度の低い項目は、人が確認するまで候補に追加できません。",
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
      name: "初期費用の試算",
      kind: "live",
      now: "図面の費用項目に、図面に載らない仲介手数料・日割り家賃・前家賃を加えて目安を計算します。見積書の代わりにはなりません。",
      next: "",
    },
    { key: "glossary", name: "用語辞典", kind: "live", now: "間取り・構造・設備・契約の言葉を説明し、各図面に出てくる言葉から引けます。", next: "" },
    {
      key: "inventory",
      name: "物件データ",
      kind: "demo",
      now: "実際の募集図面3件を記録時点の値で表示しています。募集状況は確認していません。",
      next: "利用許諾のある物件データ提供元と接続",
    },
    { key: "rentHistory", name: "賃料の推移", kind: "planned", now: "表示していません。", next: "掲載・成約賃料の提供元と接続" },
    { key: "reviews", name: "居住者の口コミ", kind: "planned", now: "表示していません。口コミサイトの内容は転載していません。", next: "再利用が許諾された提供元（Places API など）と接続" },
    { key: "chat", name: "質問への回答", kind: "demo", now: "決まった質問に定型で答えます。LLM は使っていません。", next: "根拠データを引用する Gemini を接続" },
    { key: "routes", name: "通勤時間・経路", kind: "planned", now: "比較に含めていません。", next: "サーバー経由で Routes API を接続" },
    { key: "places", name: "周辺の環境", kind: "planned", now: "比較に含めていません。", next: "選んだカテゴリだけ Places API で取得" },
    { key: "geocoding", name: "住所の位置", kind: "planned", now: "地図上の候補は最寄駅の位置に置いています。", next: "Geocoding API で住所を座標に変換" },
    {
      key: "maps",
      name: "地図",
      kind: mapsLive ? "live" : "planned",
      now: mapsLive ? "Google Maps を表示しています。" : "駅の位置関係を示す概略図を表示しています。",
      next: mapsLive ? "" : "利用制限付きのキーを web/env.js に設定",
    },
    { key: "persistence", name: "保存・共有", kind: "planned", now: "再読み込みすると、追加した候補は消えます。", next: "物件スキーマを定義し、保存先を用意" },
  ];
}

export function statusCounts(capabilities) {
  return Object.fromEntries(Object.keys(STATUS_KINDS).map((kind) => [kind, capabilities.filter((item) => item.kind === kind).length]));
}
