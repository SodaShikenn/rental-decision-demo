import { EXTRACTION_FIELDS } from "../intake/models.js";
import { districtFromAddress } from "../intake/services.js";

export function safeSourceUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
export const candidateValue = (property, key) => key === "propertyName" ? property.name : property[key];
export const missingFields = (property) => EXTRACTION_FIELDS.filter(({ key }) => candidateValue(property, key) == null || (property.unconfirmedFields ?? []).includes(key)).map(({ key }) => key);
export function researchInput(property) {
  return { name: property.name, address: property.address ?? "", room: property.room ?? property.name.match(/(\d+)\s*号室/)?.[1] ?? "", layout: property.layout ?? "", areaSqm: property.areaSqm ?? null, missing: missingFields(property) };
}
export function searchLinks(property) {
  const query = `${property.name} ${property.address ?? ""} 賃貸`;
  return [
    { label: "Googleで同じ物件を探す", url: `https://www.google.com/search?q=${encodeURIComponent(query)}` },
    { label: "SUUMOの掲載を探す", url: `https://www.google.com/search?q=${encodeURIComponent(`site:suumo.jp ${query}`)}` },
    { label: "HOME’Sの掲載を探す", url: `https://www.google.com/search?q=${encodeURIComponent(`site:homes.co.jp ${query}`)}` },
  ];
}
export async function requestResearch(endpoint, input, { fetchImpl = fetch, signal } = {}) {
  if (!endpoint) throw new Error("オンライン調査サーバーが未設定です。検索リンクで調べた内容を手入力するか、掲載リンクを候補として保存できます。");
  const response = await fetchImpl(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), signal });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error?.message || "オンライン調査に失敗しました。");
  if (!Array.isArray(body?.listings)) throw new Error("調査結果の形式を確認できませんでした。");
  return body;
}

/** Explicitly accepted, eligible facts fill gaps only; existing/image values survive conflicts. */
export function applyResearch(property, facts) {
  const updated = { ...property, fieldSources: { ...property.fieldSources }, unconfirmedFields: [...(property.unconfirmedFields ?? [])] };
  const allowed = new Set(EXTRACTION_FIELDS.map(({ key }) => key));
  for (const fact of facts) {
    if (!allowed.has(fact.key) || !fact.eligible || !safeSourceUrl(fact.source?.url)) continue;
    if (candidateValue(updated, fact.key) != null && !updated.unconfirmedFields.includes(fact.key)) continue;
    const definition = EXTRACTION_FIELDS.find(({ key }) => key === fact.key);
    if (definition.type === "number" && (typeof fact.value !== "number" || !Number.isFinite(fact.value) || (fact.value <= 0 && !(fact.key === "managementFee" && fact.value === 0)))) continue;
    if (definition.type !== "number" && (typeof fact.value !== "string" || !fact.value.trim())) continue;
    updated[fact.key === "propertyName" ? "name" : fact.key] = fact.value;
    updated.fieldSources[fact.key] = { ...fact.source, value: fact.value };
    updated.unconfirmedFields = updated.unconfirmedFields.filter((key) => key !== fact.key);
  }
  updated.district = districtFromAddress(updated.address);
  updated.provenance = { ...property.provenance, unconfirmed: updated.unconfirmedFields.length > 0 };
  return updated;
}
