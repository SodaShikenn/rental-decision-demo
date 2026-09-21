// Worker entry point. The main module may only export handlers, so the logic lives in handler.js.
import { handleRequest } from "./handler.js";

export default {
  fetch: (request, env) => handleRequest(request, env),
};
