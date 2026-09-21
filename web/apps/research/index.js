import { $, escapeHTML, announce } from "../../helper.js";
import { EXTRACTION_API_URL, MAX_SHEETS } from "../../config.js";
import { fieldValueText, fieldLabel } from "../intake/models.js";
import { manualCandidate } from "../intake/manual.js";
import { applyResearch, candidateValue, missingFields, requestResearch, researchInput, safeSourceUrl, searchLinks } from "./services.js";
import { startAutomaticResearch } from "./automatic.js";
import { monthlyFingerprint, supplementMonthly } from "./monthly.js";

const endpoint = EXTRACTION_API_URL ? `${EXTRACTION_API_URL}/api/research-listing` : "";
const MATCH_LABELS = { provided_link: "入力リンクの調査", same_unit: "建物・住所・部屋番号が一致", same_building: "同じ建物（部屋は未確認）", possible_match: "同じ物件か確認が必要" };

export function initApp(app) {
  const { store } = app.extensions;
  const dialog = $("#researchDialog");
  let propertyId = null, result = null, controller = null, generation = 0;
  const target = () => store.state.properties.find((property) => property.id === propertyId);
  function open(id = null) {
    propertyId = id;
    result = null;
    const property = target();
    $("#researchTitle").textContent = property ? `${property.name} · 不足情報を探す` : "リンクから候補を追加";
    $("#researchUrl").value = property?.sourceUrl ?? "";
    $("#researchUrl").required = !property;
    $("#linkFallback").hidden = Boolean(property);
    $("#linkName").value = "";
    $("#researchStatus").textContent = property ? `探す項目：${missingFields(property).map(fieldLabel).join("・") || "不足項目はありません。掲載情報を確認できます。"}` : "建物の紹介ページと、個別の部屋の募集ページのどちらも入力できます。";
    $("#researchResults").innerHTML = "";
    $("#researchSuggestions").hidden = true;
    $("#researchLinks").innerHTML = property ? searchLinks(property).map(({ label, url }) => `<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${label} ↗</a>`).join("") : "";
    $("#researchRun").disabled = false;
    if (property?.monthlyResearch && property.monthlyResearch.fingerprint === monthlyFingerprint(property)) {
      const saved = property.monthlyResearch;
      $("#researchStatus").textContent = saved.message || "自動調査の結果です。再検索もできます。";
      if (saved.listings) { result = saved; renderResults(); }
    }
    dialog.showModal();
  }
  $("#addLink").addEventListener("click", () => open());
  $("#compareTable").addEventListener("click", (event) => {
    const button = event.target.closest("[data-research]");
    if (button) open(button.dataset.research);
  });
  $("#popoverBody").addEventListener("click", (event) => {
    const button = event.target.closest("[data-research]");
    if (button) { $("#cellPopover").close(); open(button.dataset.research); }
  });
  $("#researchClose").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => { generation++; controller?.abort(); });
  function renderResults() {
    const property = target();
    $("#researchResults").innerHTML = result.listings.map((listing, index) => `<article class="research-result">
      <h3>${escapeHTML(listing.name)}${listing.room ? ` · ${escapeHTML(listing.room)}号室` : ""}</h3>
      <p>${escapeHTML(listing.address)} · ${MATCH_LABELS[listing.match] ?? "一致未確認"}</p>
      <form data-result="${index}"><div class="research-facts">${listing.facts.map((fact, fi) => {
        const known = property && candidateValue(property, fact.key) != null && !(property.unconfirmedFields ?? []).includes(fact.key);
        const selectable = fact.eligible && !known && safeSourceUrl(fact.source?.url);
        const source = fact.source ?? {};
        return `<div class="research-fact"><label><input type="checkbox" name="fact" value="${fi}" ${selectable ? "" : "disabled"} />${escapeHTML(fieldLabel(fact.key))}：<strong>${escapeHTML(fieldValueText(fact.key, fact.value))}</strong></label>
        <p>${known ? `現在の値：${escapeHTML(fieldValueText(fact.key, candidateValue(property, fact.key)))}（上書きしません）` : !fact.eligible ? escapeHTML(fact.reason) : "不足情報として反映できます"}</p>
        ${safeSourceUrl(source.url) ? `<a href="${escapeHTML(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(source.title || "出典を開く")} ↗</a>` : ""}
        <p class="section-hint">掲載日：${escapeHTML(source.listingDate || "不明")} · 取得：${escapeHTML(source.retrievedAt || "不明")} · ${source.status === "current" ? "募集掲載（空室は要確認）" : source.status === "historical" ? "過去の掲載" : "掲載時点不明"}</p>
        <details><summary>出典に基づく調査メモ</summary><p>${escapeHTML(source.text || "")}</p></details></div>`;
      }).join("")}</div><button class="button button--primary" type="submit">${property ? "選んだ不足情報を反映" : "選んだ情報で候補を追加"}</button></form></article>`).join("");
    const suggestions = $("#researchSuggestions");
    suggestions.hidden = !result.searchSuggestions;
    // Provider-required search suggestions are isolated from the application DOM.
    suggestions.srcdoc = result.searchSuggestions || "";
  }
  $("#researchForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const property = target();
    const raw = $("#researchUrl").value.trim();
    const url = raw ? safeSourceUrl(raw) : null;
    if (raw && !url) { $("#researchStatus").textContent = "公開された https:// の掲載リンクを入力してください。"; return; }
    const requestId = ++generation;
    controller?.abort();
    controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 130000);
    $("#researchRun").disabled = true;
    $("#researchResults").innerHTML = "";
    $("#researchSuggestions").hidden = true;
    result = null;
    $("#researchStatus").textContent = "同じ建物・部屋の掲載を調べています…";
    try {
      const response = await requestResearch(endpoint, { ...(property ? researchInput(property) : {}), ...(url ? { url } : {}) }, { signal: controller.signal });
      if (requestId !== generation) return;
      result = response;
      const latest = target();
      if (property && latest && monthlyFingerprint(latest) === monthlyFingerprint(property)) store.upsertProperty(supplementMonthly(latest, response));
      $("#researchStatus").textContent = response.message;
      renderResults();
    } catch (error) {
      if (requestId !== generation) return;
      $("#researchStatus").textContent = error.name === "AbortError" ? "調査がタイムアウトしました。検索リンクから探すか、別の掲載リンクをお試しください。" : error.message;
    } finally {
      clearTimeout(timer);
      if (requestId === generation) $("#researchRun").disabled = false;
    }
  });
  $("#researchResults").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.target.closest("[data-result]");
    if (!form || !result) return;
    const listing = result.listings[Number(form.dataset.result)];
    const selected = new Set(new FormData(form).getAll("fact").map(Number));
    const facts = listing.facts.filter((_, index) => selected.has(index));
    if (!facts.length) { $("#researchStatus").textContent = "反映したい不足情報を選んでください。"; return; }
    let property = target();
    if (propertyId && !property) return;
    if (!property) {
      if (store.state.properties.length >= MAX_SHEETS) { $("#researchStatus").textContent = `候補は${MAX_SHEETS}件までです。`; return; }
      property = manualCandidate({ propertyName: listing.name || "リンクの候補" });
      property.room = listing.room || null;
      property.provenance.mode = "link";
      property.sourceUrl = safeSourceUrl($("#researchUrl").value);
    }
    const updated = applyResearch(property, facts);
    dialog.close();
    store.upsertProperty(updated);
    store.emit("added", updated.id);
    announce(`${updated.name} に選んだ情報を反映しました`);
  });
  $("#saveLink").addEventListener("click", () => {
    const url = safeSourceUrl($("#researchUrl").value);
    const name = $("#linkName").value.trim();
    if (!url || !name) { $("#researchStatus").textContent = "https:// の掲載リンクと、候補の名前を入力してください。"; return; }
    if (store.state.properties.length >= MAX_SHEETS) return;
    const property = manualCandidate({ propertyName: name });
    property.sourceUrl = url;
    property.provenance.mode = "link";
    dialog.close();
    store.upsertProperty(property);
    store.emit("added", property.id);
    announce("リンクを候補として保存しました。掲載内容はまだ取得していません。");
  });
  startAutomaticResearch(store, endpoint);
}
