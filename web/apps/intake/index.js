// Intake app: turn a listing sheet into reviewed values that join the comparison.
import { bindManual } from "./manual.js";
import { bindIntake } from "./views.js";

export function initApp(app) {
  bindIntake(app);
  bindManual(app);
}
