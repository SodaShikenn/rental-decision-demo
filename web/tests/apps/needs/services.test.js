import { test } from "node:test";
import assert from "node:assert/strict";
import { SHEETS } from "../../../data/sheets.js";
import { candidateFromSheet } from "../../../apps/intake/services.js";
import { SEED_SHEET_IDS } from "../../../apps/intake/models.js";
import { ASK_HEADING, LADDERS, MAJORITY } from "../../../apps/needs/models.js";
import { askLines, aspectCounts, buildMemo, chipStates, deriveQuestions, memoText, searchLines } from "../../../apps/needs/services.js";

// The memo is dated, and building ages depend on the year: pin the day the sheets were recorded.
const TODAY = new Date(2026, 8, 21);
const four = SHEETS.map(candidateFromSheet); // モノハウス, ルーブル, Bresport, GRAN PASEO
const byId = Object.fromEntries(four.map((candidate) => [candidate.id, candidate]));
const seeds = SEED_SHEET_IDS.map((id) => byId[id]);
const onPage = [...seeds, byId.monohouse]; // the page: the seeds, then the sample added by the person
const memoOf = (properties, picks = {}, answers = {}) => memoText(buildMemo(properties, picks, answers, TODAY));
const searchLine = (memo, label) => memo.split("\n").find((line) => line.startsWith(`・${label}：`));

/** A minimal confirmed candidate for rule tests. */
const candidate = (overrides = {}) => ({
  id: "x",
  name: "テスト物件",
  district: "世田谷区",
  address: null,
  station: "小田急線「下北沢」駅 徒歩2分",
  layout: "1K",
  areaSqm: 20.25,
  rent: 100000,
  managementFee: 0,
  constructionYear: 2020,
  costs: [],
  checks: [],
  sheet: null,
  sheetWarnings: [],
  ...overrides,
});
const check = (code, sourceText = code) => ({ code, category: "cost", title: code, detail: "", evidence: null, sourceText });

const FOOTER_TAIL = "通勤時間・周辺環境・賃料の推移・口コミは図面にないため含みません。";

test("the memo for the four recorded sheets (golden)", () => {
  assert.equal(memoOf(four), [
    "■ 探す条件（募集図面4件から・2026/9/21）",
    "・エリア：世田谷区（3件）・渋谷区（1件）",
    "・沿線：京王井の頭線（4件中4件）・小田急線（3件）・京王線（2件）／ほか1件のみ：東京メトロ千代田線",
    "・駅：下北沢（2件：徒歩2・8分）・代々木八幡（徒歩10分）・東松原（徒歩5分）",
    "・駅徒歩：10分以内（図面：2・10・8・5分）",
    "・賃料：13万円以下、管理費・共益費込み（図面：9.5万〜13万円の3件。GRAN PASEO明大前Ⅳは賃料の記載なし）",
    "・間取り：1K（4件中4件。Bresport（ブレスポート）は1K+WIC）",
    "・専有面積：20㎡以上（図面：20.25〜28.8㎡。モノハウス 104号室は図面内で不一致、GRAN PASEO明大前Ⅳは最小タイプの値）",
    "・築年数：25年以内（図面：2001〜2026年）",
    "・こだわり条件：システムキッチン（4件中3件に記載）・オートロック（3件）・インターネット無料（3件）・礼金なし（3件）※モノハウス 104号室は敷金償却1ヶ月（戻らない点は礼金と同じ）",
    "",
    "■ 不動産会社に聞くこと",
    "・仲介手数料の額と、初期費用の見積書（図面に載らない仲介手数料・前家賃を含めて）",
    "・短期解約違約金の期間と金額（4件とも）",
    "・解約予告は何ヶ月前か（ルーブル渋谷松濤 408号室・Bresport（ブレスポート）・GRAN PASEO明大前Ⅳ）",
    "・内見できる時期と、内見後に断れるか（モノハウス 104号室・ルーブル渋谷松濤 408号室・Bresport（ブレスポート））",
    "・保証会社の初回・毎月・毎年の保証料（4件とも）",
    "・必須の付帯サービス・火災保険は外せるか、自分で選べるか（4件とも）",
    "・更新料と更新事務手数料の額（4件とも）",
    "・モノハウス 104号室：専有面積は21.37㎡か22.37㎡か（図面内で不一致）／敷金・保証金の償却分（戻らない額）／1階：防犯・日当たり／ペット・楽器・在宅の仕事の制限",
    "・ルーブル渋谷松濤 408号室：図面にない補足事項の全文／クリーニング費用 70,000円の内訳と時期／鍵交換費用 33,000円／手数料（契約事務・引落など） 330円",
    "・Bresport（ブレスポート）：敷金・保証金の償却分（戻らない額）／掲載写真はこの部屋のものか／手数料（契約事務・引落など） 25,000円（税別）",
    "・GRAN PASEO明大前Ⅳ：希望タイプの賃料（図面に記載なし）／検討するタイプの間取り・面積・共益費／フリーレントの適用範囲と短期解約違約金の関係／エレベーターなし：階と搬入",
    "",
    `値は募集図面の記載（OCRで読み取り、原本と照合済み）。募集状況は未確認。${FOOTER_TAIL}4件に共通する点を並べた推測なので、違うものは消してください。`,
  ].join("\n"));
});

test("the memo on the first screen: the three seeded sheets (golden)", () => {
  assert.equal(memoOf(seeds), [
    "■ 探す条件（募集図面3件から・2026/9/21）",
    "・エリア：世田谷区（2件）・渋谷区（1件）",
    "・沿線：京王井の頭線（3件中3件）・小田急線（2件）・京王線（2件）／ほか1件のみ：東京メトロ千代田線",
    "・駅：代々木八幡（徒歩10分）・下北沢（徒歩8分）・東松原（徒歩5分）",
    "・駅徒歩：10分以内（図面：10・8・5分）",
    "・賃料：13万円以下、管理費・共益費込み（図面：11万〜13万円の2件。GRAN PASEO明大前Ⅳは賃料の記載なし）",
    "・間取り：1K（3件中3件。Bresport（ブレスポート）は1K+WIC）",
    "・専有面積：20㎡以上（図面：20.25〜28.8㎡。GRAN PASEO明大前Ⅳは最小タイプの値）",
    "・築年数：25年以内（図面：2001〜2026年）",
    "・こだわり条件：（比べた3件に共通して記載のある設備・条件は見つかりませんでした。上のボタンから選べます）",
    "",
    "■ 不動産会社に聞くこと",
    "・仲介手数料の額と、初期費用の見積書（図面に載らない仲介手数料・前家賃を含めて）",
    "・短期解約違約金の期間と金額（3件とも）",
    "・解約予告は何ヶ月前か（3件とも）",
    "・内見できる時期と、内見後に断れるか（ルーブル渋谷松濤 408号室・Bresport（ブレスポート））",
    "・保証会社の初回・毎月・毎年の保証料（3件とも）",
    "・必須の付帯サービス・火災保険は外せるか、自分で選べるか（3件とも）",
    "・更新料と更新事務手数料の額（3件とも）",
    "・ルーブル渋谷松濤 408号室：図面にない補足事項の全文／クリーニング費用 70,000円の内訳と時期／鍵交換費用 33,000円／手数料（契約事務・引落など） 330円",
    "・Bresport（ブレスポート）：敷金・保証金の償却分（戻らない額）／掲載写真はこの部屋のものか／手数料（契約事務・引落など） 25,000円（税別）",
    "・GRAN PASEO明大前Ⅳ：希望タイプの賃料（図面に記載なし）／検討するタイプの間取り・面積・共益費／フリーレントの適用範囲と短期解約違約金の関係／エレベーターなし：階と搬入",
    "",
    `値は募集図面の記載（OCRで読み取り、原本と照合済み）。募集状況は未確認。${FOOTER_TAIL}3件に共通する点を並べた推測なので、違うものは消してください。`,
  ].join("\n"));
});

test("on the page the sample is added last, so printed values follow that order", () => {
  const memo = memoOf(onPage);
  assert.equal(searchLine(memo, "駅"), "・駅：下北沢（2件：徒歩8・2分）・代々木八幡（徒歩10分）・東松原（徒歩5分）");
  assert.equal(searchLine(memo, "駅徒歩"), "・駅徒歩：10分以内（図面：10・8・5・2分）");
  assert.equal(searchLine(memo, "専有面積"), "・専有面積：20㎡以上（図面：20.25〜28.8㎡。GRAN PASEO明大前Ⅳは最小タイプの値、モノハウス 104号室は図面内で不一致）");
  const asks = memo.split("\n").filter((line) => /^・[^：]+：/.test(line) && memo.indexOf(line) > memo.indexOf(ASK_HEADING));
  assert.deepEqual(asks.map((line) => line.split("：")[0]), ["・ルーブル渋谷松濤 408号室", "・Bresport（ブレスポート）", "・GRAN PASEO明大前Ⅳ", "・モノハウス 104号室"]);
  // Same conditions, same counts: only the order of printed values differs.
  const sorted = (text) => text.split("\n").map((line) => [...line].sort().join("")).sort();
  assert.deepEqual(sorted(memo), sorted(memoOf(four)));
});

test("aspects: counts per sheet, chips by count, and what starts pressed", () => {
  const counts = Object.fromEntries(aspectCounts(four).map((aspect) => [aspect.label, aspect.count]));
  assert.deepEqual(counts, {
    バス・トイレ別: 2,
    独立洗面台: 2,
    追い焚き: 1,
    浴室乾燥機: 1,
    温水洗浄便座: 2,
    室内洗濯機置場: 2,
    システムキッチン: 3,
    オートロック: 3,
    TVモニター付きインターホン: 2,
    宅配ボックス: 0,
    インターネット無料: 3,
    エアコン: 2,
    礼金なし: 3,
    敷金なし: 2,
  });
  const sheetsOf = (label) => aspectCounts(four).find((aspect) => aspect.label === label).sheets.map((sheet) => sheet.id);
  assert.deepEqual(sheetsOf("礼金なし"), ["monohouse", "bresport", "granpaseo-4"]);
  assert.deepEqual(sheetsOf("敷金なし"), ["louvre-shoto", "granpaseo-4"]);

  assert.deepEqual([MAJORITY(2), MAJORITY(3), MAJORITY(4), MAJORITY(6)], [3, 3, 3, 4]);
  const seedChips = chipStates(aspectCounts(seeds), 3);
  assert.deepEqual(seedChips.map((chip) => `${chip.label} ${chip.count}`), [
    "独立洗面台 2", "システムキッチン 2", "オートロック 2", "インターネット無料 2", "エアコン 2", "礼金なし 2", "敷金なし 2",
    "バス・トイレ別 1", "追い焚き 1", "浴室乾燥機 1", "温水洗浄便座 1", "室内洗濯機置場 1", "TVモニター付きインターホン 1",
  ]);
  assert.ok(seedChips.every((chip) => !chip.pressed)); // 2 of 3 is a coincidence, not a condition
  const chips = chipStates(aspectCounts(four), 4);
  assert.ok(!chips.some((chip) => chip.label === "宅配ボックス")); // no chip for what no sheet prints
  assert.deepEqual(chips.filter((chip) => chip.pressed).map((chip) => chip.label), ["システムキッチン", "オートロック", "インターネット無料", "礼金なし"]);
  // A person's choice wins both ways.
  const picked = chipStates(aspectCounts(four), 4, { systemKitchen: false, bathToilet: true, autolock: null });
  assert.deepEqual(picked.filter((chip) => chip.pressed).map((chip) => chip.label), ["オートロック", "インターネット無料", "礼金なし", "バス・トイレ別"]);
  assert.deepEqual(chipStates(aspectCounts([byId.bresport]), 1), []);
});

test("pressing a chip adds it to the こだわり line with its count", () => {
  const line = searchLine(memoOf(four, { bathToilet: true }), "こだわり条件");
  assert.equal(line, "・こだわり条件：システムキッチン（4件中3件に記載）・オートロック（3件）・インターネット無料（3件）・礼金なし（3件）・バス・トイレ別（2件に記載）※モノハウス 104号室は敷金償却1ヶ月（戻らない点は礼金と同じ）");
  assert.equal(searchLine(memoOf(seeds, { vanity: true }), "こだわり条件"), "・こだわり条件：独立洗面台（3件中2件に記載）");
  const released = { systemKitchen: false, autolock: false, freeInternet: false, noKeyMoney: false };
  assert.equal(searchLine(memoOf(four, released), "こだわり条件"), "・こだわり条件：（上のボタンから選べます）");
});

test("ladders round toward every sheet compared, with the printed values beside", () => {
  const line = (label, overrides) => searchLine(memoText(buildMemo([candidate(overrides)], {}, {}, TODAY)), label);
  const walk = (minutes) => line("駅徒歩", { station: `小田急線「下北沢」駅 徒歩${minutes}分` });
  assert.equal(walk(2), "・駅徒歩：3分以内（図面：2分）");
  assert.equal(walk(8), "・駅徒歩：10分以内（図面：8分）");
  assert.equal(walk(10), "・駅徒歩：10分以内（図面：10分）");
  assert.equal(walk(11), "・駅徒歩：15分以内（図面：11分）");
  assert.equal(walk(21), "・駅徒歩：こだわらない（図面：21分）");
  assert.equal(line("専有面積", { areaSqm: 20.25 }), "・専有面積：20㎡以上（図面：20.25㎡）");
  assert.equal(line("専有面積", { areaSqm: 28.8 }), "・専有面積：25㎡以上（図面：28.8㎡）");
  const age = (year) => line("築年数", { constructionYear: year });
  assert.equal(age(2001), "・築年数：25年以内（図面：2001年）");
  assert.equal(age(2000), "・築年数：30年以内（図面：2000年）");
  assert.equal(age(2026), "・築年数：新築（図面：2026年）");
  assert.equal(age(1995), "・築年数：こだわらない（図面：1995年）");
  assert.equal(line("賃料", { rent: 130000 }), "・賃料：13万円以下、管理費・共益費込み（図面：13万円）");
  assert.equal(line("賃料", { rent: 125000, managementFee: 6000 }), "・賃料：13.5万円以下、管理費・共益費込み（図面：13.1万円）");
  assert.deepEqual(LADDERS.walk, [1, 3, 5, 7, 10, 15, 20]);
  // Every rounded value sits next to the values it was rounded from.
  for (const text of [memoOf(four), memoOf(seeds)]) {
    for (const label of ["駅徒歩", "賃料", "専有面積", "築年数"]) assert.match(searchLine(text, label), /（図面：/);
  }
});

test("questions come only from clauses printed on the sheets on screen", () => {
  const questions = deriveQuestions(four);
  assert.deepEqual(questions.map((question) => question.key), ["moveSoon", "viewFirst", "floor"]);
  const [moveSoon, viewFirst, floor] = questions;
  assert.deepEqual([moveSoon.count, moveSoon.notice], [4, 3]);
  assert.equal(moveSoon.text, "4件すべてに短期解約違約金の記載があります（解約予告の期間の記載は3件）。2年以内に引っ越す可能性はありますか？");
  assert.deepEqual(moveSoon.options.map((option) => option.label), ["ある", "ない", "あとで"]);
  assert.equal(moveSoon.initial, "later");
  assert.equal(viewFirst.count, 3);
  assert.deepEqual(viewFirst.sheets, ["monohouse", "louvre-shoto", "bresport"]);
  assert.deepEqual([floor.ground, floor.noElevator], [["monohouse"], ["granpaseo-4"]]);
  assert.equal(floor.text, "モノハウス 104号室は1階、GRAN PASEO明大前Ⅳはエレベーターなしです。");
  assert.equal(floor.type, "checkbox");
  assert.deepEqual(deriveQuestions([candidate(), candidate({ id: "y", checks: [check("renewal_fee")] })]), []);
  assert.deepEqual(deriveQuestions([candidate({ checks: [check("photos_differ")] })]).map((question) => question.key), ["viewFirst"]);
});

test("answers add search lines and bring related asks forward; ない and あとで change nothing", () => {
  const plain = memoOf(four);
  assert.equal(memoOf(four, {}, { moveSoon: "no", viewFirst: "later", floor: [] }), plain);
  const moved = memoOf(four, {}, { moveSoon: "yes" }).split("\n");
  assert.equal(moved.length, plain.split("\n").length + 1);
  const age = moved.findIndex((line) => line.startsWith("・築年数："));
  assert.equal(moved[age + 1], "・契約の縛り：短期解約違約金・長い解約予告の物件は避けたい（比べた4件は4件に違約金の記載あり）");
  const shared = (lines) => lines.slice(lines.indexOf(ASK_HEADING) + 2, lines.indexOf(ASK_HEADING) + 8).map((line) => line.replace(/（.*$/, ""));
  assert.equal(shared(moved)[0], "・短期解約違約金の期間と金額");
  const viewing = memoOf(four, {}, { viewFirst: "yes" }).split("\n");
  assert.ok(viewing.includes("・内見してから申し込みたい（内見の時期・先行契約の記載が3件）"));
  assert.deepEqual(shared(viewing).slice(0, 2), ["・内見できる時期と、内見後に断れるか", "・短期解約違約金の期間と金額"]);
  const both = memoOf(four, {}, { viewFirst: "yes", moveSoon: "yes" }).split("\n");
  assert.deepEqual(shared(both).slice(0, 3), ["・短期解約違約金の期間と金額", "・解約予告は何ヶ月前か", "・内見できる時期と、内見後に断れるか"]);
  const floors = memoOf(four, {}, { floor: ["upper", "elevator"] }).split("\n");
  assert.deepEqual(floors.slice(age + 1, age + 3), ["・階：2階以上", "・エレベーターあり"]);
  // An answer to a question that is no longer asked is ignored.
  assert.equal(memoOf([byId["louvre-shoto"], byId.bresport], {}, { floor: ["upper"] }), memoOf([byId["louvre-shoto"], byId.bresport]));
});

test("ask lines: shared when on more than half, capped, then each sheet's own", () => {
  const asks = askLines(seeds);
  assert.equal(asks[0], "・仲介手数料の額と、初期費用の見積書（図面に載らない仲介手数料・前家賃を含めて）");
  // クリーニング and 手数料 are on 2 of 3 sheets too, but the six shared lines come first in template order…
  const sharedLines = asks.slice(1, 7);
  assert.ok(sharedLines.every((line) => /（(3件とも|.+・.+)）$/.test(line)));
  assert.ok(!asks.some((line) => line.startsWith("・クリーニング") || line.startsWith("・手数料")));
  // …so they fall back to the sheets' own lines, with the printed amount.
  assert.match(asks.find((line) => line.startsWith("・ルーブル")), /クリーニング費用 70,000円の内訳と時期/);
  // 2 of 4 is not shared.
  assert.ok(!askLines(four).some((line) => line.startsWith("・敷金・保証金の償却分")));
  const two = askLines([candidate({ checks: [check("short_term_penalty")] }), candidate({ id: "y", name: "別の物件", checks: [check("notice_period")] })]);
  assert.deepEqual(two, [
    "・仲介手数料の額と、初期費用の見積書（図面に載らない仲介手数料・前家賃を含めて）",
    "・テスト物件：短期解約違約金の期間と金額",
    "・別の物件：解約予告は何ヶ月前か",
  ]);
  // Per sheet: missing rent and warnings first, at most four items.
  const own = Object.fromEntries(askLines(four).filter((line) => /^・[^：]+：/.test(line)).map((line) => line.slice(1).split("：")));
  assert.ok(Object.values(own).every((items) => items.split("／").length <= 4));
  assert.match(own["GRAN PASEO明大前Ⅳ"], /^希望タイプの賃料（図面に記載なし）／検討するタイプの間取り・面積・共益費／/);
  assert.match(own["モノハウス 104号室"], /^専有面積は21\.37㎡か22\.37㎡か（図面内で不一致）／/);
  assert.ok(!own["モノハウス 104号室"].includes("鍵交換")); // the fifth item does not fit
  assert.match(own["Bresport（ブレスポート）"], /手数料（契約事務・引落など） 25,000円（税別）$/);
  // 現況優先 (as_is) and 外国籍 (foreign_terms) have no ask line; the general line is always there.
  for (const properties of [four, seeds, [byId.bresport]]) {
    const text = memoOf(properties);
    assert.ok(!/現況|外国籍/.test(text));
    assert.ok(text.includes("・仲介手数料の額と、初期費用の見積書"));
  }
});

test("every number in the memo is a printed value, an amount, a count, or a ladder step", () => {
  const variants = [
    [four, {}, {}],
    [seeds, {}, {}],
    [onPage, { bathToilet: true, vanity: true }, { moveSoon: "yes", viewFirst: "yes", floor: ["upper", "elevator"] }],
    [[byId["granpaseo-4"]], {}, {}],
  ];
  for (const [properties, picks, answers] of variants) {
    const text = memoOf(properties, picks, answers);
    const n = properties.length;
    const monthly = properties.filter((property) => property.rent != null).map((property) => property.rent + (property.managementFee ?? 0));
    const warningNumbers = properties.flatMap((property) => property.sheetWarnings.flatMap((warning) => (warning.message.match(/\d+(?:\.\d+)?/g) ?? []).map(Number)));
    const allowed = {
      万: (value) => monthly.includes(value * 10000) || (value * 10000) % LADDERS.rentStep === 0,
      分: (value) => properties.some((property) => property.station?.normalize("NFKC").includes(`${value}分`)) || LADDERS.walk.includes(value),
      "㎡": (value) => properties.some((property) => property.areaSqm === value) || value % LADDERS.areaStep === 0 || warningNumbers.includes(value),
      年: (value) => properties.some((property) => property.constructionYear === value) || LADDERS.age.includes(value),
      円: (value) => properties.some((property) => property.costs.some((cost) => cost.amount === value)),
      ヶ月: (value) => properties.some((property) => property.costs.some((cost) => cost.amount === value)),
      件: (value) => Number.isInteger(value) && value >= 1 && value <= n,
    };
    const tokens = [...text.matchAll(/(\d[\d,.]*(?:[・〜]\d[\d,.]*)*)(万|分|㎡|年|円|ヶ月|件)/g)];
    assert.ok(tokens.length >= (n > 1 ? 20 : 3), `${tokens.length} numbers`);
    for (const [, numbers, unit] of tokens) {
      for (const number of numbers.split(/[・〜]/)) {
        const value = Number(number.replace(/,/g, ""));
        assert.ok(allowed[unit](value), `${number}${unit} in ${n} sheets`);
      }
    }
    assert.ok(!text.includes("%"));
  }
});

test("wording: nothing is recommended or ranked, and absence is never written as ない", () => {
  const banned = /最有力|おすすめ|順位|ベスト|1位|%|がない|ありません|付いていない|なし物件/;
  const variants = [[], [byId.bresport], seeds, four, onPage];
  for (const properties of variants) {
    for (const answers of [{}, { moveSoon: "yes", viewFirst: "yes", floor: ["upper", "elevator"] }]) {
      const memo = buildMemo(properties, { bathToilet: true, noDeposit: true }, answers, TODAY);
      const text = memoText(memo).replace(/礼金なし|敷金なし/g, "□");
      assert.ok(!banned.test(text), text.match(banned)?.[0]);
      assert.ok(!text.includes("外国籍"));
      const labels = [...memo.chips.map((chip) => chip.label), ...memo.questions.flatMap((question) => [question.text, ...question.options.map((option) => option.label)])];
      for (const label of labels) assert.ok(!banned.test(label.replace(/礼金なし|敷金なし/g, "□")), label);
    }
  }
});

test("no sheets, one sheet", () => {
  const none = buildMemo([], {}, {}, TODAY);
  assert.equal(memoText(none), "図面を加えると、ここに条件メモができます");
  assert.deepEqual([none.chips, none.questions], [[], []]);
  const one = buildMemo([byId["louvre-shoto"]], {}, {}, TODAY);
  assert.equal(one.heading, "■ 探す条件（募集図面1件から・2026/9/21）");
  assert.deepEqual(one.chips, []);
  assert.ok([...one.search, ...one.ask].every((line) => !line.includes("件")), "no counts for one sheet");
  assert.deepEqual(one.search, [
    "・エリア：渋谷区",
    "・沿線：小田急線・東京メトロ千代田線・京王井の頭線",
    "・駅：代々木八幡（徒歩10分）",
    "・駅徒歩：10分以内（図面：10分）",
    "・賃料：11万円以下、管理費・共益費込み（図面：11万円）",
    "・間取り：1K",
    "・専有面積：20㎡以上（図面：20.25㎡）",
    "・築年数：25年以内（図面：2001年）",
  ]);
  assert.equal(one.ask[1], "・短期解約違約金の期間と金額");
  assert.match(one.footer, /この図面の値を並べたものなので/);
  assert.deepEqual(searchLines([], [], {}, TODAY), []);
});

test("the memo stays short and leaves its input as it was", () => {
  const text = memoOf(four);
  assert.ok(text.split("\n").length <= 30, `${text.split("\n").length} lines`);
  assert.ok(text.length <= 1200, `${text.length} characters`);
  const input = [...onPage];
  const before = JSON.stringify(input);
  buildMemo(input, { bathToilet: true }, { moveSoon: "yes", floor: ["upper"] }, TODAY);
  assert.equal(JSON.stringify(input), before);
});
