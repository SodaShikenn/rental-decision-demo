import { $, escapeHTML as e } from "../../helper.js";
import { perspectiveOf, normalizePair, replacePair } from "./services.js";
import { PRIORITIES, LEVELS, formatPriority } from "../priorities/services.js";
import { VIEWS, resolveView, isWorkspaceTarget } from "./navigation.js";
import {
  navigationMarkup,
  switcherMarkup,
  headingMarkup,
  helpMarkup,
  candidatesMarkup,
} from "./navigation-views.js";

export function initApp(app) {
  const { store } = app.extensions;
  const mobile = matchMedia("(max-width: 760px)");
  $("#workspaceTabs").innerHTML = navigationMarkup();
  $("#workspaceSelect").innerHTML = switcherMarkup();
  VIEWS.filter((entry) => entry.title).forEach((entry) => {
    document.querySelector(`[data-view-heading="${entry.key}"]`).innerHTML =
      headingMarkup(entry);
    document.querySelector(`[data-view-help="${entry.key}"]`).innerHTML =
      helpMarkup(entry);
  });
  const tabs = [...document.querySelectorAll("[data-workspace-tab]")];
  const panels = [...document.querySelectorAll("[data-workspace-panel]")];
  const perspectiveTabs = [...document.querySelectorAll("[data-perspective]")];
  const guideTabs = [...document.querySelectorAll("[data-guide-mode]")];
  const dialog = $("#guideDialog"),
    content = $("#guideContent");
  let view = "compare";
  function guideMode(mode) {
    guideTabs.forEach((tab) => {
      const selected = tab.dataset.guideMode === mode;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    $("#numericGuide").hidden = mode !== "numeric";
    $("#aiGuide").hidden = mode !== "ai";
  }
  function openGuide() {
    if (mobile.matches) {
      dialog.append(content);
      if (!dialog.open) dialog.showModal();
      document.body.classList.add("guide-open");
      $("#guideClose").focus();
    } else {
      $("#guidePanel").scrollIntoView({ block: "nearest" });
      $("#guideTitle").tabIndex = -1;
      $("#guideTitle").focus({ preventScroll: true });
    }
  }
  function closeGuide() {
    if (dialog.open) dialog.close();
  }
  // Keep content in a closing mobile sheet for its CSS exit transition. On desktop it
  // belongs in the inspector, including when resizing an already closed sheet.
  dialog.addEventListener("close", () => {
    if (!mobile.matches) $("#guidePanel").append(content);
    document.body.classList.remove("guide-open");
    if (mobile.matches && view === "compare") $("#guideOpen").focus();
  });
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (
      event.clientY < r.top ||
      event.clientX < r.left ||
      event.clientX > r.right
    )
      closeGuide();
  });
  $("#guideOpen").addEventListener("click", openGuide);
  $("#guideClose").addEventListener("click", closeGuide);
  function show(name, { focus = false, updateUrl = true } = {}) {
    view = resolveView(name);
    closeGuide();
    tabs.forEach((tab) => {
      const selected = tab.dataset.workspaceTab === view;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.workspacePanel !== view;
    });
    $("#workspaceSelect").value = view;
    document.title = `${VIEWS.find((entry) => entry.key === view).label} | Rental Helper`;
    if (updateUrl && location.hash !== `#${view}`)
      history.pushState(null, "", `#${view}`);
    if (view === "needs") {
      const memo = $("#memo");
      memo.style.height = "auto";
      memo.style.height = `${memo.scrollHeight + 2}px`;
    }
    if (focus) $(`#panel-${view}`).focus({ preventScroll: true });
  }
  function keyboardTabs(elements, activate) {
    elements.forEach((tab, index) => {
      tab.addEventListener("click", () => activate(tab));
      tab.addEventListener("keydown", (event) => {
        const next =
          event.key === "ArrowRight"
            ? (index + 1) % elements.length
            : event.key === "ArrowLeft"
              ? (index + elements.length - 1) % elements.length
              : event.key === "Home"
                ? 0
                : event.key === "End"
                  ? elements.length - 1
                  : null;
        if (next == null) return;
        event.preventDefault();
        activate(elements[next]);
        elements[next].focus();
      });
    });
  }
  keyboardTabs(tabs, (tab) => {
    show(tab.dataset.workspaceTab);
    requestAnimationFrame(() =>
      window.scrollTo({ top: 0, behavior: "instant" }),
    );
  });
  $("#workspaceSelect").addEventListener("change", (event) => {
    show(event.target.value);
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  keyboardTabs(perspectiveTabs, (tab) =>
    store.setWorkspace({ dimension: tab.dataset.perspective }),
  );
  keyboardTabs(guideTabs, (tab) => guideMode(tab.dataset.guideMode));
  function navigate(target, { updateUrl = true, focus = true } = {}) {
    if (
      isWorkspaceTarget(target) &&
      !["compareTable", "discovery", "fitSummary", "preferences"].includes(
        target,
      )
    ) {
      show(target, { focus, updateUrl });
      window.scrollTo({ top: 0, behavior: "instant" });
      return;
    }
    show("compare", { updateUrl });
    if (target === "preferences") store.setWorkspace({ dimension: "living" });
    if (target === "discovery") {
      openGuide();
      return;
    }
    document.getElementById(target)?.scrollIntoView({ block: "nearest" });
    if (target === "compareTable") $("#compareTable").focus();
  }
  document.addEventListener("click", (event) => {
    const shortcut = event.target.closest("[data-open-feature]");
    if (shortcut) {
      event.preventDefault();
      navigate(shortcut.dataset.openFeature);
      return;
    }
    const anchor = event.target.closest('a[href^="#"]');
    const target = anchor?.getAttribute("href").slice(1);
    if (!isWorkspaceTarget(target)) return;
    event.preventDefault();
    navigate(target);
  });
  // Back/forward restore views without creating another history entry. In-page review
  // links keep their own native anchor behavior instead of switching to comparison.
  window.addEventListener("popstate", () => {
    const target = location.hash.slice(1);
    if (!target || isWorkspaceTarget(target))
      navigate(target || "compare", { updateUrl: false });
  });
  window.addEventListener("hashchange", () => {
    const target = location.hash.slice(1);
    if (isWorkspaceTarget(target) && resolveView(target) !== view)
      navigate(target, { updateUrl: false });
  });
  ["pairFirst", "pairSecond"].forEach((id, slot) =>
    $("#" + id).addEventListener("change", (event) =>
      store.setWorkspace({
        pair: replacePair(
          store.state.properties,
          store.state.workspace.pair,
          slot,
          event.target.value,
        ),
      }),
    ),
  );
  function render() {
    const { properties, priorities, workspace } = store.state;
    const perspective = perspectiveOf(workspace);
    $("#candidateCount").textContent = `${properties.length}件`;
    $("#mobileCandidateCount").textContent = `${properties.length}件`;
    document.querySelectorAll("[data-candidate-scope]").forEach((element) => {
      element.innerHTML = candidatesMarkup(properties);
    });
    $("#contextTitle").textContent = perspective.title;
    $("#contextDescription").textContent = perspective.description;
    $("#comparisonContext").setAttribute(
      "aria-labelledby",
      `perspective-${workspace.dimension}`,
    );
    perspectiveTabs.forEach((tab) => {
      const selected = tab.dataset.perspective === workspace.dimension;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    $("#accessTools").hidden = !["access", "all"].includes(workspace.dimension);
    $("#preferences").hidden = !["living", "all"].includes(workspace.dimension);
    $("#pairPicker").hidden = !workspace.mobile || properties.length < 2;
    const pair = normalizePair(properties, workspace.pair);
    const options = properties
      .map((p) => `<option value="${e(p.id)}">${e(p.name)}</option>`)
      .join("");
    ["pairFirst", "pairSecond"].forEach((id, index) => {
      const select = $("#" + id);
      if (select.innerHTML !== options) select.innerHTML = options;
      select.value = pair[index] ?? "";
    });
    const confirmed = PRIORITIES.filter(
      ({ key }) =>
        priorities[key].level !== "later" && priorities[key].value > 0,
    );
    $("#priorityChips").innerHTML =
      confirmed
        .map(
          ({ key, label }) =>
            `<button type="button" class="priority-pill" data-reconsider="${key}" title="クリックして考え直す" aria-label="${e(label)}の希望を考え直す"><span>${e(LEVELS[priorities[key].level])}</span> ${e(formatPriority(key, priorities[key].value))}${key === "area" ? "以上" : "以下"} <span aria-hidden="true">×</span></button>`,
        )
        .join("") +
      (priorities.notes?.length
        ? `<button class="priority-pill" type="button" data-open-notes>ほかの希望 ${priorities.notes.length}件</button>`
        : "") +
      (!confirmed.length && !priorities.notes?.length
        ? '<span class="priority-empty">まだ決めなくて大丈夫。候補の違いから整理しましょう。</span>'
        : "") +
      (priorities.pending?.length
        ? `<span class="priority-pending">保留 ${priorities.pending.length}件</span>`
        : "");
    $("#mobilePriorityCount").textContent =
      confirmed.length + (priorities.notes?.length ?? 0)
        ? `${confirmed.length + (priorities.notes?.length ?? 0)}件確認`
        : "";
  }
  $("#priorityChips").addEventListener("click", (event) => {
    if (event.target.closest("[data-open-notes]")) openGuide();
  });
  function resized() {
    if (!mobile.matches) {
      closeGuide();
      $("#guidePanel").append(content);
    }
    store.setWorkspace({ mobile: mobile.matches });
  }
  mobile.addEventListener("change", resized);
  store.on("open-guide", () => {
    show("compare");
    guideMode("numeric");
    openGuide();
  });
  store.on("workspace", render);
  store.on("change", render);
  store.on("added", (id) => {
    store.setWorkspace({
      pair: normalizePair(store.state.properties, [
        id,
        ...store.state.workspace.pair,
      ]),
    });
    show("compare");
  });
  resized();
  const initial = location.hash.slice(1);
  if (isWorkspaceTarget(initial))
    navigate(initial, { updateUrl: false, focus: false });
  else show("compare", { updateUrl: false });
}
