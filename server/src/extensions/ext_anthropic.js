// Anthropic API client. Created lazily so mock mode and tests never need an API key.
// Pass a client to initApp (via createApp overrides) to stub it in tests.
import Anthropic from "@anthropic-ai/sdk";
import { LLM_MAX_RETRIES, LLM_TIMEOUT_MS } from "../config.js";

export function initApp(app, client) {
  let instance = client;
  app.extensions.anthropic = {
    client() {
      instance ??= new Anthropic({ apiKey: app.config.anthropicApiKey, timeout: LLM_TIMEOUT_MS, maxRetries: LLM_MAX_RETRIES });
      return instance;
    },
  };
}
