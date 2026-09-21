// Compare app: the sheets the person brought, side by side, every value traceable to its sheet.
import { bindCompare, flashColumn, renderCompare } from "./views.js";

export function initApp(app) {
  const { store } = app.extensions;
  bindCompare(app);
  store.on("change", () => renderCompare(app));
  store.on("workspace", () => renderCompare(app));
  store.on("added", (id) => requestAnimationFrame(() => flashColumn(id)));
  renderCompare(app);
}
