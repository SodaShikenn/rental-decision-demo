/** Curated Tokyo hubs, not inferred requirements or a ranking of actual journey times. */
export const DESTINATIONS = [
  { key: "shibuya", name: "渋谷駅", areas: ["渋谷区", "世田谷区", "目黒区"] },
  { key: "shinjuku", name: "新宿駅", areas: ["新宿区", "中野区", "杉並区"] },
  { key: "tokyo", name: "東京駅", areas: ["千代田区", "中央区", "江東区"] },
  { key: "otemachi", name: "大手町駅", areas: [] },
  { key: "shinagawa", name: "品川駅", areas: ["品川区", "大田区", "港区"] },
  { key: "ikebukuro", name: "池袋駅", areas: ["豊島区", "板橋区", "練馬区"] },
  { key: "ebisu", name: "恵比寿駅", areas: [] },
  { key: "roppongi", name: "六本木駅", areas: [] },
];
export function suggestedDestination(properties) {
  const scored = DESTINATIONS.map((hub) => ({
    ...hub,
    count: properties.filter((p) =>
      hub.areas.some((area) =>
        `${p.address || ""} ${p.district || ""}`.includes(area),
      ),
    ).length,
  })).sort((a, b) => b.count - a.count);
  return scored[0]?.count ? scored[0] : null;
}
export function matchingDestination(places, hub) {
  const exact = places.filter(
    (p) => p.name === hub.name && p.address?.includes("東京都"),
  );
  // Similar names or multiple station entities need a visible location choice.
  return exact.length === 1 ? exact[0] : null;
}
export function defaultSchedule(now = new Date()) {
  const day = new Date(+now + 9 * 3600000 + 86400000);
  while ([0, 6].includes(day.getUTCDay())) day.setUTCDate(day.getUTCDate() + 1);
  return {
    date: day.toISOString().slice(0, 10),
    morning: "08:00",
    evening: "18:00",
  };
}
