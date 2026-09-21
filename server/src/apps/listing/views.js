// HTTP layer for listing extraction (≈ views.py): parse and validate the upload, delegate to
// services, and shape the response with models.toContract.
import { LLM_MODEL, MAX_UPLOAD_BYTES, MULTIPART_OVERHEAD_BYTES } from "../../config.js";
import { AppError, jsonResponse } from "../../helper.js";
import { validateImage } from "./forms.js";
import { toContract } from "./models.js";
import { MOCK_MODEL, mockReading, readListing } from "./services.js";

const tooLarge = () => new AppError(413, "image_too_large", "画像は5MB以下にしてください。");

/** POST /api/extract-listing — multipart/form-data with an `image` field. */
export async function extractListing(request, app, log) {
  const { mode } = app.config.extraction;
  log.set({ mode });
  if (Number(request.headers.get("Content-Length") || 0) > MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD_BYTES) throw tooLarge();

  let file;
  try {
    file = (await request.formData()).get("image");
  } catch {
    throw new AppError(400, "invalid_form", "multipart/form-data の image フィールドで画像を送信してください。");
  }
  if (!file || typeof file === "string") throw new AppError(400, "missing_image", "image フィールドに画像がありません。");
  if (file.size > MAX_UPLOAD_BYTES) throw tooLarge();
  const image = validateImage(new Uint8Array(await file.arrayBuffer()));

  const documentId = crypto.randomUUID();
  const extractedAt = new Date().toISOString();
  log.set({ documentId });

  if (mode === "mock") {
    return jsonResponse(toContract(mockReading(image), { documentId, extractedAt, model: MOCK_MODEL, mode, image }));
  }
  if (!app.config.anthropicApiKey) throw new AppError(503, "not_configured", "解析サーバーにAPIキーが設定されていません。");
  const { output, model, usage } = await readListing(image, app);
  log.set({ usage: { input: usage?.input_tokens, output: usage?.output_tokens } });
  return jsonResponse(toContract(output, { documentId, extractedAt, model: model || LLM_MODEL, mode, image }));
}
