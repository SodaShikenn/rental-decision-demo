// Costs app: estimate what each candidate costs to move in, and every month after, from its sheet.
import { bindCosts, renderCosts } from "./views.js";

export function initApp(app) {
  bindCosts(app);
  app.extensions.store.on("change", () => renderCosts(app));
  renderCosts(app);
}
