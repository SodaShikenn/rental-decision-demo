import { $, escapeHTML as e } from "../../helper.js";
import { post } from "../../shared/api.js";
import { sourceLink, saveNote } from "../../shared/maps.js";
import { observation, reviewTopics } from "./services.js";
import { markup, resultsMarkup } from "./views.js";
import { createReviewResearch } from "./research.js";
export function initApp(app) {
  const { store } = app.extensions;
  $("#reviewsMount").innerHTML = markup;
  let result = null,
    active = false,
    lastEntry;
  const property = () =>
    store.state.properties.find((p) => p.id === $("#reviewCandidate").value);
  const research = createReviewResearch({
    request: (input, options) => post("reviews/web", input, options),
    onChange(entry) {
      if (entry === lastEntry) return;
      lastEntry = entry;
      result = entry.data || null;
      $("#reviewSearch").disabled =
        entry.status === "loading" || entry.status === "empty";
      $("#reviewResults").setAttribute(
        "aria-busy",
        String(entry.status === "loading"),
      );
      $("#reviewStatus").textContent = {
        empty: "まず、比較したい候補を追加してください。",
        loading:
          "公開の口コミを検索しています。建物名・住所と出典を照合するため、少し時間がかかります…",
        ready:
          "検索が完了しました。投稿の内容と、自分で確かめたことを分けて考えましょう。",
        error: entry.message,
      }[entry.status];
      $("#reviewResults").innerHTML = result ? resultsMarkup(result) : "";
      $("#reviewSuggestions").replaceChildren();
      if (result?.searchSuggestions) {
        const frame = document.createElement("iframe");
        frame.title = "Google 検索の関連候補";
        frame.setAttribute(
          "sandbox",
          "allow-popups allow-popups-to-escape-sandbox",
        );
        frame.referrerPolicy = "no-referrer";
        frame.srcdoc = result.searchSuggestions;
        $("#reviewSuggestions").append(frame);
      }
      const p = property();
      $("#reviewExternal").innerHTML = p
        ? sourceLink(
            `https://www.google.com/search?q=${encodeURIComponent(`${p.name} ${p.address || ""} 口コミ`)}`,
            "自分でもネットの口コミを探す",
          )
        : "";
    },
  });
  function renderOwn() {
    const p = property();
    $("#ownObservations").innerHTML = (store.state.observations || [])
      .filter((o) => o.candidateId === p?.id)
      .map(
        (o) =>
          `<article class="review-entry"><h4>自分の内見記録 · ${e(o.date)}</h4><p>${e(o.text)}</p><button class="link-button" data-remove-observation="${e(o.id)}">この記録を削除</button></article>`,
      )
      .join("");
  }
  function render() {
    const select = $("#reviewCandidate"),
      old = select.value;
    select.innerHTML = store.state.properties
      .map((p) => `<option value="${e(p.id)}">${e(p.name)}</option>`)
      .join("");
    if (store.state.properties.some((p) => p.id === old)) select.value = old;
    renderOwn();
    if (active) research.select(property());
  }
  $("#reviewCandidate").addEventListener("change", render);
  $("#reviewSearch").addEventListener("click", () =>
    research.select(property(), { force: true }),
  );
  store.on("view", (view) => {
    active = view === "reviews";
    if (active) research.select(property());
  });
  $("#reviewResults").addEventListener("click", (event) => {
    const b = event.target.closest("[data-review-topic]");
    if (!b || !result) return;
    const topic = reviewTopics(result.reviews).find(
      (t) => t.key === b.dataset.reviewTopic,
    );
    if (topic) {
      saveNote(
        store,
        `${property().name}の内見で確認：${topic.question}`,
        "later",
        `review-check:${property().id}:${topic.key}`,
      );
      $("#reviewStatus").textContent =
        "投稿を事実として断定せず、内見での確認事項に加えました。";
    }
  });
  $("#observationForm [name=date]").value = new Date(Date.now() + 9 * 3600000)
    .toISOString()
    .slice(0, 10);
  $("#observationForm").addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      const form = Object.fromEntries(new FormData(event.target));
      const entry = observation(property()?.id, form.text, form.date);
      store.setObservations(
        [...(store.state.observations || []), entry].slice(-100),
      );
      $("#observationForm [name=text]").value = "";
      $("#reviewStatus").textContent = "自分の内見記録を保存しました。";
    } catch (error) {
      $("#reviewStatus").textContent = error.message;
    }
  });
  $("#ownObservations").addEventListener("click", (event) => {
    const b = event.target.closest("[data-remove-observation]");
    if (b)
      store.setObservations(
        store.state.observations.filter(
          (o) => o.id !== b.dataset.removeObservation,
        ),
      );
  });
  store.on("change", render);
  render();
}
