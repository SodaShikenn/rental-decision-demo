// Capability DOM: the list in この画面について, and the chip beside the intake title ([data-capability]).
import { EXTRACTION_API_URL } from "../../config.js";
import { $, $$, escapeHTML } from "../../helper.js";
import { capabilityChip, getCapabilities, statusChip } from "./services.js";

// The first boundary sentence depends on whether this deployment has an extraction server.
const READING_BOUNDARY = EXTRACTION_API_URL
  ? "解析サーバーに接続する設定です。画像をどう扱うかは「図面を追加」の画面に表示します。"
  : "公開デモでは解析サーバーが未設定のため、読み取れるのはサンプル図面だけです。選んだ画像はどこにも送信しません。";

export function renderCapabilities() {
  $("#aboutList").innerHTML = getCapabilities().map((item) => `
    <li>
      <p class="about-name">${escapeHTML(item.name)}${statusChip(item.kind)}</p>
      <p class="about-now">${escapeHTML(item.now)}</p>
      ${item.next ? `<p class="about-next">稼働に必要なこと：${escapeHTML(item.next)}</p>` : ""}
    </li>`).join("");
  $("#aboutReading").textContent = READING_BOUNDARY;

  // Placeholders keep their data attribute, so a later status change can re-render them.
  $$("[data-capability]").forEach((element) => {
    element.innerHTML = capabilityChip(element.dataset.capability);
  });
}

export function bindCapabilities() {
  const dialog = $("#aboutDialog");
  $("#aboutOpen").addEventListener("click", () => {
    dialog.showModal();
    $("#aboutClose").focus();
  });
  $("#aboutClose").addEventListener("click", () => dialog.close());
  // A click on the backdrop (outside the panel) closes the dialog.
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
}
