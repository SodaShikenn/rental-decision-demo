import { $ } from "../../helper.js";
import {
  DESTINATIONS,
  suggestedDestination,
  defaultSchedule,
} from "./destinations.js";
import { candidateLinks } from "./links.js";
import { markup, linksMarkup } from "./views.js";

export function initApp(app) {
  const { store } = app.extensions;
  $("#commuteMount").innerHTML = markup;
  let presetTouched = false;
  let destinationTouched = false;
  let candidates;
  // Opening an external map yields no measured routes or confirmed preferences.
  app.extensions.commuteObservation = () => null;
  app.extensions.workDestination = () =>
    destinationTouched ? destination() : "";

  function destination() {
    const hub = DESTINATIONS.find(
      (h) => h.key === $("#destinationPreset").value,
    );
    return hub ? `東京都 ${hub.name}` : $("#destinationQuery").value.trim();
  }
  function renderDestinations() {
    const suggested = suggestedDestination(store.state.properties);
    const previous = $("#destinationPreset").value;
    const ordered = [...DESTINATIONS].sort(
      (a, b) =>
        Number(b.key === suggested?.key) - Number(a.key === suggested?.key),
    );
    $("#destinationPreset").innerHTML =
      ordered
        .map(
          (hub) =>
            `<option value="${hub.key}">${hub.name}${hub.key === suggested?.key ? " · 候補の所在地から" : ""}</option>`,
        )
        .join("") + '<option value="custom">その他の駅・勤務先</option>';
    $("#destinationPreset").value = presetTouched
      ? previous
      : suggested?.key || "custom";
    $("#destinationSuggestion").textContent = suggested
      ? `候補の所在地を参考に${suggested.name}を先頭に表示。所要時間順ではありません。`
      : "東京の主な駅、または勤務先の住所を指定できます。";
  }
  function renderLinks() {
    $("#destinationForm").hidden = $("#destinationPreset").value !== "custom";
    const target = destination();
    const form = Object.fromEntries(new FormData($("#commuteForm")));
    $("#commuteResults").innerHTML = linksMarkup(
      candidateLinks(store.state.properties, target, form.mode),
      target,
    );
    $("#commuteSchedule").textContent =
      form.mode === "walking"
        ? "徒歩経路を開きます。起終点と建物の入口を地図で確認してください。"
        : `地図で設定：${form.date || "日付を選択"}（日本時間） · 行き ${form.morning || "時刻を選択"} 到着 ／ 帰り ${form.evening || "時刻を選択"} 出発`;
    $("#commuteTimeNotice").hidden = form.mode === "walking";
    $("#commuteStatus").textContent = target
      ? ""
      : "目的地を指定すると、各候補の地図リンクが表示されます。";
  }
  for (const [name, value] of Object.entries(defaultSchedule()))
    $("#commuteForm [name=" + name + "]").value = value;
  $("#destinationPreset").addEventListener("change", () => {
    presetTouched = true;
    destinationTouched = true;
    renderLinks();
    store.emit("context-updated");
  });
  $("#destinationQuery").addEventListener("input", () => {
    destinationTouched = true;
    renderLinks();
    store.emit("context-updated");
  });
  $("#destinationForm").addEventListener("submit", (event) =>
    event.preventDefault(),
  );
  $("#commuteForm").addEventListener("submit", (event) =>
    event.preventDefault(),
  );
  $("#commuteForm").addEventListener("input", renderLinks);
  store.on("change", () => {
    const next = JSON.stringify(
      store.state.properties.map(({ id, name, address, district }) => ({
        id,
        name,
        address,
        district,
      })),
    );
    if (next === candidates) return;
    candidates = next;
    renderDestinations();
    renderLinks();
  });
  renderDestinations();
  renderLinks();
}
