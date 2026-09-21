// Shortlist app: the user's conditions, the ranked comparison table, and the map.
import { bindControls, flashRow, renderShortlist } from "./views.js";

export function initApp(app) {
  const { store } = app.extensions;
  bindControls(app);
  store.on("change", () => renderShortlist(app));
  store.on("added", flashRow);
  renderShortlist(app);
}
