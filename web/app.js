// Front-end application factory (≈ app.py): initialize extensions, then register feature apps.
// To add a feature, create apps/<name>/ with an index.js exporting initApp(app) and list it below.
import * as config from "./config.js";
import * as extStore from "./extensions/ext_store.js";
import * as capabilities from "./apps/capabilities/index.js";
import * as compare from "./apps/compare/index.js";
import * as glossary from "./apps/glossary/index.js";
import * as advisor from "./apps/advisor/index.js";
import { restoreSession, attachSession } from "./extensions/session.js";
import * as workspace from "./apps/workspace/index.js";
import * as leisure from "./apps/leisure/index.js";
import * as commute from "./apps/commute/index.js";
import * as maps from "./apps/maps/index.js";
import * as research from "./apps/research/index.js";
import * as intake from "./apps/intake/index.js";
import * as priorities from "./apps/priorities/index.js";
import * as needs from "./apps/needs/index.js";
import { defaultMoveIn } from "./apps/costs/services.js";
import { SEED_SHEET_IDS } from "./apps/intake/models.js";
import { candidateFromSheet } from "./apps/intake/services.js";
import { SHEETS } from "./data/sheets.js";
import { restoreRecordedResearch } from "./apps/research/automatic.js";

// Registration order is render order: capability chips first, then the comparison table and the
// condition memo built from the same sheets. Intake adds sheets; the glossary answers [data-term]
// clicks anywhere on the page.
const APPS = [capabilities, compare, priorities, needs, intake, research, maps, commute, leisure, glossary, workspace, advisor];

export async function createApp() {
  const app = { config, extensions: {} };
  initializeExtensions(app);
  let restoreError = false;
  try {
    const saved = await restoreSession();
    if (saved) Object.assign(app.extensions.store.state, saved);
  } catch { restoreError = true; }
  restoreRecordedResearch(app.extensions.store);
  registerApps(app);
  attachSession(app.extensions.store, restoreError);
  return app;
}

function initializeExtensions(app) {
  // The page opens with real listing sheets, as recorded by server/commands/record_sheets.py.
  const properties = SEED_SHEET_IDS.map((id) => SHEETS.find((sheet) => sheet.id === id)).map(candidateFromSheet);
  const settings = { moveIn: defaultMoveIn(), brokerageMonths: config.DEFAULT_SETTINGS.brokerageMonths };
  extStore.initApp(app, { properties, settings });
}

function registerApps(app) {
  APPS.forEach((feature) => feature.initApp(app));
}

createApp();
