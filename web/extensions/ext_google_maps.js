// Google Maps JavaScript API (optional). Without a browser-restricted key in env.js,
// the mock map in index.html stays in place.
import { GOOGLE_MAPS_API_KEY } from "../config.js";
import { $ } from "../helper.js";

const DESTINATION = { lat: 35.6688, lng: 139.7595, title: "虎ノ門ヒルズ" };
const CANDIDATE_PINS = [[35.6824, 139.798, "1"], [35.620, 139.704, "2"], [35.705, 139.649, "3"]];

function renderMap(note) {
  const target = document.createElement("div");
  target.id = "googleMap";
  target.style.cssText = "height:100%;width:100%;";
  $("#mockMap").replaceWith(target);
  const map = new google.maps.Map(target, { center: { lat: 35.673, lng: 139.785 }, zoom: 11, disableDefaultUI: true, zoomControl: true, styles: [{ featureType: "poi", stylers: [{ visibility: "off" }] }] });
  new google.maps.Marker({ map, position: DESTINATION, label: "⌖", title: DESTINATION.title });
  CANDIDATE_PINS.forEach(([lat, lng, label]) => new google.maps.Marker({ map, position: { lat, lng }, label }));
  $("#mapOverlay").style.display = "none";
  note.textContent = "Google Maps を表示中。経路・施設データを有効にするには、別途APIを有効化してください。";
}

export function initApp() {
  const note = $("#mapApiNote");
  $("#connectMaps").addEventListener("click", () => {
    note.textContent = "web/env.example.js を参考に web/env.js へブラウザ制限済みの Google Maps API キーを設定してください。";
  });
  if (!GOOGLE_MAPS_API_KEY) {
    note.textContent = "env.js にブラウザ制限済みのキーを設定すると、Google Maps を読み込みます。";
    return;
  }
  const script = document.createElement("script");
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&callback=loadRentalMap`;
  script.async = true;
  script.onerror = () => {
    note.textContent = "Google Maps を読み込めなかったため、デモ用マップを表示しています。";
  };
  window.loadRentalMap = () => renderMap(note);
  document.head.append(script);
}
