// Comparison vocabulary (≈ models.py): the rows of the table, how printed line names are grouped,
// the equipment words looked for on each sheet, and the pre-contract check labels. Everything here
// describes what a sheet prints; nothing orders or scores the sheets.

/** Rows of the table, top to bottom. Sheets are the columns, in the order they were added. */
export const ROWS = [
  { key: "monthly", label: "月額", sub: "賃料＋管理費" },
  { key: "initial", label: "初期費用の目安", sub: "仲介1ヶ月・前家賃込み" },
  { key: "layout", label: "間取り・面積", sub: "" },
  { key: "station", label: "駅・徒歩", sub: "" },
  { key: "age", label: "築年", sub: "" },
  { key: "equipment", label: "図面に出てくる設備", sub: "記載がない＝ないとは限りません" },
  { key: "checks", label: "契約前の確認", sub: "" },
];

/**
 * What a sheet warning means for the values it names (server/apps/listing/prompts.py: a building
 * sheet listing several unit types is read at its first, smallest type).
 */
export const WARNING_NOTES = { multiple_candidates: "最小タイプの値", inconsistent_values: "図面内で不一致", illegible: "判読困難" };

/**
 * Spellings of the same railway line on real sheets, grouped under the name the listing portals use.
 * A spelling not listed here is kept verbatim as its own line.
 */
export const LINE_ALIASES = {
  京王井の頭線: ["京王井の頭線", "京王電鉄井の頭線", "井の頭線"],
  小田急線: ["小田急線", "小田急電鉄小田原線", "小田急小田原線", "小田急"],
  京王線: ["京王線"],
  東京メトロ千代田線: ["東京メトロ千代田線", "東京地下鉄千代田線", "千代田線"],
};

/**
 * Equipment looked for in the sheet text, in the order of the portals' こだわり条件. `term` is the
 * glossary entry the chip opens; `aliases` are copied from that entry, except TVモニター付きインターホン
 * (tightened so 「モニター付きオートロック」 is not read as an intercom) and エアコン (without 残置物).
 */
export const EQUIPMENT_ASPECTS = [
  { key: "bathToilet", label: "バス・トイレ別", term: "バス・トイレ別", aliases: ["バス・トイレ別", "バストイレ別", "バス/トイレ別", "ス/トイレ別"] },
  { key: "vanity", label: "独立洗面台", term: "独立洗面台", aliases: ["独立洗面台", "独立洗面", "シャンプードレッサー"] },
  { key: "reheat", label: "追い焚き", term: "追い焚き", aliases: ["追い焚き", "追焚", "追いだき", "追い炊き", "追炊"] },
  { key: "bathDryer", label: "浴室乾燥機", term: "浴室乾燥機", aliases: ["浴室乾燥", "浴室暖房乾燥"] },
  { key: "washlet", label: "温水洗浄便座", term: "温水洗浄便座", aliases: ["温水洗浄便座"] },
  { key: "laundry", label: "室内洗濯機置場", term: "室内洗濯機置場", aliases: ["室内洗濯機置", "洗濯機置場", "洗濯機置き場"] },
  { key: "systemKitchen", label: "システムキッチン", term: "システムキッチン", aliases: ["システムキッチン"] },
  { key: "autolock", label: "オートロック", term: "オートロック", aliases: ["オートロック"] },
  { key: "monitorIntercom", label: "TVモニター付きインターホン", term: "TVモニター付きインターホン", aliases: ["モニター付きインターホン", "モニター付インターホン", "TVモニター"] },
  { key: "deliveryBox", label: "宅配ボックス", term: "宅配ボックス", aliases: ["宅配ボックス", "宅配BOX"] },
  { key: "freeInternet", label: "インターネット無料", term: "インターネット無料", aliases: ["インターネット無料", "ネット無料"] },
  { key: "aircon", label: "エアコン", term: "エアコン・残置物", aliases: ["エアコン"] },
];

// Pre-contract checks found on the sheet (server/apps/listing/checks.py), grouped for reading.
export const CHECK_CATEGORIES = { cost: "費用", exit: "解約・更新", viewing: "内見・現況", eligibility: "入居条件", building: "建物・部屋" };
/**
 * Categories a 契約前の確認 cell names first, one check each: leaving early, viewing, the building,
 * who may move in, then money. The cell reads the sheet's own checks only, so adding another sheet
 * never changes it.
 */
export const CHECK_SUMMARY_ORDER = ["exit", "viewing", "building", "eligibility", "cost"];
export const CHECK_TERMS = {
  short_term_penalty: "短期解約違約金",
  notice_period: "解約予告",
  renewal_fee: "更新料",
  fixed_term: "普通借家・定期借家",
  free_rent: "フリーレント",
  deposit_amortized: "敷金償却・敷引き",
  guarantor_fees: "保証会社（家賃保証会社）",
  required_services: "24時間サポート",
  insurance: "火災保険",
  key_exchange: "鍵交換費用",
  cleaning: "クリーニング費用",
  before_viewing: "先行契約・内見前申込",
  as_is: "現況優先",
  extra_terms: "重要事項説明",
  no_elevator: "エレベーター",
  ground_floor: "所在階・階建",
};
// What no sheet prints, so it is worth asking about for every sheet.
export const GENERAL_CHECKS = [
  ["仲介手数料", "図面には載りません。借主の負担は、承諾がなければ家賃0.5ヶ月分＋税までです。"],
  ["前家賃・日割り家賃", "契約時に、入居月の日割り分と翌月分をまとめて払うのが一般的です。家賃が発生する日を確認しましょう。"],
  ["原状回復", "退去時に何を負担するか、特約を重要事項説明で確認しましょう。普通に暮らしてできた汚れや年月による傷みは、原則として貸主の負担です。"],
  ["徒歩○分", "内見では、日当たり・騒音・携帯電波・家具の搬入経路・洗濯機置場と冷蔵庫置場の寸法も確認しましょう。駅までは実際に歩いてみるのが確実です。"],
];
