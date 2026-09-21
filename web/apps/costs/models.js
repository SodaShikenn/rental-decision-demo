// Move-in cost vocabulary (≈ models.py). Amounts come from the money terms read off each sheet; what
// sheets leave out (brokerage, prepaid rent) follows common practice and is labelled as such.

export const TAX_RATE = 0.1;

/** Brokerage fee choices, in months of rent before tax. Without consent a renter owes at most 0.5. */
export const BROKERAGE_OPTIONS = [
  { months: 0, label: "なし" },
  { months: 0.5, label: "0.5ヶ月" },
  { months: 1, label: "1ヶ月" },
];

/** Where a row's amount comes from. */
export const SOURCES = {
  sheet: "図面",
  practice: "一般的な慣行",
  choice: "選択",
};

/** Glossary entries for the rows the calculator adds itself. */
export const ROW_TERMS = {
  deposit: "敷金",
  keyMoney: "礼金",
  prorated: "前家賃・日割り家賃",
  prepaid: "前家賃・日割り家賃",
  brokerage: "仲介手数料",
  guarantor: "保証会社（家賃保証会社）",
  freeRent: "フリーレント",
  renewal: "更新料",
  amortization: "敷金償却・敷引き",
};
