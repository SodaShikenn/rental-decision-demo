// Needs app: turn what the compared sheets have in common into a condition memo for a listing portal
// or an agent. The memo is rule-based (see services.js) and it updates automatically from confirmed choices.
import { bindNeeds, renderNeeds } from "./views.js";

export function initApp(app) {
  const { store } = app.extensions;
  bindNeeds(app);
  store.on("change", () => renderNeeds(app));
  renderNeeds(app);
}
