import { $, announce, escapeHTML } from "../../helper.js";
import { MAX_SHEETS } from "../../config.js";
import { EXTRACTION_FIELDS } from "./models.js";
import { districtFromAddress } from "./services.js";

export function manualCandidate(values, existing = null, id = crypto.randomUUID()) {
  const candidate = { ...(existing ?? {}), id: existing?.id ?? `manual-${id}`, name: values.propertyName || "名称未入力の候補", costs: existing?.costs ?? [], checks: existing?.checks ?? [], sheet: existing?.sheet ?? null, sheetWarnings: existing?.sheetWarnings ?? [] };
  for (const { key, type } of EXTRACTION_FIELDS) {
    if (key === "propertyName") continue;
    const raw = String(values[key] ?? "").trim();
    candidate[key] = raw === "" ? null : type === "number" ? Number(raw) : raw;
  }
  candidate.district = districtFromAddress(candidate.address);
  const edited = EXTRACTION_FIELDS.filter(({ key }) => existing && (key === "propertyName" ? candidate.name !== existing.name : candidate[key] !== existing[key])).map(({ key }) => key);
  candidate.fieldSources = { ...existing?.fieldSources };
  for (const key of edited) delete candidate.fieldSources[key];
  candidate.provenance = {
    ...(existing?.provenance ?? { mode: "manual", model: null, extractedAt: null }),
    confirmedAt: new Date().toISOString(),
    editedFields: [...new Set([...(existing?.provenance?.editedFields ?? []), ...edited])],
  };
  candidate.unconfirmedFields = (existing?.unconfirmedFields ?? []).filter((key) => !edited.includes(key));
  candidate.provenance.unconfirmed = candidate.unconfirmedFields.length > 0;
  return candidate;
}

export function bindManual(app) {
  const { store } = app.extensions;
  const dialog = $("#manualDialog");
  let editingId = null;
  function open(id = null) {
    const existing = store.state.properties.find((property) => property.id === id);
    if (!existing && store.state.properties.length >= MAX_SHEETS) return;
    editingId = existing?.id ?? null;
    $("#manualTitle").textContent = existing ? "候補の情報を編集" : "候補を入力";
    $("#manualFields").innerHTML = EXTRACTION_FIELDS.map(({ key, label, type, step, allowZero }) => {
      const value = existing ? key === "propertyName" ? existing.name : existing[key] : "";
      return `<label>${label}<input name="${key}" type="${type}" value="${escapeHTML(value ?? "")}" ${type === "number" ? `min="${allowZero ? 0 : step || 1}" step="${step || 1}"` : 'maxlength="300"'} ${key === "propertyName" ? "required" : ""} placeholder="${key === "station" ? "例：下北沢駅 徒歩8分" : "分からなければ空欄"}" /></label>`;
    }).join("");
    dialog.showModal();
  }
  $("#addCandidate").addEventListener("click", () => open());
  $("#compareTable").addEventListener("click", (event) => {
    const edit = event.target.closest("[data-edit-candidate]");
    if (edit) open(edit.dataset.editCandidate);
  });
  $("#manualClose").addEventListener("click", () => dialog.close());
  $("#manualForm").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!editingId && store.state.properties.length >= MAX_SHEETS) return;
    const existing = store.state.properties.find((property) => property.id === editingId);
    const candidate = manualCandidate(Object.fromEntries(new FormData(event.currentTarget)), existing);
    dialog.close();
    store.upsertProperty(candidate);
    store.emit("added", candidate.id);
    announce(`${candidate.name} を保存しました`);
  });
}
