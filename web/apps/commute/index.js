import { $, escapeHTML as e } from "../../helper.js";
import { post } from "../../shared/api.js";
import {
  candidateFingerprint,
  sourceLink,
  mapsCredit,
  saveNote,
} from "../../shared/maps.js";
import { commuteInput, commutePreference, OBJECTIVES } from "./services.js";
import {
  DESTINATIONS,
  suggestedDestination,
  matchingDestination,
  defaultSchedule,
} from "./destinations.js";
import { markup, resultsMarkup } from "./views.js";

export function initApp(app) {
  const { store } = app.extensions;
  $("#commuteMount").innerHTML = markup;
  let destination = null,
    choices = [],
    result = null,
    tentative = null,
    controller,
    searchController,
    generation = 0,
    searchGeneration = 0;
  let candidates = candidateFingerprint(store.state);
  app.extensions.commuteObservation = () => result;
  app.extensions.workDestination = () =>
    destination ? `${destination.name} · ${destination.address}` : "";
  const invalidate = () => {
    ++generation;
    controller?.abort();
    result = null;
    tentative = null;
    $("#commuteResults").innerHTML = "";
    $("#commuteForm button").disabled = false;
    store.emit("context-updated");
  };
  const resetDestination = () => {
    ++searchGeneration;
    searchController?.abort();
    destination = null;
    choices = [];
    $("#destinationChoices").innerHTML = "";
    $("#destinationConfirmed").textContent = "";
    $("#destinationForm button").disabled = false;
    invalidate();
  };
  let presetTouched = false;
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
        .join("") + '<option value="custom">その他の駅・勤務先を探す</option>';
    $("#destinationPreset").value = presetTouched
      ? previous
      : suggested?.key || "custom";
    $("#destinationForm").hidden = $("#destinationPreset").value !== "custom";
    $("#destinationSuggestion").textContent = suggested
      ? `候補の所在地を参考に${suggested.name}を先頭に表示しています。所要時間順ではありません。`
      : "東京の主な駅を選ぶか、勤務先を検索できます。";
  }
  renderDestinations();
  $("#destinationPreset").addEventListener("change", () => {
    presetTouched = true;
    resetDestination();
    $("#destinationForm").hidden = $("#destinationPreset").value !== "custom";
    $("#commuteStatus").textContent =
      "目的地を変えました。朝・夕の通勤を比較できます。";
  });
  $("#destinationQuery").addEventListener("input", resetDestination);
  function confirmDestination(place) {
    destination = place;
    $("#destinationChoices").innerHTML = "";
    $("#destinationConfirmed").innerHTML =
      `${mapsCredit} · ${sourceLink(place.url, place.name)} · ${e(place.address)}`;
  }
  async function searchDestination(hub = null) {
    const id = ++searchGeneration;
    searchController?.abort();
    const request = new AbortController();
    searchController = request;
    const timer = setTimeout(() => request.abort(), 30000);
    $("#destinationForm button").disabled = true;
    $("#commuteStatus").textContent = "Google Maps で目的地を確認しています…";
    try {
      const data = await post(
        "destinations",
        {
          query: hub
            ? `東京都 ${hub.name}`
            : $("#destinationQuery").value.trim(),
        },
        { signal: request.signal },
      );
      if (id !== searchGeneration) return null;
      choices = data.places;
      const exact = hub && matchingDestination(choices, hub);
      if (exact) {
        confirmDestination(exact);
        return exact;
      }
      $("#destinationChoices").innerHTML =
        `<p>${mapsCredit} · 場所と住所を確認して選んでください。</p>${choices.map((p, i) => `<div class="place-choice"><button class="button" data-destination="${i}">${e(p.name)}<br>${e(p.address)}</button>${sourceLink(p.url)}</div>`).join("")}`;
      $("#commuteStatus").textContent = choices.length
        ? "目的地の地点を選ぶと比較できます。"
        : "目的地が見つかりません。住所や駅名で試してください。";
      return null;
    } finally {
      clearTimeout(timer);
      if (id === searchGeneration)
        $("#destinationForm button").disabled = false;
    }
  }
  $("#destinationForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    resetDestination();
    const id = generation;
    try {
      await searchDestination();
    } catch (error) {
      if (id === generation)
        $("#commuteStatus").textContent =
          error.name === "AbortError"
            ? "検索がタイムアウトしました。"
            : error.message;
    }
  });
  $("#destinationChoices").addEventListener("click", (event) => {
    const b = event.target.closest("[data-destination]");
    if (!b) return;
    invalidate();
    confirmDestination(choices[Number(b.dataset.destination)]);
    if ($("#destinationPreset").value !== "custom")
      $("#commuteForm").requestSubmit();
  });
  const defaults = defaultSchedule();
  for (const [name, value] of Object.entries(defaults))
    $("#commuteForm [name=" + name + "]").value = value;
  $("#commuteForm").addEventListener("input", () => {
    invalidate();
    $("#commuteCoverage").hidden =
      $("#commuteForm [name=mode]").value !== "TRANSIT";
    $("#commuteStatus").textContent =
      "条件を変えました。もう一度比較してください。";
  });
  $("#commuteForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    invalidate();
    const id = generation;
    try {
      $("#commuteForm button").disabled = true;
      const hub = DESTINATIONS.find(
        (h) => h.key === $("#destinationPreset").value,
      );
      if (!destination && hub) {
        await searchDestination(hub);
        if (id !== generation || !destination) return;
      }
      const input = commuteInput(
        store.state,
        destination?.id,
        Object.fromEntries(new FormData(event.currentTarget)),
      );
      controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 90000);
      $("#commuteForm button").disabled = true;
      $("#commuteStatus").textContent = "全候補を同じ条件で調べています…";
      try {
        const data = await post("commutes", input, {
          signal: controller.signal,
        });
        if (id !== generation) return;
        result = data;
        $("#commuteResults").innerHTML = resultsMarkup(data);
        $("#commuteStatus").textContent = data.candidates.some(
          (c) => c.routes.length || c.returnTrip?.routes.length,
        )
          ? "取得した朝・夕の経路を比較できます。"
          : "経路は未取得です。各候補の地図リンクから確認できます。";
        store.emit("context-updated");
      } finally {
        clearTimeout(timer);
      }
    } catch (error) {
      if (id === generation)
        $("#commuteStatus").textContent =
          error.name === "AbortError"
            ? "確認がタイムアウトしました。"
            : error.message;
    } finally {
      if (id === generation) $("#commuteForm button").disabled = false;
    }
  });
  $("#commuteResults").addEventListener("click", (event) => {
    const choice = event.target.closest("[data-commute-choice]");
    if (choice) {
      tentative = choice.dataset.commuteChoice;
      $("#commuteConfirm").innerHTML =
        tentative === "later"
          ? "<p>今は決めずに、ほかの条件も比べましょう。</p>"
          : `<p>「${OBJECTIVES[tentative]}」を希望に加えますか？</p><button class="button" data-commute-level="must">必須として確認</button> <button class="button" data-commute-level="prefer">できればとして確認</button>`;
      return;
    }
    const level = event.target.closest("[data-commute-level]");
    if (!level || !result || !OBJECTIVES[tentative]) return;
    const note = commutePreference(
      result,
      tentative,
      level.dataset.commuteLevel,
    );
    saveNote(store, note.text, note.level, note.source, note.details);
    $("#commuteConfirm").textContent = "希望と条件メモに反映しました。";
  });
  store.on("change", () => {
    const next = candidateFingerprint(store.state);
    if (next !== candidates) {
      candidates = next;
      resetDestination();
      renderDestinations();
      $("#commuteStatus").textContent =
        "候補が変わりました。再確認してください。";
    }
  });
}
