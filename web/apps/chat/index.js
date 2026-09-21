// Chat app: rule-based answers about trade-offs in the current shortlist.
import { recalculatedMessage } from "./services.js";
import { addMessage, bindChat } from "./views.js";

export function initApp(app) {
  bindChat(app);
  app.extensions.store.on("recalculated", (best) => addMessage("assistant", recalculatedMessage(best)));
}
