// Insights app: explain the selected candidate against the user's priorities.
import { renderSelected } from "./views.js";

export function initApp(app) {
  app.extensions.store.on("change", () => renderSelected(app));
  renderSelected(app);
}
