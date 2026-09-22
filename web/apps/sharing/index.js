import { $, escapeHTML as e } from "../../helper.js";
import { post } from "../../shared/api.js";
import { buildBrief } from "./services.js";
import { markup, briefMarkup, exportHTML } from "./views.js";
const OWNER_KEY = "rental-helper-share-owners";
export function initApp(app) {
  const { store } = app.extensions;
  $("#sharingMount").innerHTML = markup;
  let busy = false;
  const brief = () =>
    buildBrief(store.state, {
      includeDestination: $("#shareDestination").checked,
      destination: app.extensions.workDestination?.() || "",
    });
  const history = () =>
    $("#shareConversation").checked && !store.state.advisor.usesMaps
      ? store.state.advisor.history || []
      : [];
  function render() {
    $("#shareConversation").disabled = !!store.state.advisor.usesMaps;
    if (store.state.advisor.usesMaps) $("#shareConversation").checked = false;
    $("#sharePreview").innerHTML = briefMarkup(brief());
    $("#shareExtras").innerHTML = `${
      $("#shareImages").checked
        ? `<p>HTMLに含む画像：${
            store.state.properties
              .filter((p) => p.sheet?.image)
              .map((p) => e(p.name))
              .join("、") || "なし"
          }</p>`
        : ""
    }${
      history().length
        ? `<details><summary>HTMLに含む会話のプレビュー</summary>${history()
            .map((t) => `<p>${e(t.role)}：${e(t.text)}</p>`)
            .join("")}</details>`
        : ""
    }`;
  }
  function owners() {
    try {
      return JSON.parse(localStorage.getItem(OWNER_KEY) || "[]").filter(
        (o) => o.expiresAt * 1000 > Date.now(),
      );
    } catch {
      return [];
    }
  }
  function ownerLinks() {
    const items = owners();
    $("#shareLinks").innerHTML = items
      .map(
        (o, i) =>
          `<p><a href="${e(o.url)}" target="_blank" rel="noopener noreferrer">共有メモを開く ↗</a> · ${e(new Date(o.expiresAt * 1000).toLocaleString("ja-JP"))}まで <button class="button button--text" data-revoke-share="${i}">リンクを削除</button></p>`,
      )
      .join("");
  }
  $(".share-options").addEventListener("change", render);
  $("#exportBrief").addEventListener("click", async () => {
    if (busy) return;
    busy = true;
    $("#exportBrief").disabled = true;
    const document = brief(),
      turns = structuredClone(history()),
      selected = $("#shareImages").checked
        ? store.state.properties
            .filter((p) => p.sheet?.image)
            .map((p) => ({ name: p.name, src: p.sheet.image }))
        : [];
    try {
      const images = await Promise.all(
        selected.map(async (i) => {
          const response = await fetch(i.src);
          if (!response.ok) throw new Error("画像を取得できませんでした。");
          const blob = await response.blob();
          if (!["image/png", "image/jpeg", "image/webp"].includes(blob.type))
            throw new Error("画像形式を確認してください。");
          const src = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          return { ...i, src };
        }),
      );
      const url = URL.createObjectURL(
        new Blob([exportHTML(document, images, turns)], {
          type: "text/html;charset=utf-8",
        }),
      );
      const anchor = globalThis.document.createElement("a");
      anchor.href = url;
      anchor.download = "rental-helper-brief.html";
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      $("#shareStatus").textContent = "HTMLファイルを保存しました。";
    } catch (error) {
      $("#shareStatus").textContent =
        error.message || "ファイルを作れませんでした。";
    } finally {
      busy = false;
      $("#exportBrief").disabled = false;
    }
  });
  $("#createShare").addEventListener("click", async () => {
    if (busy) return;
    busy = true;
    $("#createShare").disabled = true;
    const document = brief();
    try {
      const created = await post(
        "shares",
        { brief: document, expiresInDays: Number($("#shareDays").value) },
        { signal: AbortSignal.timeout(20000) },
      );
      const url = new URL("share.html", location.href);
      url.hash = created.token;
      const item = { ...created, url: url.href };
      let saved = true;
      try {
        localStorage.setItem(OWNER_KEY, JSON.stringify([...owners(), item]));
      } catch {
        saved = false;
      }
      ownerLinks();
      $("#shareStatus").textContent =
        "作成時のプレビュー内容を共有しました。画像・会話はリンクには含まれません。";
      if (!saved) {
        $("#shareLinks").innerHTML =
          `<p><a href="${e(url.href)}">共有リンク</a></p><button class="button" id="revokeUnsavedShare">このリンクを削除</button>`;
        $("#shareStatus").textContent =
          "削除用情報を保存できません。このタブを閉じる前に削除してください。";
        $("#revokeUnsavedShare").onclick = async () => {
          await post("shares/revoke", {
            token: item.token,
            deleteSecret: item.deleteSecret,
          });
          $("#shareLinks").innerHTML = "";
          $("#shareStatus").textContent = "共有を削除しました。";
        };
      }
    } catch (error) {
      $("#shareStatus").textContent = error.message;
    } finally {
      busy = false;
      $("#createShare").disabled = false;
    }
  });
  $("#shareLinks").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-revoke-share]");
    if (!button || busy) return;
    const items = owners(),
      item = items[Number(button.dataset.revokeShare)];
    if (!item) return;
    button.disabled = true;
    busy = true;
    try {
      await post(
        "shares/revoke",
        { token: item.token, deleteSecret: item.deleteSecret },
        { signal: AbortSignal.timeout(20000) },
      );
      localStorage.setItem(
        OWNER_KEY,
        JSON.stringify(items.filter((o) => o.token !== item.token)),
      );
      ownerLinks();
      $("#shareStatus").textContent = "共有リンクを削除しました。";
    } catch (error) {
      $("#shareStatus").textContent = error.message;
      button.disabled = false;
    } finally {
      busy = false;
    }
  });
  store.on("change", render);
  store.on("advisor", render);
  store.on("context-updated", render);
  render();
  ownerLinks();
}
