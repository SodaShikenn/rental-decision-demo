import { test } from "node:test";
import assert from "node:assert/strict";
import Anthropic from "@anthropic-ai/sdk";
import { LLM_MODEL, loadConfig } from "../../../src/config.js";
import { AppError } from "../../../src/helper.js";
import { readListing, mockReading } from "../../../src/apps/listing/services.js";

/** Minimal app with a stubbed Anthropic client, as createApp would build it. */
const appWith = (client, env = {}) => ({ config: loadConfig(env), extensions: { anthropic: { client: () => client } } });

const image = { mediaType: "image/png", width: 2000, height: 1184, bytes: new Uint8Array([1, 2, 3]) };
const goodText = JSON.stringify(mockReading(image));
const read = (env, client) => readListing(image, appWith(client, env));

/** A stand-in for the Anthropic client that records the request and returns a canned message. */
function stubClient(reply) {
  const calls = [];
  return {
    calls,
    beta: {
      messages: {
        create: async (params) => {
          calls.push(params);
          if (reply instanceof Error) throw reply;
          return { model: LLM_MODEL, usage: { input_tokens: 3200, output_tokens: 900 }, stop_reason: "end_turn", ...reply };
        },
      },
    },
  };
}

test("sends the image with fallbacks, structured output, and no silent resizing", async () => {
  const client = stubClient({ content: [{ type: "thinking", thinking: "" }, { type: "text", text: goodText }] });
  const result = await read({}, client);
  assert.equal(result.output.fields.rent.value, 88000);
  assert.equal(result.usage.input_tokens, 3200);

  const [params] = client.calls;
  assert.equal(params.model, "claude-opus-5");
  assert.equal(params.fallbacks, "default");
  assert.deepEqual(params.betas, ["server-side-fallback-2026-07-01"]);
  assert.equal(params.output_config.effort, "high");
  assert.equal(params.output_config.format.type, "json_schema");
  assert.equal("thinking" in params, false); // adaptive thinking is the Opus 5 default
  const [imageBlock, textBlock] = params.messages[0].content;
  assert.deepEqual(imageBlock.source, { type: "base64", media_type: "image/png", data: "AQID" });
  assert.deepEqual(imageBlock.transformations, { oversized_image: "error" });
  assert.match(textBlock.text, /2000×1184/);
});

test("effort comes from EXTRACTION_EFFORT, falling back to high for unknown values", async () => {
  const medium = stubClient({ content: [{ type: "text", text: goodText }] });
  await read({ EXTRACTION_EFFORT: "medium" }, medium);
  assert.equal(medium.calls[0].output_config.effort, "medium");
  const unknown = stubClient({ content: [{ type: "text", text: goodText }] });
  await read({ EXTRACTION_EFFORT: "turbo" }, unknown);
  assert.equal(unknown.calls[0].output_config.effort, "high");
});

test("after a server-side fallback, the last text block is the answer", async () => {
  const client = stubClient({
    content: [
      { type: "text", text: '{"fields":' },
      { type: "fallback", from: { model: "claude-opus-5" }, to: { model: "claude-opus-4-8" } },
      { type: "text", text: goodText },
    ],
  });
  const { output } = await read({}, client);
  assert.equal(output.fields.layout.value, "1K");
});

const rejectsWith = (promise, status, code) =>
  assert.rejects(promise, (error) => error instanceof AppError && error.status === status && error.code === code);

test("a refusal is reported before any output is parsed", async () => {
  await rejectsWith(read({}, stubClient({ stop_reason: "refusal", content: [] })), 502, "refused");
});

test("truncated output is reported as incomplete", async () => {
  await rejectsWith(read({}, stubClient({ stop_reason: "max_tokens", content: [{ type: "text", text: "{" }] })), 502, "incomplete");
});

test("output that does not match the schema is rejected", async () => {
  await rejectsWith(read({}, stubClient({ content: [{ type: "text", text: '{"fields":{}}' }] })), 502, "invalid_output");
  await rejectsWith(read({}, stubClient({ content: [] })), 502, "invalid_output");
});

test("SDK errors map to client-safe statuses", async () => {
  await rejectsWith(read({}, stubClient(new Anthropic.RateLimitError(429, {}, "rate", new Headers()))), 503, "upstream_busy");
  await rejectsWith(read({}, stubClient(new Anthropic.APIConnectionTimeoutError())), 504, "upstream_timeout");
  await rejectsWith(read({}, stubClient(new Anthropic.AuthenticationError(401, {}, "auth", new Headers()))), 503, "not_configured");
  await rejectsWith(read({}, stubClient(new Anthropic.BadRequestError(400, {}, "bad", new Headers()))), 422, "image_rejected");
  await rejectsWith(read({}, stubClient(new Anthropic.InternalServerError(500, {}, "boom", new Headers()))), 502, "upstream_error");
});
