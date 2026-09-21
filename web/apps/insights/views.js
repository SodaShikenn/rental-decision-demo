// Detail panel DOM: why the selected candidate ranks where it does, where each value came from on its
// listing sheet, and what is not known yet.
import { $$, $, drawEvidenceCrop, escapeHTML, man, termButton, tsubo, yen } from "../../helper.js";
import { capabilityChip } from "../capabilities/services.js";
import { estimateCosts } from "../costs/services.js";
import { findTerms } from "../glossary/services.js";
import { EXTRACTION_FIELDS, WARNING_LABELS } from "../intake/models.js";
import { provenanceText } from "../intake/services.js";
import { CRITERIA } from "../shortlist/models.js";
import { criterionScore, isProvisional, monthlyCost, scoreBreakdown, scoreProperty, situationFocus, walkMinutes } from "../shortlist/services.js";

// Largest single component (budget, or a 10-point criterion × 2.5), used to scale the bars.
const MAX_COMPONENT = 25;
// Data a renter needs that no connected source provides yet, with the capability that tracks it.
const MISSING_DATA = [
  ["通勤時間・経路", "routes"],
  ["周辺の環境", "places"],
  ["賃料の推移", "rentHistory"],
  ["居住者の口コミ", "reviews"],
];

// Pre-contract checks found on the sheet (server/apps/listing/checks.py), grouped for reading.
const CHECK_CATEGORIES = { cost: "費用", exit: "解約・更新", viewing: "内見・現況", eligibility: "入居条件", building: "建物・部屋" };
const CHECK_TERMS = {
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
// What no sheet prints, so it is worth asking about for every candidate.
const GENERAL_CHECKS = [
  ["仲介手数料", "図面には載りません。借主の負担は、承諾がなければ家賃0.5ヶ月分＋税までです。"],
  ["前家賃・日割り家賃", "契約時に、入居月の日割り分と翌月分をまとめて払うのが一般的です。家賃が発生する日を確認しましょう。"],
  ["原状回復", "退去時に何を負担するか、特約を重要事項説明で確認しましょう。普通に暮らしてできた汚れや年月による傷みは、原則として貸主の負担です。"],
  ["徒歩○分", "内見では、日当たり・騒音・携帯電波・家具の搬入経路・洗濯機置場と冷蔵庫置場の寸法も確認しましょう。駅までは実際に歩いてみるのが確実です。"],
];

const images = new Map();
/** Load a sheet image once; later calls share the same promise. */
function loadImage(src) {
  if (!images.has(src)) {
    const image = new Image();
    image.src = src;
    images.set(src, image.decode().then(() => image));
  }
  return images.get(src);
}

function describe(key, property) {
  if (key === "walk") return `駅から徒歩${walkMinutes(property.station)}分`;
  if (key === "space") return `広さ${property.areaSqm}㎡`;
  const age = new Date().getFullYear() - property.constructionYear;
  return age <= 0 ? "新築" : `築${age}年`;
}

function notes(property, { budget }) {
  const cost = monthlyCost(property);
  const strengths = [];
  const concerns = [];
  if (cost == null) concerns.push("賃料の記載がなく予算と比較できない");
  else if (cost <= budget) strengths.push(`月額${man(cost)}で上限内`);
  else concerns.push(`月額${man(cost)}で上限を${yen(cost - budget)}超過`);
  for (const { key, label } of CRITERIA) {
    const value = criterionScore(property, key);
    if (value == null) concerns.push(`${label}が未取得`);
    else if (value >= 7) strengths.push(describe(key, property));
    else if (value <= 4) concerns.push(describe(key, property));
  }
  // [term, HTML]: everything taken from the candidate is escaped here.
  const rows = [
    ["条件に合う点", escapeHTML(strengths.length ? `${strengths.join("、")}。` : "10点満点で7点以上の項目はありません。")],
    ["合わない点", escapeHTML(concerns.length ? `${concerns.join("、")}。` : "図面から分かる範囲では、条件と大きく外れる点はありません。")],
  ];
  if (property.sheetWarnings?.length) {
    rows.push(["図面の注意", property.sheetWarnings.map((warning) => `<span class="note-warning"><b>${WARNING_LABELS[warning.code] ?? "注意"}</b>${escapeHTML(warning.message)}</span>`).join("")]);
  }
  return `<dl class="notes">${rows.map(([term, html]) => `<div><dt>${term}</dt><dd>${html}</dd></div>`).join("")}</dl>`;
}

function breakdown(property, preferences) {
  const rows = scoreBreakdown(property, preferences);
  const raw = rows.reduce((sum, row) => sum + row.points, 0);
  const score = scoreProperty(property, preferences);
  return `
    <dl class="breakdown">
      ${rows.map((row) => `
        <div>
          <dt>${escapeHTML(row.label)}${row.note ? `<small>${escapeHTML(row.note)}</small>` : ""}</dt>
          <dd><span class="bd-bar${row.neutral ? " is-neutral" : ""}"><span style="width:${Math.min(100, (row.points / MAX_COMPONENT) * 100)}%"></span></span></dd>
          <dd>${row.points.toFixed(1)}</dd>
        </div>`).join("")}
      <div class="bd-total"><dt>合計${raw > 99 ? "<small>上限99点</small>" : ""}</dt><dd></dd><dd>${score}</dd></div>
    </dl>`;
}

const formatted = (key, value) => {
  if (value == null) return "未取得";
  if (key === "rent" || key === "managementFee") return value === 0 ? "0円（込み）" : yen(value);
  if (key === "areaSqm") return `${value}㎡`;
  if (key === "constructionYear") return `${value}年`;
  return String(value);
};

// Some OCR lines run the width of the sheet (a whole terms block); the crop shows the rest.
const clip = (text, length = 48) => (text.length > length ? `${text.slice(0, length)}…` : text);

/** Each confirmed value beside the part of the sheet it was read from. */
function evidence(property) {
  const { sheet, provenance } = property;
  const items = EXTRACTION_FIELDS.map(({ key, label }) => {
    const field = sheet.fields[key];
    const value = key === "propertyName" ? property.name : property[key];
    const edited = provenance.editedFields.includes(key);
    const meta = field.value == null
      ? "図面から読み取れなかった項目です"
      : `OCR「${escapeHTML(clip(field.sourceText ?? ""))}」· 信頼度 ${Math.round(field.confidence * 100)}%`;
    return `
      <li>
        <span class="evidence-label">${escapeHTML(label.replace(/（.+）$/, ""))}</span>
        <span class="evidence-value">${escapeHTML(formatted(key, value))}${edited ? `<span class="tag" title="読み取り値：${escapeHTML(formatted(key, field.value))}">修正あり</span>` : ""}</span>
        ${field.evidence ? `<canvas class="evidence-crop" data-crop="${key}" role="img" aria-label="${escapeHTML(label)}の根拠となる図面の箇所"></canvas>` : ""}
        <span class="evidence-meta">${meta}</span>
      </li>`;
  }).join("");
  return `<ul class="evidence-list">${items}</ul>`;
}

function checksMarkup(property, focus) {
  const checks = (property.checks ?? []).map((check, index) => ({ ...check, index, relevant: focus.checks.has(check.code) }));
  // Checks that concern the renter's situation come first, open; the rest follow by category.
  const groups = [
    ["あなたの状況に関係", checks.filter((check) => check.relevant)],
    ...Object.entries(CHECK_CATEGORIES).map(([category, label]) => [label, checks.filter((check) => !check.relevant && check.category === category)]),
  ].filter(([, items]) => items.length);
  const found = groups.length
    ? `<div class="check-groups">${groups.map(([label, items]) => `
        <div class="check-group">
          <p class="check-category">${label}</p>
          <ul class="check-list">${items.map((check) => `
            <li>
              <details class="check${check.relevant ? " is-relevant" : ""}"${check.relevant ? " open" : ""}>
                <summary class="check-title">${escapeHTML(check.title)}</summary>
                <p class="check-detail">${escapeHTML(check.detail)}${CHECK_TERMS[check.code] ? termButton(CHECK_TERMS[check.code], check.title) : ""}</p>
                <p class="check-source">図面「${escapeHTML(clip(check.sourceText, 60))}」</p>
                ${check.evidence && property.sheet ? `<canvas class="evidence-crop" data-check="${check.index}" role="img" aria-label="${escapeHTML(check.title)}の該当箇所"></canvas>` : ""}
              </details>
            </li>`).join("")}
          </ul>
        </div>`).join("")}</div>`
    : '<p class="empty-note">この図面からは、決まった言葉で書かれた注意点を見つけられませんでした。</p>';
  return `
    ${found}
    <details class="check-general">
      <summary>どの図面にも載らない確認事項</summary>
      <ul>${GENERAL_CHECKS.map(([term, text]) => `<li><b>${escapeHTML(term.replace(/○/, ""))}</b>${termButton(term)}<span>${escapeHTML(text)}</span></li>`).join("")}</ul>
    </details>
    <p class="check-caveat">図面の文字から決まった言葉を探す仕組みのため、書き方によっては見落とします。契約前に重要事項説明で必ず確認してください。</p>`;
}

function termsMarkup(property, focus) {
  const text = [property.name, property.layout, property.station, ...(property.sheet?.lines ?? []).map((line) => line.text)].filter(Boolean).join("\n");
  const found = findTerms(text);
  // Terms that matter for the renter's situation first (自炊 → コンロの口数, 在宅 → インターネット, …).
  const terms = [...found.filter((term) => focus.terms.has(term)), ...found.filter((term) => !focus.terms.has(term))].slice(0, 28);
  return terms.length
    ? `<div class="term-chips">${terms.map((term) => `<button class="term-chip${focus.terms.has(term) ? " is-relevant" : ""}" type="button" data-term="${escapeHTML(term)}">${escapeHTML(term.replace(/（.*$/, ""))}</button>`).join("")}</div>`
    : '<p class="empty-note">この候補の図面から、辞典にある言葉は見つかりませんでした。</p>';
}

async function drawCrops(panel, property) {
  const canvases = $$("canvas[data-crop], canvas[data-check]", panel);
  if (!canvases.length) return;
  const box = (canvas) => (canvas.dataset.crop ? property.sheet.fields[canvas.dataset.crop].evidence : property.checks[canvas.dataset.check].evidence);
  try {
    const image = await loadImage(property.sheet.image);
    canvases.filter((canvas) => canvas.isConnected).forEach((canvas) => drawEvidenceCrop(canvas, image, box(canvas), 480));
  } catch {
    canvases.forEach((canvas) => canvas.remove()); // the OCR text beside each value still shows the evidence
  }
}

export function renderDetail(app) {
  const { store } = app.extensions;
  const { preferences, properties } = store.state;
  const property = store.selected() ?? properties[0];
  const focus = situationFocus(preferences.situations);
  const cost = monthlyCost(property);
  const fee = property.managementFee == null ? "管理費未取得" : property.managementFee === 0 ? "管理費込み" : `賃料${man(property.rent)}＋管理費${yen(property.managementFee)}`;
  const area = property.areaSqm ? `${property.areaSqm}㎡ <small>（${tsubo(property.areaSqm)}坪）</small>` : "未取得";
  const age = property.constructionYear ? new Date().getFullYear() - property.constructionYear : null;
  const openSheet = property.sheet ? `<a href="${escapeHTML(property.sheet.image)}" target="_blank" rel="noopener">図面を開く</a>` : "";
  const estimate = estimateCosts(property, preferences, store.state.costAdjustments[property.id]);
  const estimateText = (total) => (total.complete ? man(total.amount) : `${man(total.amount)}＋未取得`);

  const panel = $("#detailPanel");
  panel.innerHTML = `
    <header class="detail-head">
      <p class="detail-rank"><span>条件との一致度</span><strong>${scoreProperty(property, preferences)}</strong>${isProvisional(property, preferences) ? '<span class="tag">暫定</span>' : ""}</p>
      <h2 id="detailTitle">${escapeHTML(property.name)}</h2>
      <dl class="facts">
        <div><dt>月額（賃料＋管理費）</dt><dd>${cost == null ? "未取得" : `${man(cost)} <small>（${fee}）</small>`}</dd></div>
        <div><dt>間取り・専有面積</dt><dd>${escapeHTML(property.layout ?? "未取得")} · ${area}</dd></div>
        <div><dt>最寄駅</dt><dd>${escapeHTML(property.station ?? "未取得")}</dd></div>
        <div><dt>築年</dt><dd>${property.constructionYear ? `${property.constructionYear}年 <small>（${age <= 0 ? "新築" : `築${age}年`}）</small>` : "未取得"}</dd></div>
        <div><dt>初期費用（目安）</dt><dd>${estimateText(estimate.initial)} <small>${estimate.rentAssumed ? "（仮の賃料） " : ""}<a href="#costsPanel">内訳</a></small></dd></div>
        <div><dt>実質の月額</dt><dd>${estimateText(estimate.monthly)} <small>（保証料など込み）</small></dd></div>
      </dl>
      <p class="detail-address">${escapeHTML(property.address ?? "住所未取得")}</p>
      ${property.provenance ? `<p class="detail-source"><span>出典：${escapeHTML(provenanceText(property.provenance))}</span>${openSheet}</p>` : ""}
    </header>
    <section class="detail-section">
      <h3>条件との照らし合わせ</h3>
      ${notes(property, preferences)}
    </section>
    <section class="detail-section">
      <h3>契約前に確認すること <span class="count">図面から${(property.checks ?? []).length}件</span></h3>
      ${checksMarkup(property, focus)}
    </section>
    <section class="detail-section">
      <h3>一致度の内訳</h3>
      ${breakdown(property, preferences)}
    </section>
    ${property.sheet ? `
    <section class="detail-section">
      <h3>図面の根拠 ${openSheet}</h3>
      ${evidence(property)}
    </section>` : ""}
    <section class="detail-section">
      <h3>この図面の用語</h3>
      ${termsMarkup(property, focus)}
    </section>
    <section class="detail-section">
      <h3>比較に含めていないデータ</h3>
      <ul class="missing-list">${MISSING_DATA.map(([name, key]) => `<li><span>${name}</span>${capabilityChip(key)}</li>`).join("")}</ul>
      <p class="empty-note">提供元が未接続のため、推測値は表示しません。内見と管理会社への問い合わせで確認してください。</p>
    </section>`;
  if (property.sheet) drawCrops(panel, property);
}
