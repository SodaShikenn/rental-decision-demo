import { $, escapeHTML as e } from "../../helper.js";
import { post } from "../../shared/api.js";
import { sourceLink, saveNote } from "../../shared/maps.js";
import { reviewTopics } from "./services.js";
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
        loading: "部屋・同じ建物・近隣の順に口コミを調べています…",
        ready: result?.reviews?.length
          ? "出典付きの口コミを取得しました。"
          : "検索済み",
        error: entry.message,
      }[entry.status];
      $("#reviewResults").innerHTML = result ? resultsMarkup(result) : "";
      $("#reviewSuggestions").replaceChildren();
      const suggestions = Array.isArray(result?.searchSuggestions)
        ? result.searchSuggestions
        : result?.searchSuggestions
          ? [result.searchSuggestions]
          : [];
      for (const suggestion of suggestions) {
        const frame = document.createElement("iframe");
        frame.title = "Google 検索の関連候補";
        frame.setAttribute(
          "sandbox",
          "allow-popups allow-popups-to-escape-sandbox",
        );
        frame.referrerPolicy = "no-referrer";
        frame.srcdoc = suggestion;
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
  function render() {
    const select = $("#reviewCandidate"),
      old = select.value;
    select.innerHTML = store.state.properties
      .map((p) => `<option value="${e(p.id)}">${e(p.name)}</option>`)
      .join("");
    if (store.state.properties.some((p) => p.id === old)) select.value = old;
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
  store.on("change", render);
  render();
}
