// Business logic for listing extraction (≈ services.py): the Claude call and the mock reading.
import { Buffer } from "node:buffer";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { LLM_BETAS, LLM_MAX_TOKENS, LLM_MODEL } from "../../config.js";
import { AppError } from "../../helper.js";
import { ModelOutputSchema } from "./models.js";
import { SYSTEM_PROMPT, userPrompt } from "./prompts.js";

export { mockReading, MOCK_MODEL } from "./mock.js";

// Built once so the request schema is byte-identical across calls (cacheable).
const outputFormat = betaZodOutputFormat(ModelOutputSchema);

function toAppError(error) {
  if (error instanceof Anthropic.RateLimitError) return new AppError(503, "upstream_busy", "解析サービスが混み合っています。少し待ってから再試行してください。");
  if (error instanceof Anthropic.APIConnectionTimeoutError) return new AppError(504, "upstream_timeout", "解析がタイムアウトしました。もう一度お試しください。");
  if (error instanceof Anthropic.AuthenticationError) return new AppError(503, "not_configured", "解析サーバーの認証設定に問題があります。");
  if (error instanceof Anthropic.BadRequestError) return new AppError(422, "image_rejected", "この画像は解析に使用できませんでした。別の画像でお試しください。");
  if (error instanceof Anthropic.APIError) return new AppError(502, "upstream_error", "解析サービスでエラーが発生しました。");
  return error;
}

/**
 * Ask Claude to read listing fields from a validated image.
 * Returns { output, model, usage }; throws AppError for anything the client should see.
 * The image exists only in this request's memory and is never stored.
 */
export async function readListing(image, app) {
  let message;
  try {
    message = await app.extensions.anthropic.client().beta.messages.create({
      model: LLM_MODEL,
      max_tokens: LLM_MAX_TOKENS,
      betas: LLM_BETAS,
      fallbacks: "default",
      system: SYSTEM_PROMPT,
      output_config: { effort: app.config.extraction.effort, format: outputFormat },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: image.mediaType, data: Buffer.from(image.bytes).toString("base64") },
              // Never let the API resize: evidence boxes must map 1:1 onto the uploaded pixels.
              transformations: { oversized_image: "error" },
            },
            { type: "text", text: userPrompt(image) },
          ],
        },
      ],
    });
  } catch (error) {
    throw toAppError(error);
  }

  if (message.stop_reason === "refusal") {
    throw new AppError(502, "refused", "この画像は解析できませんでした。募集図面の画像か確認してください。");
  }
  if (message.stop_reason === "max_tokens") {
    throw new AppError(502, "incomplete", "解析結果が途中で途切れました。もう一度お試しください。");
  }

  // With a server-side fallback the answer is the last text block.
  const text = message.content.filter((block) => block.type === "text").at(-1)?.text;
  let output;
  try {
    output = outputFormat.parse(text ?? "");
  } catch {
    throw new AppError(502, "invalid_output", "解析結果の形式が不正でした。もう一度お試しください。");
  }
  return { output, model: message.model, usage: message.usage };
}
