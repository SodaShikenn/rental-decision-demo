// Status chips for use in any app's markup, and the extraction server's reported state.
import { EXTRACTION_API_URL } from "../../config.js";
import { escapeHTML } from "../../helper.js";
import { STATUS_KINDS, capabilityList } from "./models.js";

const status = { extraction: EXTRACTION_API_URL ? "checking" : "none", model: undefined };
let capabilities = capabilityList(status);

export const getCapabilities = () => capabilities;
export const capability = (key) => capabilities.find((item) => item.key === key);
export const extractionState = () => status.extraction;

/** Record what the extraction server reported, so chips and the list stay truthful. */
export function setExtractionState(extraction, model, maps = false, research = false) {
  Object.assign(status, { extraction, model, maps, research });
  capabilities = capabilityList(status);
}

/**
 * Ask the extraction server what it can do: live, mock, unconfigured (no API key), disabled, or unreachable.
 * Never throws; an unreachable server is a state, not an error.
 */
export async function fetchServerState(baseUrl, { fetchImpl = fetch, timeoutMs = 5000 } = {}) {
  try {
    const response = await fetchImpl(`${baseUrl}/healthz`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) return { state: "unreachable" };
    const health = await response.json();
    const maps = { ...(health.maps ? { maps: health.maps.configured === true } : {}), ...(health.research ? { research: health.research.enabled === true && health.research.configured === true } : {}) };
    if (health.enabled === false) return { state: "disabled", ...maps };
    if (health.mode === "mock") return { state: "mock", ...maps };
    if (health.configured === false) return { state: "unconfigured", ...maps };
    return { state: "live", model: health.model, ...maps };
  } catch {
    return { state: "unreachable" };
  }
}

export const statusChip = (kind, title = "") =>
  `<span class="chip chip--${kind}"${title ? ` title="${escapeHTML(title)}"` : ""}>${STATUS_KINDS[kind].label}</span>`;

/** The chip for one capability, with its current behavior as a tooltip. */
export function capabilityChip(key) {
  const item = capability(key);
  return statusChip(item.kind, `${item.name}：${item.now}`);
}
