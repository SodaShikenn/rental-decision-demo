const properties = [
  {
    id: "kiyosumi",
    name: "清澄白河リバーサイド",
    area: "江東区 / 1LDK / 36.8㎡",
    rent: 129000,
    commute: 31,
    grocery: 4,
    late: 8,
    quiet: 7,
    space: 7,
    weekend: 6,
    route: "清澄白河 → 虎ノ門ヒルズ / 乗換1回",
    tags: ["夜22時までのスーパー", "川沿いの静けさ", "自宅作業向き"],
    tradeoff: "駅まで11分。雨の日の徒歩負担は内見で要確認です。",
    rents: [121, 121, 123, 122, 124, 125, 126, 126, 127, 128, 128, 129],
    reviews: [
      { from: "2024年入居 / 30代", text: "平日夜の買い物がしやすく、在宅勤務の日も過ごしやすい。" },
      { from: "2023年入居 / 20代", text: "川沿いは静かだが、駅からの道は夜に一度確認した方がよい。" },
    ],
  },
  {
    id: "musashi",
    name: "武蔵小山ワークス",
    area: "品川区 / 1DK / 31.2㎡",
    rent: 143000,
    commute: 27,
    grocery: 9,
    late: 9,
    quiet: 5,
    space: 6,
    weekend: 8,
    route: "武蔵小山 → 虎ノ門ヒルズ / 乗換1回",
    tags: ["商店街が近い", "短い通勤", "夜の選択肢が多い"],
    tradeoff: "通勤と買い物は最良ですが、予算を13,000円超えます。",
    rents: [136, 137, 137, 138, 138, 140, 140, 141, 142, 142, 143, 143],
    reviews: [
      { from: "2025年入居 / 20代", text: "帰宅が遅くても食事や日用品に困らない。週末は人通りが多い。" },
      { from: "2023年入居 / 30代", text: "駅周辺は便利。静けさを優先する場合は部屋の向きが重要。" },
    ],
  },
  {
    id: "koenji",
    name: "高円寺サイドノート",
    area: "杉並区 / 1DK / 34.1㎡",
    rent: 116000,
    commute: 45,
    grocery: 8,
    late: 7,
    quiet: 6,
    space: 8,
    weekend: 9,
    route: "高円寺 → 虎ノ門ヒルズ / 乗換2回",
    tags: ["予算に余裕", "作業空間が広い", "週末の外出に便利"],
    tradeoff: "家賃には余裕がありますが、平日朝の通勤時間が長めです。",
    rents: [110, 111, 111, 112, 113, 113, 114, 114, 115, 115, 116, 116],
    reviews: [
      { from: "2024年入居 / 20代", text: "部屋の形が使いやすく、休日に外出する人には便利。" },
      { from: "2022年入居 / 30代", text: "都心通勤は混雑時間を避けられる働き方なら許容しやすい。" },
    ],
  },
];

const state = {
  budget: 130000,
  priorities: new Set(["commute", "late"]),
  weekend: true,
  selectedId: "kiyosumi",
};

const yen = (value) => new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(value);
const byId = (id) => properties.find((property) => property.id === id);

function scoreProperty(property) {
  const budgetScore = property.rent <= state.budget ? 25 : Math.max(0, 25 - (property.rent - state.budget) / 700);
  const commuteValue = Math.max(0, 10 - Math.max(0, property.commute - 20) / 3);
  let score = budgetScore + commuteValue * 1.2;
  state.priorities.forEach((priority) => {
    score += (priority === "commute" ? commuteValue : property[priority]) * 2.5;
  });
  if (state.weekend) score += property.weekend * 0.6;
  return Math.round(Math.min(99, score));
}

function rankedProperties() {
  return [...properties].sort((a, b) => scoreProperty(b) - scoreProperty(a));
}

function renderCandidates() {
  const ranked = rankedProperties();
  const candidateGrid = document.querySelector("#candidateGrid");
  candidateGrid.innerHTML = ranked.map((property, index) => `
    <button type="button" class="candidate ${property.id === state.selectedId ? "selected" : ""}" data-property="${property.id}">
      <span class="candidate-rank">0${index + 1}</span><span class="candidate-score">${scoreProperty(property)} / 99</span>
      <h3>${property.name}</h3>
      <p class="area">${property.area}</p>
      <p class="rent">${yen(property.rent)} <small>/ 月</small></p>
      <div class="candidate-stats">
        <span>通勤<b>${property.commute}分</b></span>
        <span>夜の買い物<b>${property.late}/10</b></span>
      </div>
    </button>
  `).join("");

  candidateGrid.querySelectorAll("[data-property]").forEach((element) => element.addEventListener("click", () => selectProperty(element.dataset.property)));
  document.querySelector("#decisionSummary").textContent = `予算 ${yen(state.budget)} / ${[...state.priorities].map(priorityLabel).join("・")} を優先中`;
}

function priorityLabel(key) {
  return ({ commute: "短い通勤", late: "夜の買い物", quiet: "静けさ", space: "作業空間" })[key];
}

function renderSelected() {
  const property = byId(state.selectedId);
  const activePriorities = [...state.priorities];
  const priorityDetails = activePriorities.map((priority) => {
    if (priority === "commute") return `通勤 ${property.commute}分`;
    if (priority === "late") return `夜の買い物利便性 ${property.late}/10`;
    if (priority === "quiet") return `静けさ ${property.quiet}/10`;
    return `作業空間 ${property.space}/10`;
  }).join("、");
  const priorityNames = activePriorities.map(priorityLabel).join("・");
  document.querySelector("#selectedCard").innerHTML = `
    <p class="eyebrow">CURRENTLY SELECTED / ${String(rankedProperties().findIndex((item) => item.id === property.id) + 1).padStart(2, "0")}</p>
    <h3>${property.name}</h3>
    <p>${property.route}</p>
    <div class="reason-list">
      <div class="reason"><b>FIT</b><span>優先した「${priorityNames}」では、${priorityDetails}です。</span></div>
      <div class="reason"><b>WHY</b><span>${property.tags.join("、")}は、現在の暮らし方と合う要素です。</span></div>
      <div class="reason"><b>CHECK</b><span>${property.tradeoff}</span></div>
    </div>
  `;
  renderChart(property);
  document.querySelector("#chartTitle").textContent = `${property.name}｜掲載賃料の推移`;
  document.querySelector("#reviewCount").textContent = `${property.reviews.length} 件`;
  document.querySelector("#reviews").innerHTML = property.reviews.map((review) => `
    <div class="review"><div class="review-meta"><span>${review.from}</span><span>DEMO</span></div><span>${review.text}</span></div>
  `).join("");
}

function renderChart(property) {
  const values = property.rents;
  const min = Math.min(...values) - 2;
  const max = Math.max(...values) + 2;
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * 100;
    const y = 92 - ((value - min) / (max - min)) * 78;
    return `${x},${y}`;
  }).join(" ");
  document.querySelector("#rentChart").innerHTML = `
    <svg class="chart-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <polyline fill="none" stroke="#195c43" stroke-width="2.4" vector-effect="non-scaling-stroke" points="${points}" />
      <circle cx="100" cy="${points.split(" ").at(-1).split(",")[1]}" r="2.8" fill="#d8f64b" stroke="#195c43" vector-effect="non-scaling-stroke" />
    </svg>`;
}

function selectProperty(id) {
  state.selectedId = id;
  renderCandidates();
  renderSelected();
}

function recalculate() {
  const best = rankedProperties()[0];
  state.selectedId = best.id;
  renderCandidates();
  renderSelected();
  addMessage("assistant", `条件を更新しました。<strong>${best.name}</strong>が最有力です。${best.tradeoff}`);
}

function addMessage(role, text) {
  const container = document.querySelector("#messages");
  const item = document.createElement("div");
  item.className = `message ${role}`;
  item.innerHTML = text;
  container.append(item);
  container.scrollTop = container.scrollHeight;
}

function respondToChat(question) {
  const best = rankedProperties()[0];
  const affordable = [...properties].sort((a, b) => a.rent - b.rent)[0];
  const lower = question.toLowerCase();
  if (lower.includes("1万円") || lower.includes("安く")) {
    return `家賃を抑えるなら<strong>${affordable.name}</strong>です。${yen(best.rent - affordable.rent)}安くなりますが、通勤は${affordable.commute - best.commute}分長くなります。`;
  }
  if (lower.includes("買い物") || lower.includes("夜")) {
    const nightBest = [...properties].sort((a, b) => b.late - a.late)[0];
    return `夜の買い物を最優先するなら<strong>${nightBest.name}</strong>です。利便性は${nightBest.late}/10ですが、${nightBest.tradeoff}`;
  }
  if (lower.includes("理由") || lower.includes("なぜ")) {
    return `<strong>${best.name}</strong>は、${priorityLabel([...state.priorities][0])}と${priorityLabel([...state.priorities][1] || "space")}の両方でバランスが良く、予算との差額も小さいためです。`;
  }
  return `現在の条件では<strong>${best.name}</strong>が最有力です。「1万円安くするなら？」「夜の買い物を優先すると？」のように、妥協したい条件を聞いてください。`;
}

function initialiseGoogleMaps() {
  const config = window.RENTAL_DEMO_CONFIG || {};
  const note = document.querySelector("#mapApiNote");
  if (!config.googleMapsApiKey) {
    note.textContent = "config.js にブラウザ制限済みのキーを設定すると、Google Maps を読み込みます。";
    return;
  }
  const script = document.createElement("script");
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(config.googleMapsApiKey)}&callback=loadRentalMap`;
  script.async = true;
  script.onerror = () => { note.textContent = "Google Maps を読み込めなかったため、デモ用マップを表示しています。"; };
  window.loadRentalMap = () => {
    const mockMap = document.querySelector("#mockMap");
    const target = document.createElement("div");
    target.id = "googleMap";
    target.style.cssText = "height:100%;width:100%;";
    mockMap.replaceWith(target);
    const map = new google.maps.Map(target, { center: { lat: 35.673, lng: 139.785 }, zoom: 11, disableDefaultUI: true, zoomControl: true, styles: [{ featureType: "poi", stylers: [{ visibility: "off" }] }] });
    new google.maps.Marker({ map, position: { lat: 35.6688, lng: 139.7595 }, label: "⌖", title: "虎ノ門ヒルズ" });
    [[35.6824, 139.798, "1"], [35.620, 139.704, "2"], [35.705, 139.649, "3"]].forEach(([lat, lng, label]) => new google.maps.Marker({ map, position: { lat, lng }, label }));
    document.querySelector("#mapOverlay").style.display = "none";
    note.textContent = "Google Maps を表示中。経路・施設データを有効にするには、別途APIを有効化してください。";
  };
  document.head.append(script);
}

document.addEventListener("DOMContentLoaded", () => {
  const budget = document.querySelector("#budget");
  budget.addEventListener("input", () => { state.budget = Number(budget.value); document.querySelector("#budgetOutput").value = yen(state.budget); });
  document.querySelector("#priorityChips").addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    const key = button.dataset.priority;
    if (state.priorities.has(key)) state.priorities.delete(key);
    else if (state.priorities.size < 2) state.priorities.add(key);
    document.querySelectorAll(".priority-chip").forEach((chip) => chip.classList.toggle("active", state.priorities.has(chip.dataset.priority)));
  });
  document.querySelector("#weekend").addEventListener("change", (event) => { state.weekend = event.target.checked; });
  document.querySelector("#recalculate").addEventListener("click", recalculate);
  document.querySelectorAll(".map-pin[data-property]").forEach((pin) => pin.addEventListener("click", () => selectProperty(pin.dataset.property)));
  document.querySelector("#connectMaps").addEventListener("click", () => { document.querySelector("#mapApiNote").textContent = "config.example.js を config.js に複製し、ブラウザ制限済みの Google Maps API キーを設定してください。"; });
  document.querySelector("#promptSuggestions").addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    addMessage("user", button.textContent);
    addMessage("assistant", respondToChat(button.textContent));
  });
  document.querySelector("#chatForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const input = document.querySelector("#chatInput");
    const question = input.value.trim();
    if (!question) return;
    addMessage("user", question);
    addMessage("assistant", respondToChat(question));
    input.value = "";
  });
  renderCandidates();
  renderSelected();
  initialiseGoogleMaps();
});
