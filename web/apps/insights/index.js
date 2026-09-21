// Insights app: explain the selected candidate against the user's conditions.
import { renderDetail } from "./views.js";

export function initApp(app) {
  app.extensions.store.on("change", () => renderDetail(app));
  renderDetail(app);
}
