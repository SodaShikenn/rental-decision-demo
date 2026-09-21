import { $, escapeHTML as e, yen } from "../../helper.js";
import { saveNote } from "../../shared/maps.js";
import { OBJECTIVES } from "../commute/services.js";
import { CATEGORIES } from "../leisure/services.js";
import { scenarioRows } from "./services.js";
export function initApp(app) {
  const { store } = app.extensions;
  $("#scenarioMount").innerHTML =
    `<details class="feature-section" id="scenarioSection"><summary>費用・通勤・余暇の組み合わせを考える</summary><p>全候補を同じ条件で試算します。総合点や自動順位はつけません。</p><form id="scenarioForm" class="inline-form"><label>勤務先へ通う想定<select id="scenarioDays">${[0, 1, 2, 3, 4, 5, 6, 7].map((n) => `<option value="${n}" ${n === 3 ? "selected" : ""}>週${n}日${n === 0 ? "（通勤なし）" : ""}</option>`).join("")}</select></label><button class="button">この頻度を希望として確認</button></form><p id="scenarioStatus" role="status"></p><div id="scenarioResults"></div></details>`;
  const confirmedDays = store.state.priorities.notes?.find(
    (n) => n.source === "scenario",
  )?.details?.daysPerWeek;
  if (
    Number.isInteger(confirmedDays) &&
    confirmedDays >= 0 &&
    confirmedDays <= 7
  )
    $("#scenarioDays").value = String(confirmedDays);
  function render() {
    const commute = app.extensions.commuteObservation?.(),
      leisure = app.extensions.leisureObservation?.();
    const days = Number($("#scenarioDays").value);
    const rows = scenarioRows(store.state, commute, leisure, days);
    $("#scenarioResults").innerHTML =
      `<p class="section-hint">週${days}日の試算。${commute ? "経路は取得済みの特定日時の推定を使用。" : "通勤経路は未取得。"}往路のみを合計し、復路・遅延・定期券は推測しません。</p>${rows.map((r) => `<article class="journey-candidate"><h4>${e(r.name)}</h4><p>月額：${r.monthly == null ? "未確認（参考価格は含めません）" : yen(r.monthly)}</p><p>通勤：${r.route ? `${r.route.minutes}分／片道 · 徒歩${r.route.walkingMinutes ?? "未取得"}分 · 乗換${r.route.transfers ?? "未取得"}回` : "未取得"}<br>週の往路合計：${r.weeklyOutboundMinutes == null ? "未取得" : `${r.weeklyOutboundMinutes}分`}</p><p class="section-hint">経路の比較軸：${OBJECTIVES[r.objective]}（${r.objectiveConfirmed ? "確認した希望" : "今回の試算条件・希望未確認"}）</p>${r.leisure.map((i) => `<p>希望した${CATEGORIES[i.kind] || e(i.kind)}：${i.minutes == null ? "徒歩・営業状態の確認が必要" : `取得した営業施設への徒歩 ${i.minutes}分`}</p>`).join("")}<ul>${r.advantages.map((a) => `<li>${e(a)}</li>`).join("")}${r.gaps.map((g) => `<li>次の確認：${e(g)}</li>`).join("")}</ul><p class="section-hint">${days === 0 ? "通勤なしの想定です。出社が増えれば比較が変わります。" : "頻度や経路、未確認の費用が変わると、この説明も変わります。"}</p></article>`).join("") || "<p>候補を追加して比較できます。</p>"}`;
  }
  $("#scenarioDays").addEventListener("change", () => {
    render();
    $("#scenarioStatus").textContent =
      "試算を変更しました。希望にする場合は確認してください。";
  });
  $("#scenarioForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const days = Number($("#scenarioDays").value);
    saveNote(
      store,
      `勤務先へ通う頻度は週${days}日を想定する。`,
      "prefer",
      "scenario",
      { daysPerWeek: days },
    );
    $("#scenarioStatus").textContent = "想定する頻度を条件メモに反映しました。";
  });
  store.on("change", render);
  store.on("context-updated", render);
  render();
}
