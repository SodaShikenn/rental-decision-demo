// Shortlist app: the user's routine, the ranked candidates, and the map pins.
import { bindControls, renderCandidates } from "./views.js";

export function initApp(app) {
  bindControls(app);
  app.extensions.store.on("change", () => renderCandidates(app));
  renderCandidates(app);
}
