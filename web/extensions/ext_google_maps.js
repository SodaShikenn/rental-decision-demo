// Google Maps JavaScript API (optional). Without a browser-restricted key in env.js, the schematic
// map drawn by the shortlist app stays in place. Either way the shortlist hands over its pins through
// app.extensions.maps.setPins(); here they are drawn at each candidate's nearest station.
import { GOOGLE_MAPS_API_KEY } from "../config.js";
import { $ } from "../helper.js";

const CENTER = { lat: 35.6645, lng: 139.674 }; // between 明大前 and 渋谷, where the demo candidates are

export function initApp(app) {
  let latest = [];
  let draw = null; // set once Google Maps has loaded
  app.extensions.maps = {
    /** @param {{ lat: number, lng: number, label: string, title: string }[]} pins */
    setPins(pins) {
      latest = pins;
      draw?.();
    },
    get live() {
      return draw !== null;
    },
  };
  if (!GOOGLE_MAPS_API_KEY) return;

  window.loadRentalMap = () => {
    const target = document.createElement("div");
    target.id = "googleMap";
    target.className = "map-canvas";
    $("#mockMap").replaceWith(target);
    const map = new google.maps.Map(target, { center: CENTER, zoom: 14, disableDefaultUI: true, zoomControl: true, styles: [{ featureType: "poi", stylers: [{ visibility: "off" }] }] });
    let markers = [];
    draw = () => {
      markers.forEach((marker) => marker.setMap(null));
      markers = latest.map(({ lat, lng, label, title }) => new google.maps.Marker({ map, position: { lat, lng }, label, title }));
    };
    draw();
  };
  const script = document.createElement("script");
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&callback=loadRentalMap`;
  script.async = true;
  script.onerror = () => {
    $("#mapApiNote").textContent = "Google Maps を読み込めなかったため、概略図を表示しています。";
  };
  document.head.append(script);
}
