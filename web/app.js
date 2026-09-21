// Front-end application factory (≈ app.py): initialize extensions, then register feature apps.
// To add a feature, create apps/<name>/ with an index.js exporting initApp(app) and list it below.
import * as config from "./config.js";
import * as extGoogleMaps from "./extensions/ext_google_maps.js";
import * as extStore from "./extensions/ext_store.js";
import * as chat from "./apps/chat/index.js";
import * as insights from "./apps/insights/index.js";
import * as intake from "./apps/intake/index.js";
import * as shortlist from "./apps/shortlist/index.js";
import { DEMO_PROPERTIES } from "./apps/shortlist/models.js";

// Registration order is render order: the shortlist ranks before insights explains the selection.
const APPS = [shortlist, insights, chat, intake];

export function createApp() {
  const app = { config, extensions: {} };
  initializeExtensions(app);
  registerApps(app);
  return app;
}

function initializeExtensions(app) {
  extStore.initApp(app, { properties: DEMO_PROPERTIES, preferences: config.DEFAULT_PREFERENCES, selectedId: DEMO_PROPERTIES[0].id });
  extGoogleMaps.initApp(app);
}

function registerApps(app) {
  APPS.forEach((feature) => feature.initApp(app));
}

createApp();
