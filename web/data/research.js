// Recorded public listing, inspected on 2026-09-22. A building-level reference,
// never a confirmed price for the brochure's unspecified room. Live research can refresh it.
const source = {
  url: "https://www.homes.co.jp/chintai/b-1525240063688/",
  title: "LIFULL HOME’S · GRANPASEO明大前IV 102号室",
  text: "GRANPASEO明大前IV 102号室。東京都世田谷区羽根木２丁目28-19。1階、1K、21.74㎡。賃料11.3万円、管理費等10,000円。情報更新日2026/09/21。",
  retrievedAt: "2026-09-22", listingDate: "2026-09-21", status: "current",
};
export const RECORDED_MONTHLY_RESEARCH = [{
  name: "GRAN PASEO明大前Ⅳ", address: "東京都世田谷区羽根木2-28-19",
  result: {
    retrievedAt: source.retrievedAt, searchSuggestions: "",
    message: "同じ建物の102号室の募集を確認しました。図面に部屋番号がないため参考価格として表示しています。",
    listings: [{ name: "GRANPASEO明大前IV", address: "東京都世田谷区羽根木2-28-19", room: "102", scope: "unit", match: "same_building", identityVerified: true,
      facts: Object.entries({ rent: 113000, managementFee: 10000, layout: "1K", areaSqm: 21.74 }).map(([key, value]) => ({ key, value, eligible: false, reason: "同じ建物ですが、候補の部屋番号が未確認です", source })),
    }],
  },
}];
