// Worker application factory (≈ app.py): load config, initialize extensions, register app
// blueprints, and dispatch each request with shared CORS, error handling, and logging.
// To add an endpoint group, create apps/<name>/ with an index.js exporting `bp` and list it below.
import { loadConfig } from "./config.js";
import { AppError, errorResponse } from "./helper.js";
import * as extAnthropic from "./extensions/ext_anthropic.js";
import * as extCors from "./extensions/ext_cors.js";
import * as extLogger from "./extensions/ext_logger.js";
import * as extRateLimit from "./extensions/ext_rate_limit.js";
import { bp as listingBp } from "./apps/listing/index.js";

const BLUEPRINTS = [listingBp];

/**
 * Build the app for one Worker environment. `overrides` replaces external clients in tests,
 * e.g. createApp(env, { anthropic: stubClient }).
 */
export function createApp(env = {}, overrides = {}) {
  const app = { config: loadConfig(env), env, extensions: {} };
  initializeExtensions(app, overrides);
  app.routes = registerBlueprints(BLUEPRINTS);
  app.fetch = (request) => dispatch(app, request);
  return app;
}

function initializeExtensions(app, overrides) {
  extCors.initApp(app);
  extLogger.initApp(app);
  extRateLimit.initApp(app);
  extAnthropic.initApp(app, overrides.anthropic);
}

function registerBlueprints(blueprints) {
  return blueprints.flatMap((bp) => bp.routes.map((route) => ({ ...route, path: `${bp.prefix}${route.path}`, blueprint: bp })));
}

async function dispatch(app, request) {
  const { pathname } = new URL(request.url);
  const origin = request.headers.get("Origin");
  const { cors, logger } = app.extensions;
  const corsHeaders = cors.headersFor(origin);
  const log = logger.startRequest({ method: request.method, path: pathname });
  const finish = (response) => {
    log.write(response.status);
    for (const [name, value] of Object.entries(corsHeaders)) response.headers.set(name, value);
    return response;
  };

  try {
    const routes = app.routes.filter((route) => route.path === pathname);
    if (routes.length === 0) throw new AppError(404, "not_found", "Not found");
    // Browsers always send Origin on cross-origin requests; other clients are covered by the rate limit.
    if (origin && !cors.isAllowed(origin)) throw new AppError(403, "origin_not_allowed", "このオリジンからの利用は許可されていません。");
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
    const route = routes.find((candidate) => candidate.method === request.method);
    if (!route) {
      const allow = [...routes.map((candidate) => candidate.method), "OPTIONS"].join(", ");
      throw new AppError(405, "method_not_allowed", `${allow} で送信してください。`, { Allow: allow });
    }
    for (const hook of route.blueprint.beforeRequest ?? []) await hook(request, app, log);
    return finish(await route.view(request, app, log));
  } catch (error) {
    if (error instanceof AppError) {
      log.set({ error: error.code });
      return finish(errorResponse(error));
    }
    log.set({ error: "internal" });
    return finish(errorResponse(new AppError(500, "internal", "解析サーバーで予期しないエラーが発生しました。")));
  }
}
