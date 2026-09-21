// Worker entry point. The Workers runtime treats every export of the main module as a handler,
// so this file exports only the default handler; the application lives in app.js.
import { createApp } from "./app.js";

export default {
  fetch: (request, env) => createApp(env).fetch(request),
};
