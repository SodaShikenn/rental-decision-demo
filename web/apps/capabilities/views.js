// Capability DOM: the header summary, the full table, and chips in static markup ([data-capability]).
import { $, $$, escapeHTML } from "../../helper.js";
import { STATUS_KINDS, statusCounts } from "./models.js";
import { capabilityChip, getCapabilities, statusChip } from "./services.js";

export function renderCapabilities() {
  const capabilities = getCapabilities();
  const counts = statusCounts(capabilities);
  $("#statusSummary").innerHTML = `<span class="status-link-label">機能の状態</span>${Object.keys(STATUS_KINDS)
    .map((kind) => `${statusChip(kind)}<span class="tnum">${counts[kind]}</span>`)
    .join("")}`;
  $("#statusSummary").setAttribute("aria-label", `機能の状態：稼働中 ${counts.live}件、デモ ${counts.demo}件、未接続 ${counts.planned}件`);

  $("#capabilityRows").innerHTML = capabilities.map((item) => `
    <tr>
      <td>${escapeHTML(item.name)}</td>
      <td>${statusChip(item.kind)}</td>
      <td>${escapeHTML(item.now)}</td>
      <td>${item.next ? escapeHTML(item.next) : "—"}</td>
    </tr>`).join("");

  // Placeholders keep their data attribute, so a later status change can re-render them.
  $$("[data-capability]").forEach((element) => {
    element.innerHTML = capabilityChip(element.dataset.capability);
  });
}
