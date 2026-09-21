// Chat app: rule-based answers about trade-offs in the current shortlist.
import { respondToChat } from "./services.js";
import { addMessage, bindChat } from "./views.js";

export function initApp(app) {
  bindChat(app);
  // Open with an answer for the current conditions instead of a static greeting.
  addMessage("assistant", respondToChat("", app.extensions.store.state));
}
