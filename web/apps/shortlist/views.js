// Shortlist DOM: the condition bar, the comparison table, and the schematic map.
import { MAX_PRIORITIES } from "../../config.js";
import { $, $$, escapeHTML, man } from "../../helper.js";
import { estimateCosts } from "../costs/services.js";
import { LANDMARK, SITUATIONS, SORTS, STATIONS } from "./models.js";
import { isProvisional, monthlyCost, priorityLabel, relevantChecks, scoreProperty, sortProperties, stationName, stationPosition, walkMinutes } from "./services.js";

const unknown = '<span class="unknown">未取得</span>';
const singleColumn = () => window.matchMedia("(max-width: 1079px)").matches;
const shortMan = (value) => man(value).replace("万円", "万");

function costCell(property) {
  const cost = monthlyCost(property);
  if (cost == null) return unknown;
  const { rent, managementFee } = property;
  const detail = managementFee == null ? "管理費未取得" : managementFee === 0 ? "管理費込み" : `賃料${shortMan(rent)}＋管理費${shortMan(managementFee)}`;
  return `${man(cost)}<span class="cell-sub">${detail}</span>`;
}

function layoutCell(property) {
  const layout = property.layout ? escapeHTML(property.layout) : unknown;
  const area = property.areaSqm ? `${property.areaSqm}㎡` : unknown;
  return `${layout} · ${area}`;
}

function walkCell(property) {
  const minutes = walkMinutes(property.station);
  const station = stationName(property.station);
  return `${minutes == null ? unknown : `徒歩${minutes}分`}${station ? `<span class="cell-sub">${escapeHTML(station)}駅</span>` : ""}`;
}

function yearCell({ constructionYear }) {
  if (!constructionYear) return unknown;
  const age = new Date().getFullYear() - constructionYear;
  return `${constructionYear}年<span class="cell-sub">${age <= 0 ? "新築" : `築${age}年`}</span>`;
}

function initialCostCell(property, preferences, adjustment) {
  const { initial, rentAssumed } = estimateCosts(property, preferences, adjustment);
  if (!initial.complete) return `<span class="unknown" title="賃料が図面にないため、分かる項目だけの合計です">一部のみ</span><span class="cell-sub">${man(initial.amount)}＋未取得</span>`;
  return `${man(initial.amount)}${rentAssumed ? '<span class="cell-sub">仮の賃料で計算</span>' : ""}`;
}

function rowMarkup(property, { selectedId, preferences, costAdjustments }) {
  const selected = property.id === selectedId;
  const score = scoreProperty(property, preferences);
  const priority = (key) => (preferences.priorities.has(key) ? " is-priority" : "");
  const added = property.provenance && !property.provenance.seeded;
  const relevant = relevantChecks(property, preferences.situations);
  return `
    <tr data-property="${escapeHTML(property.id)}"${selected ? ' class="is-selected"' : ""}>
      <td class="cell-name" data-label="物件">
        <button class="row-button" type="button"${selected ? ' aria-current="true"' : ""}>${escapeHTML(property.name)}</button>
        <span class="cell-sub">${escapeHTML(property.district ?? "所在地要確認")}${added ? '<span class="tag">募集図面から追加</span>' : ""}${relevant.length ? `<span class="tag tag--attention" title="${escapeHTML(relevant.map((check) => check.title).join("、"))}">あなたに関係する確認 ${relevant.length}件</span>` : ""}</span>
      </td>
      <td class="num" data-label="月額">${costCell(property)}</td>
      <td class="num" data-label="初期費用（目安）">${initialCostCell(property, preferences, costAdjustments[property.id])}</td>
      <td class="${priority("space")}" data-label="間取り・面積">${layoutCell(property)}</td>
      <td class="num${priority("walk")}" data-label="駅徒歩">${walkCell(property)}</td>
      <td class="num${priority("age")}" data-label="築年">${yearCell(property)}</td>
      <td class="num cell-score" data-label="条件との一致度">${isProvisional(property, preferences) ? '<span class="tag" title="図面にない値を中立値で計算しています">暫定</span>' : ""}<span class="score">${score}</span><span class="score-bar"><span style="width:${score}%"></span></span></td>
    </tr>`;
}

function renderSummary(ordered, { preferences }) {
  const priorities = [...preferences.priorities].map(priorityLabel);
  const situations = SITUATIONS.filter((situation) => preferences.situations.has(situation.key)).map((situation) => situation.label);
  $("#shortlistCount").textContent = `${ordered.length}件`;
  $("#decisionSummary").textContent = [
    `月額の上限 ${man(preferences.budget)}`,
    priorities.length ? `譲れない条件：${priorities.join("・")}` : "譲れない条件なし",
    situations.length ? `あなたの状況：${situations.join("・")}` : null,
  ].filter(Boolean).join(" · ");
  const relevant = ordered.reduce((sum, property) => sum + relevantChecks(property, preferences.situations).length, 0);
  $("#rankingStatus").textContent = [
    "条件を変えると、その場で並べ替えます。一致度は選んだ条件から計算した目安で、決めるのはあなたです。",
    situations.length ? `あなたの状況に関係する確認事項は、候補全体で${relevant}件です（物件名の下と詳細パネルに表示）。` : "「あなたの状況」を選ぶと、関係する確認事項を先に示します。",
  ].join("");
  $$("th[data-criterion]").forEach((th) => th.setAttribute("data-priority", String(preferences.priorities.has(th.dataset.criterion))));
}

// A fixed frame around the known stations, so the geography stays put as candidates change.
const LATS = Object.values(STATIONS).map(([lat]) => lat);
const LNGS = Object.values(STATIONS).map(([, lng]) => lng);
const FRAME = { north: Math.max(...LATS), south: Math.min(...LATS), west: Math.min(...LNGS), east: Math.max(...LNGS) };
const PAD = { x: 7, y: 16 }; // percent left free at the edges for labels

function toMap([lat, lng]) {
  return {
    x: PAD.x + ((lng - FRAME.west) / (FRAME.east - FRAME.west)) * (100 - 2 * PAD.x),
    y: PAD.y + ((FRAME.north - lat) / (FRAME.north - FRAME.south)) * (100 - 2 * PAD.y),
  };
}

function renderMap(app, ordered, { selectedId }) {
  const placed = ordered.filter(stationPosition);
  const unplaced = ordered.filter((property) => !stationPosition(property)).map((property) => property.name);
  const { maps } = app.extensions;
  maps.setPins(placed.map((property) => {
    const [lat, lng] = stationPosition(property);
    return { lat, lng, label: String(ordered.indexOf(property) + 1), title: property.name };
  }));
  $("#mapApiNote").textContent = [
    `候補を最寄駅の位置に置いた${maps.live ? "地図" : "概略図"}です。住所の位置特定（Geocoding）は未接続のため、実際の所在地とは駅からの徒歩距離ぶんずれます。`,
    unplaced.length ? `位置未取得：${unplaced.join("、")}（最寄駅が地図の範囲外、または未取得）` : "",
  ].join(" ");

  const pins = $("#mapPins");
  if (!pins) return; // replaced by Google Maps
  const style = ({ x, y }) => `left:${x.toFixed(1)}%;top:${y.toFixed(1)}%`;
  const stations = new Set(placed.map((property) => stationName(property.station)));
  const drawn = new Map(); // station name → pins already stacked under it
  pins.innerHTML = [
    ...[...stations, ...(stations.has(LANDMARK) ? [] : [LANDMARK])].map((name) => {
      const landmark = !stations.has(name);
      const point = toMap(STATIONS[name]);
      return `<span class="map-station${landmark ? " is-landmark" : ""}${point.x > 62 ? " is-left" : ""}" style="${style(point)}">${escapeHTML(name)}${landmark ? "（目印）" : "駅"}</span>`;
    }),
    ...placed.map((property) => {
      const station = stationName(property.station);
      const stack = drawn.get(station) ?? 0;
      drawn.set(station, stack + 1);
      const point = toMap(STATIONS[station]);
      const position = { x: point.x, y: point.y + 13 + stack * 13 };
      const order = ordered.indexOf(property) + 1;
      const selected = property.id === selectedId;
      const side = point.x > 62 ? " pin--left" : "";
      return `<button class="pin${side}${selected ? " is-selected" : ""}" type="button" data-property="${escapeHTML(property.id)}" style="${style(position)}" aria-label="表の${order}番目 ${escapeHTML(property.name)}（${escapeHTML(station)}駅）"${selected ? ' aria-current="true"' : ""}><span class="pin-rank">${order}</span>${escapeHTML(property.name)}</button>`;
    }),
  ].join("");
}

export function renderShortlist(app) {
  const { state } = app.extensions.store;
  const ordered = sortProperties(state.properties, state.preferences, state.costAdjustments);
  $("#candidateRows").innerHTML = ordered.map((property) => rowMarkup(property, state)).join("");
  renderSummary(ordered, state);
  renderMap(app, ordered, state);
}

/** Briefly highlight a candidate that was just added. */
export function flashRow(id) {
  $(`#candidateRows tr[data-property="${CSS.escape(id)}"]`)?.classList.add("is-new");
}

function syncPriorityControls(priorities) {
  const full = priorities.size >= MAX_PRIORITIES;
  $$("#priorityChips .toggle[data-priority]").forEach((toggle) => {
    const pressed = priorities.has(toggle.dataset.priority);
    toggle.setAttribute("aria-pressed", String(pressed));
    toggle.disabled = full && !pressed;
  });
  $("#priorityHint").textContent = full ? "2つ選択中。変えるには選択を外してください" : `${MAX_PRIORITIES}つまで選べます`;
}

export function bindControls(app) {
  const { store } = app.extensions;
  const select = (id) => {
    store.select(id);
    if (singleColumn()) $("#detailPanel").scrollIntoView({ behavior: "smooth", block: "start" });
  };

  $("#candidateRows").addEventListener("click", (event) => {
    const row = event.target.closest("tr[data-property]");
    if (row) select(row.dataset.property);
  });
  $("#mockMap").addEventListener("click", (event) => {
    const pin = event.target.closest(".pin[data-property]");
    if (pin) select(pin.dataset.property);
  });

  const budget = $("#budget");
  budget.addEventListener("input", () => {
    $("#budgetOutput").value = man(Number(budget.value));
    store.updatePreferences((preferences) => {
      preferences.budget = Number(budget.value);
    });
  });
  const sort = $("#sortBy");
  sort.innerHTML = SORTS.map(({ key, label }) => `<option value="${key}"${key === store.state.preferences.sortBy ? " selected" : ""}>${label}</option>`).join("");
  sort.addEventListener("change", () => {
    store.updatePreferences((preferences) => {
      preferences.sortBy = sort.value;
    });
  });
  const situations = $("#situationChips");
  situations.innerHTML = SITUATIONS.map(({ key, label }) => `<button class="toggle" type="button" data-situation="${key}" aria-pressed="${store.state.preferences.situations.has(key)}">${label}</button>`).join("");
  situations.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-situation]");
    if (!toggle) return;
    store.updatePreferences(({ situations: chosen }) => {
      const key = toggle.dataset.situation;
      if (chosen.has(key)) chosen.delete(key);
      else chosen.add(key);
    });
    toggle.setAttribute("aria-pressed", String(store.state.preferences.situations.has(toggle.dataset.situation)));
  });
  $("#priorityChips").addEventListener("click", (event) => {
    const toggle = event.target.closest(".toggle[data-priority]");
    if (!toggle || toggle.disabled) return;
    store.updatePreferences(({ priorities }) => {
      const key = toggle.dataset.priority;
      if (priorities.has(key)) priorities.delete(key);
      else if (priorities.size < MAX_PRIORITIES) priorities.add(key);
    });
    syncPriorityControls(store.state.preferences.priorities);
  });
  syncPriorityControls(store.state.preferences.priorities);
}
