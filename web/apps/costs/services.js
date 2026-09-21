// Move-in cost estimate (≈ services.py). Pure functions, unit-tested in web/tests. The estimate adds
// the sheet's money terms (property.costs, each traced to the sheet) to what sheets never print:
// the brokerage fee and the rent paid in advance. It is a guide for comparing candidates, not a quote.
import { TAX_RATE } from "./models.js";

const withTax = (amount) => Math.round(amount * (1 + TAX_RATE));
// Terms the estimate places itself (in the first rows, or as renewal and move-out information).
const PLACED_KINDS = ["deposit", "keyMoney", "freeRent", "renewal", "amortization"];

/** Days from the move-in date to the end of its month (inclusive), and the month's length. */
export function proratedDays(moveIn) {
  const [year, month, day] = moveIn.split("-").map(Number);
  const length = new Date(year, month, 0).getDate();
  return { days: length - day + 1, length };
}

/** About a month ahead (YYYY-MM-DD): the default move-in date. */
export function defaultMoveIn(today = new Date()) {
  const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30);
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()].map((part) => String(part).padStart(2, "0")).join("-");
}

/** A term in yen: months are of rent, percents are of rent plus fee, and 税別 amounts get 10% added. */
function termAmount(cost, rent, monthly) {
  if (cost.amount === 0) return 0; // なし is 0 whatever the rent
  if (cost.unit === "yen") return cost.taxExcluded ? withTax(cost.amount) : cost.amount;
  if (cost.unit === "percent") return monthly == null ? null : Math.round((monthly * cost.amount) / 100);
  return rent == null ? null : Math.round(rent * cost.amount);
}

const find = (costs, kind, timing) => costs.find((cost) => cost.kind === kind && cost.timing === timing);

function termNote(cost) {
  if (cost.required === false) return "任意の項目です（状況に合わせて含めてください）";
  if (cost.required == null) return "必須かどうか図面からは分かりません";
  return cost.taxExcluded ? "税別の表記に消費税10%を加えています" : "";
}

/**
 * The estimate for one candidate.
 * @param property   candidate with rent, managementFee, and costs (the sheet's money terms)
 * @param settings   { moveIn: "YYYY-MM-DD", brokerageMonths: 0 | 0.5 | 1 }
 * @param adjustment { rentOverride, toggled } what the person changed: an assumed rent when the sheet
 *                   prints none, and the keys of rows switched away from their default
 * @returns rows per phase (initial, monthly, yearly, renewal, moveOut) and totals; a total is
 *          complete only when every included row has an amount
 */
export function estimateCosts(property, { moveIn, brokerageMonths }, { rentOverride = null, toggled = [] } = {}) {
  const costs = property.costs ?? [];
  const rent = property.rent ?? rentOverride ?? null;
  const monthly = rent == null ? null : rent + (property.managementFee ?? 0);
  const freeMonths = find(costs, "freeRent", "initial")?.amount ?? 0;
  const { days, length } = proratedDays(moveIn);
  const rows = { initial: [], monthly: [], yearly: [], renewal: [], moveOut: [] };
  const push = (phase, { toggleable = false, included = true, ...row }) =>
    rows[phase].push({ cost: null, note: "", ...row, toggleable, included: toggleable && toggled.includes(row.key) ? !included : included });

  // Paid at contract.
  for (const [kind, name] of [["deposit", "敷金"], ["keyMoney", "礼金"]]) {
    const cost = find(costs, kind, "initial");
    push("initial", {
      key: kind,
      label: cost ? `${name} ${cost.amount}ヶ月` : name,
      amount: cost ? termAmount(cost, rent, monthly) : null,
      source: "sheet",
      cost,
      note: cost ? "" : "図面に記載がありません",
    });
  }
  const free = (months) => (freeMonths >= months ? `フリーレント（${freeMonths}ヶ月）の対象として0円。適用範囲は契約書で確認してください` : "");
  push("initial", {
    key: "prorated",
    label: `日割り家賃（入居月の${days}日分）`,
    amount: freeMonths >= 1 ? 0 : monthly == null ? null : Math.round((monthly * days) / length),
    source: "practice",
    note: free(1),
  });
  push("initial", { key: "prepaid", label: "前家賃（翌月分）", amount: freeMonths >= 2 ? 0 : monthly, source: "practice", note: free(2) });
  push("initial", {
    key: "brokerage",
    label: `仲介手数料（${brokerageMonths}ヶ月＋税）`,
    amount: rent == null ? null : withTax(rent * brokerageMonths),
    source: "choice",
    note: "図面には載りません。借主の負担は、承諾がなければ0.5ヶ月＋税までです",
  });
  costs.forEach((cost, index) => {
    if (PLACED_KINDS.includes(cost.kind)) return;
    push(cost.timing, {
      key: `cost-${index}`,
      label: cost.label,
      amount: termAmount(cost, rent, monthly),
      source: "sheet",
      cost,
      note: termNote(cost),
      toggleable: true,
      // Optional items (required: false, such as 駐輪場) start left out; the breakdown lists them.
      included: cost.required !== false,
    });
  });

  // Every month, at renewal, and when leaving.
  rows.monthly.unshift({ key: "rent", label: "家賃＋管理費", amount: monthly, source: "sheet", cost: null, note: "", toggleable: false, included: true });
  const renewal = find(costs, "renewal", "renewal");
  if (renewal) {
    rows.renewal.unshift({ key: "renewal", label: `更新料 ${renewal.amount}ヶ月`, amount: termAmount(renewal, rent, monthly), source: "sheet", cost: renewal, note: "", toggleable: false, included: true });
  }
  const amortization = find(costs, "amortization", "moveOut");
  if (amortization) {
    rows.moveOut.unshift({ key: "amortization", label: `敷金の償却 ${amortization.amount}ヶ月（戻らない分）`, amount: termAmount(amortization, rent, monthly), source: "sheet", cost: amortization, note: "", toggleable: false, included: true });
  }

  const total = (phase) => {
    const counted = rows[phase].filter((row) => row.included);
    return { amount: counted.reduce((sum, row) => sum + (row.amount ?? 0), 0), complete: counted.every((row) => row.amount != null) };
  };
  return {
    rows,
    initial: total("initial"),
    monthly: total("monthly"),
    yearly: total("yearly"),
    renewal: total("renewal"),
    moveOut: total("moveOut"),
    rentAssumed: property.rent == null && rentOverride != null,
  };
}
