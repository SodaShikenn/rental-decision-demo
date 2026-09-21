import { requestResearch, researchInput } from "./services.js";
import { monthlyFingerprint, needsMonthlyResearch, researchDue, supplementMonthly } from "./monthly.js";
import { RECORDED_MONTHLY_RESEARCH } from "../../data/research.js";

export function restoreRecordedResearch(store) {
  for (const property of [...store.state.properties]) {
    if (property.monthlyResearch || !needsMonthlyResearch(property) || researchInput(property).room) continue;
    const recorded = RECORDED_MONTHLY_RESEARCH.find((item) => item.name === property.name && item.address === property.address);
    if (recorded) store.upsertProperty(supplementMonthly(property, recorded.result, recorded.result.retrievedAt));
  }
}

/** One request at a time, once a day per unchanged candidate; no background retry storm. */
export function startAutomaticResearch(store, endpoint, { request = requestResearch, timeoutMs = 130000 } = {}) {
  let busy = false;
  async function scan() {
    if (busy || !endpoint) return;
    const property = store.state.properties.find((item) => researchDue(item));
    if (!property) return;
    busy = true;
    const fingerprint = monthlyFingerprint(property), attemptedAt = new Date().toISOString();
    const current = () => store.state.properties.find((item) => item.id === property.id);
    const unchanged = () => current() && monthlyFingerprint(current()) === fingerprint && current().monthlyResearch?.attemptedAt === attemptedAt;
    const previous = property.monthlyResearch?.fingerprint === fingerprint ? property.monthlyResearch : {};
    store.upsertProperty({ ...property, monthlyResearch: { ...previous, fingerprint, attemptedAt, status: "searching", message: "月額の掲載を自動で調べています…" } });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await request(endpoint, { ...researchInput(property), ...(property.sourceUrl ? { url: property.sourceUrl } : {}) }, { signal: controller.signal });
      if (unchanged()) store.upsertProperty(supplementMonthly(current(), response, attemptedAt));
    } catch (error) {
      if (unchanged()) store.upsertProperty({ ...current(), monthlyResearch: { ...current().monthlyResearch, fingerprint, attemptedAt, status: "error", message: error.name === "AbortError" ? "調査がタイムアウトしました。再検索できます。" : error.message } });
    } finally {
      clearTimeout(timer);
      busy = false;
      setTimeout(scan, 0);
    }
  }
  store.on("change", () => { void scan(); });
  setTimeout(scan, 0);
}
