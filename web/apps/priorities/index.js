import { $, escapeHTML, yen } from "../../helper.js";
import { PRIORITIES, LEVELS, assessCandidate, findTradeoff, formatPriority } from "./services.js";
import { candidateAnalysis, discoveryQuestions } from "./discovery.js";

import { visibleCandidates, contextualQuestion, perspectiveOf } from "../workspace/services.js";

export function initApp(app) {
  const { store } = app.extensions;
  // Tentative choices stay local until the tenant confirms their importance.
  let tentative = null;
  let responses = {};
  let lastVersion = store.state.sheetsVersion;
  let currentQuestion = null;

  const render = () => {
    const { priorities, settings, sheetsVersion, workspace } = store.state;
    const properties = visibleCandidates(store.state.properties, workspace);
    const perspective = perspectiveOf(workspace);
    if (sheetsVersion !== lastVersion) {
      tentative = null;
      lastVersion = sheetsVersion;
      $("#priorityStatus").textContent = "候補の情報を更新しました。確認済みの希望は残し、分析を見直しています。";
    }
    const analysis = candidateAnalysis(properties, settings);
    const questions = discoveryQuestions(analysis);
    currentQuestion = contextualQuestion(questions, priorities, responses, workspace);
    $("#discoveryEmpty").hidden = properties.length > 0;
    $("#discoveryContent").hidden = properties.length === 0;
    $("#analysisSummary").textContent = `表示中の${properties.length}件から、${perspective.label}の希望を考えます。`;
    $("#candidateInsights").innerHTML = analysis.dimensions.map((dimension) => {
      const { key, label, values, entries, missing } = dimension;
      const range = values.length ? `${formatPriority(key, values[0])}${values.length > 1 ? `〜${formatPriority(key, values.at(-1))}` : ""}` : "まだ判断できません";
      return `<article class="insight"><h3>${label.replace("の上限", "の違い")}</h3><p class="insight-value">${range}</p><p>${entries.length}件の確認できる値${missing ? `・${missing}件は未取得／要確認` : ""}</p><details><summary>どの候補の情報？</summary><ul>${entries.map((entry) => `<li>${escapeHTML(entry.name)}：${formatPriority(key, entry.value)}</li>`).join("")}</ul></details></article>`;
    }).join("") + `<article class="insight"><h3>入居時の負担</h3><p>${analysis.initial.length ? analysis.initial.map((entry) => `${escapeHTML(entry.name)}：約${yen(entry.amount)}`).join("<br>") : "費用項目が足りず、総額は未確定です"}</p><p>初期費用の概算。未取得の費用は比較表で確認できます。</p></article>
    <article class="insight"><h3>候補に見られる設備</h3><p>${analysis.equipment.length ? analysis.equipment.slice(0, 4).map((item) => `${escapeHTML(item.label)}（${item.names.length}件）`).join("・") : "設備の記載はまだ確認できません"}</p><p>気になる設備かどうかは、この後で選べます。</p></article>
    <article class="insight"><h3>契約・内見で気をつけたい点</h3><p>${analysis.clauses.length ? [...new Set(analysis.clauses.map((item) => item.title))].slice(0, 4).map(escapeHTML).join("・") : "契約条件は未確認です"}</p><p>「契約前に考えておきたいこと」で、暮らしへの影響を確認しましょう。</p></article>`;

    const confirmed = PRIORITIES.filter(({ key }) => priorities[key].level !== "later");
    const notes = priorities.notes ?? [];
    $("#discoveredPriorities").innerHTML = confirmed.length ? confirmed.map(({ key, label }) => `<li>${label}：${formatPriority(key, priorities[key].value)}${key === "area" ? "以上" : "以下"} · ${LEVELS[priorities[key].level]} <button class="link-button" data-reconsider="${key}" type="button">考え直す</button></li>`).join("") : notes.length ? "" : "<li>まだ希望は決めていません。次の質問から一緒に絞りましょう。</li>";
    const progress = confirmed.length + questions.filter((question) => responses[question.key] === question.fingerprint && priorities[question.key].level === "later").length;
    $("#discoveryProgress").textContent = notes.length ? `${confirmed.length + notes.length}件の希望を確認` : `${Math.min(progress, questions.length)} / ${questions.length} の視点を確認`;
    if (tentative && (!currentQuestion || currentQuestion.fingerprint !== tentative.fingerprint)) tentative = null;
    const question = currentQuestion;
    $("#discoveryQuestion").innerHTML = question ? `<p class="question-evidence">${escapeHTML(question.evidence)}</p><h3 tabindex="-1" id="discoveryPrompt">${tentative ? `${formatPriority(question.key, tentative.value)}${question.key === "area" ? "以上" : "以下"}は、どのくらい大切ですか？` : question.question}</h3><div class="discovery-options">${tentative ? `<button class="button" data-importance="must" type="button">譲れない条件にしたい</button><button class="button" data-importance="prefer" type="button">ほかの魅力次第で柔軟に考えたい</button><button class="button button--text" data-back type="button">選び直す</button>` : question.options.map((option) => `<button class="button" data-threshold="${option.value}" type="button">${option.label}</button>`).join("")}<button class="button button--text" data-skip type="button">まだ決められない・別の条件次第</button></div><p class="section-hint">${question.key === "budget" ? "賃料＋管理費の比較です。その他の月額費用は含みません。" : question.key === "walk" ? "掲載の駅徒歩です。通勤時間や夜道の歩きやすさはまだ確認できません。" : "掲載面積の比較です。家具の置きやすさや生活動線は間取り・内見で確認しましょう。"}</p>` : `<h3 tabindex="-1" id="discoveryPrompt">${workspace.dimension === "living" ? "暮らし方に関わる違いは？" : perspective.priority && priorities[perspective.priority].level !== "later" ? "この視点の希望を確認しました" : "次の手がかりを探しましょう"}</h3><p>${workspace.dimension === "living" ? "設備や契約条件を見ながら、気になるものを選びましょう。AIと一緒に、暮らしへの影響を考えることもできます。" : "ほかの視点に切り替えて比較できます。情報が足りない候補は「候補の管理」から補完できます。"}</p>${questions.some(q => responses[q.key] === q.fingerprint) ? '<button class="button" data-revisit type="button">保留した質問をもう一度見る</button>' : ""}`;

    const labels = { fits: "確認した希望に合う", conflict: "譲れない条件と合わない", tradeoff: "希望との違い", unknown: "確認が必要" };
    $("#fitCards").innerHTML = properties.map((property) => {
      const assessments = assessCandidate(property, priorities).filter(item => workspace.dimension === "all" || item.key === perspective.priority);
      return `<article class="fit-card"><h3>${escapeHTML(property.name)}</h3>${assessments.length ? `<ul>${assessments.map((item) => `<li class="fit-${item.status}"><strong>${labels[item.status]}</strong> · ${item.label}<br>${item.value == null ? "情報が足りないため判断できません" : `${formatPriority(item.key, item.value)} ／ ${LEVELS[item.level]} ${formatPriority(item.key, item.limit)}${item.key === "area" ? "以上" : "以下"}`}</li>`).join("")}</ul>` : '<p>質問への回答に合わせて、この候補との合い方を整理します。</p>'}</article>`;
    }).join("");
    $("#fitSummary").hidden = !properties.length || !confirmed.some(item => workspace.dimension === "all" || item.key === perspective.priority);
    const tradeoff = findTradeoff(properties);
    $("#tradeoff").innerHTML = tradeoff ? `<h3>費用と駅への近さ、どちらが気になりますか？</h3><p>${escapeHTML(tradeoff.cheaper.name)}は${escapeHTML(tradeoff.closer.name)}より月額が${yen(tradeoff.saving)}低く、駅までの徒歩は${tradeoff.extraWalk}分長くなります。</p><p class="section-hint">ほかの違いもあるため、この2点だけで物件を決める必要はありません。</p><div class="aspect-chips">${[["budget", "月額を抑えたい"], ["walk", "駅への近さを重視"], ["later", "まだ決められない"]].map(([key, label]) => `<button class="aspect-chip" type="button" data-focus="${key}" aria-pressed="${priorities.focus === key}">${label}</button>`).join("")}</div>` : '<p>候補が増え、月額と駅徒歩が分かると、具体的なトレードオフを比較できます。</p>';
  };

  $("#discoveryQuestion").addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.hasAttribute("data-revisit")) responses = {};
    else if (!currentQuestion) return;
    else if (button.hasAttribute("data-threshold")) tentative = { value: Number(button.dataset.threshold), fingerprint: currentQuestion.fingerprint };
    else if (button.hasAttribute("data-back")) tentative = null;
    else if (button.hasAttribute("data-skip")) {
      const key = currentQuestion.key;
      responses[key] = currentQuestion.fingerprint;
      tentative = null;
      store.setPriorities({ ...store.state.priorities, pending: [...new Set([...(store.state.priorities.pending ?? []), key])] });
      $("#discoveryPrompt")?.focus();
      return;
    }
    else if (button.dataset.importance && tentative) {
      const key = currentQuestion.key;
      const choice = { value: tentative.value, level: button.dataset.importance };
      tentative = null;
      store.setPriorities({ ...store.state.priorities, [key]: choice, pending: (store.state.priorities.pending ?? []).filter((item) => item !== key) });
      $("#priorityStatus").textContent = "回答から希望条件を更新しました。比較とメモに反映しています。";
      $("#discoveryPrompt")?.focus();
      return;
    }
    render();
    $("#discoveryPrompt")?.focus();
  });
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-reconsider]");
    if (!button) return;
    const key = button.dataset.reconsider;
    if (!PRIORITIES.some(item => item.key === key)) return;
    delete responses[key];
    tentative = null;
    store.setPriorities({ ...store.state.priorities, [key]: { level: "later", value: null } });
    store.setWorkspace({ dimension: { budget: "cost", area: "space", walk: "access" }[key] });
    store.emit("open-guide");
    $("#discoveryPrompt")?.focus();
  });
  $("#tradeoff").addEventListener("click", (event) => {
    const button = event.target.closest("[data-focus]");
    if (!button) return;
    store.setPriorities({ ...store.state.priorities, focus: button.dataset.focus });
    $(`#tradeoff [data-focus="${button.dataset.focus}"]`)?.focus();
  });
  store.on("change", render);
  store.on("workspace", render);
  render();
}
