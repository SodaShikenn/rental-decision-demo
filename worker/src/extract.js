import { Buffer } from "node:buffer";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { ModelOutputSchema } from "./schema.js";

export const MODEL = "claude-opus-5";
const EFFORT_LEVELS = new Set(["low", "medium", "high", "xhigh", "max"]);

// Built once so the request schema is byte-identical across calls (cacheable).
const outputFormat = betaZodOutputFormat(ModelOutputSchema);

const SYSTEM_PROMPT = `You read Japanese rental listing sheets (募集図面 / マイソク) and transcribe specific fields so a renter can verify them against the original.

Rules:
- Report only what is printed on the sheet. Never infer, estimate, or fill in a value from general knowledge. If a field is absent or unreadable, set value to null.
- rent: the monthly rent (賃料 / 賃室料) in yen as a number. Exclude a management or common-area fee (管理費 / 共益費) that is listed separately; if the fee is stated as included (込), use the printed rent.
- areaSqm: the private floor area (専有面積) from the property summary, in square metres.
- constructionYear: the Western year of construction (竣工 / 築年). Convert Japanese era years if that is how it is printed.
- station: the first-listed station access line, as printed.
- sourceText: copy the printed text the value came from, character for character, including labels such as 賃室料: when they are part of the same line.
- box: the pixel bounding box [x1, y1, x2, y2] of sourceText in this image, origin at the top-left.
- confidence: how sure you are that the value is read correctly, from 0 to 1. Lower it for small, blurred, cropped, or ambiguous text.
- warnings: add one whenever two parts of the sheet disagree (for example the area in the summary versus the floor plan), text is partly illegible, or several values could fit one field. Name the affected fields.`;

export class ExtractionError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function createClient(env) {
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 60_000, maxRetries: 1 });
}

function mapApiError(error) {
  if (error instanceof Anthropic.RateLimitError) return new ExtractionError(503, "upstream_busy", "解析サービスが混み合っています。少し待ってから再試行してください。");
  if (error instanceof Anthropic.APIConnectionTimeoutError) return new ExtractionError(504, "upstream_timeout", "解析がタイムアウトしました。もう一度お試しください。");
  if (error instanceof Anthropic.AuthenticationError) return new ExtractionError(503, "not_configured", "解析サーバーの認証設定に問題があります。");
  if (error instanceof Anthropic.BadRequestError) return new ExtractionError(422, "image_rejected", "この画像は解析に使用できませんでした。別の画像でお試しください。");
  if (error instanceof Anthropic.APIError) return new ExtractionError(502, "upstream_error", "解析サービスでエラーが発生しました。");
  return error;
}

/**
 * Ask Claude to extract listing fields from a validated image.
 * Returns { output, model, usage }; throws ExtractionError for anything the client should see.
 * The image exists only in this request's memory and is never stored.
 */
export async function extractListing(image, env, client = createClient(env)) {
  const effort = EFFORT_LEVELS.has(env.EXTRACTION_EFFORT) ? env.EXTRACTION_EFFORT : "high";
  let message;
  try {
    message = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM_PROMPT,
      output_config: { effort, format: outputFormat },
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
            {
              type: "text",
              text: `This listing sheet is ${image.width}×${image.height} pixels. Extract the fields and return pixel coordinates in that space.`,
            },
          ],
        },
      ],
    });
  } catch (error) {
    throw mapApiError(error);
  }

  if (message.stop_reason === "refusal") {
    throw new ExtractionError(502, "refused", "この画像は解析できませんでした。募集図面の画像か確認してください。");
  }
  if (message.stop_reason === "max_tokens") {
    throw new ExtractionError(502, "incomplete", "解析結果が途中で途切れました。もう一度お試しください。");
  }

  // With a server-side fallback the answer is the last text block.
  const text = message.content.filter((block) => block.type === "text").at(-1)?.text;
  let output;
  try {
    output = outputFormat.parse(text ?? "");
  } catch {
    throw new ExtractionError(502, "invalid_output", "解析結果の形式が不正でした。もう一度お試しください。");
  }
  return { output, model: message.model, usage: message.usage };
}
