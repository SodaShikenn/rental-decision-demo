// Capabilities app: make it obvious which features are live, which are demos, and which are not connected.
import { EXTRACTION_API_URL } from "../../config.js";
import { fetchServerState, setExtractionState } from "./services.js";
import { bindCapabilities, renderCapabilities } from "./views.js";

async function refreshServerState(app) {
  const { state, model, maps } = await fetchServerState(EXTRACTION_API_URL);
  setExtractionState(state, model, maps);
  renderCapabilities();
  app.extensions.store.emit("server-status", state);
}

export function initApp(app) {
  bindCapabilities();
  renderCapabilities();
  if (EXTRACTION_API_URL) refreshServerState(app);
}
