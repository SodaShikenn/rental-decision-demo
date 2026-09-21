// Front-end application factory (≈ app.py): initialize extensions, then register feature apps.
// To add a feature, create apps/<name>/ with an index.js exporting initApp(app) and list it below.
import * as config from "./config.js";
import * as extGoogleMaps from "./extensions/ext_google_maps.js";
import * as extStore from "./extensions/ext_store.js";
import * as capabilities from "./apps/capabilities/index.js";
import * as chat from "./apps/chat/index.js";
import * as costs from "./apps/costs/index.js";
import * as glossary from "./apps/glossary/index.js";
import * as insights from "./apps/insights/index.js";
import * as intake from "./apps/intake/index.js";
import * as shortlist from "./apps/shortlist/index.js";
import { candidateFromSheet } from "./apps/intake/services.js";
import { SEED_SHEET_IDS } from "./apps/shortlist/models.js";
import { rankProperties } from "./apps/shortlist/services.js";
import { SHEETS } from "./data/sheets.js";
import { defaultMoveIn } from "./apps/costs/services.js";

// Registration order is render order: capability chips first, then the shortlist ranks before
// insights explains the selection and costs estimates it. The glossary answers [data-term] clicks
// anywhere on the page.
const APPS = [capabilities, shortlist, insights, costs, chat, intake, glossary];

export function createApp() {
  const app = { config, extensions: {} };
  initializeExtensions(app);
  registerApps(app);
  return app;
}

function initializeExtensions(app) {
  // The shortlist starts with real listing sheets, as recorded by server/commands/record_sheets.py.
  const properties = SHEETS.filter((sheet) => SEED_SHEET_IDS.includes(sheet.id)).map(candidateFromSheet);
  const preferences = { ...config.DEFAULT_PREFERENCES, moveIn: config.DEFAULT_PREFERENCES.moveIn ?? defaultMoveIn() };
  const [top] = rankProperties(properties, { ...preferences, priorities: new Set(preferences.priorities) });
  extStore.initApp(app, { properties, preferences, selectedId: top.id });
  extGoogleMaps.initApp(app);
}

function registerApps(app) {
  APPS.forEach((feature) => feature.initApp(app));
}

createApp();
