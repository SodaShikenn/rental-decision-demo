// Capabilities app: make it obvious which features are live, which are demos, and which are not connected.
import { EXTRACTION_API_URL } from "../../config.js";
import { fetchServerState, setExtractionState } from "./services.js";
import { renderCapabilities } from "./views.js";

async function refreshServerState(app) {
  const { state, model } = await fetchServerState(EXTRACTION_API_URL);
  setExtractionState(state, model);
  renderCapabilities();
  app.extensions.store.emit("server-status", state);
}

export function initApp(app) {
  renderCapabilities();
  if (EXTRACTION_API_URL) refreshServerState(app);
}
