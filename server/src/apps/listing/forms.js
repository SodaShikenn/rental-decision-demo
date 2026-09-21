// Upload validation (≈ forms.py): checks that run before any bytes leave the Worker.
import { MAX_IMAGE_EDGE, MAX_UPLOAD_BYTES, MAX_VISUAL_TOKENS } from "../../config.js";
import { AppError } from "../../helper.js";

/** Visual tokens consumed by an image: one token per 28x28 pixel patch. */
export function countImageTokens(width, height) {
  return Math.ceil(width / 28) * Math.ceil(height / 28);
}

/** Whether Claude would process the image without resizing it, so returned coordinates map 1:1. */
export function fitsWithoutResize(width, height, maxEdge = MAX_IMAGE_EDGE, maxTokens = MAX_VISUAL_TOKENS) {
  return (
    Math.ceil(width / 28) * 28 <= maxEdge &&
    Math.ceil(height / 28) * 28 <= maxEdge &&
    countImageTokens(width, height) <= maxTokens
  );
}

const readUint16BE = (bytes, offset) => (bytes[offset] << 8) | bytes[offset + 1];
const readUint32BE = (bytes, offset) => ((bytes[offset] << 24) >>> 0) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3];
const readUint24LE = (bytes, offset) => bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
const ascii = (bytes, offset, length) => String.fromCharCode(...bytes.subarray(offset, offset + length));

function pngSize(bytes) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24 || !signature.every((value, index) => bytes[index] === value)) return null;
  if (ascii(bytes, 12, 4) !== "IHDR") return null;
  return { mediaType: "image/png", width: readUint32BE(bytes, 16), height: readUint32BE(bytes, 20) };
}

// Start-of-frame markers carry the frame size. C4 (DHT), C8 (JPG) and CC (DAC) are not frames.
const JPEG_SOF_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function jpegSize(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return null;
  let offset = 2;
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    if (marker === 0xff) {
      offset += 1; // fill byte
      continue;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2; // standalone marker without a length
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return null; // reached image data before a frame header
    const length = readUint16BE(bytes, offset + 2);
    if (JPEG_SOF_MARKERS.has(marker)) {
      if (offset + 9 > bytes.length) return null;
      return { mediaType: "image/jpeg", width: readUint16BE(bytes, offset + 7), height: readUint16BE(bytes, offset + 5) };
    }
    offset += 2 + length;
  }
  return null;
}

function webpSize(bytes) {
  if (bytes.length < 30 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP") return null;
  const chunk = ascii(bytes, 12, 4);
  if (chunk === "VP8 ") {
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null;
    return {
      mediaType: "image/webp",
      width: (bytes[26] | (bytes[27] << 8)) & 0x3fff,
      height: (bytes[28] | (bytes[29] << 8)) & 0x3fff,
    };
  }
  if (chunk === "VP8L") {
    if (bytes[20] !== 0x2f) return null;
    return {
      mediaType: "image/webp",
      width: 1 + (((bytes[22] & 0x3f) << 8) | bytes[21]),
      height: 1 + (((bytes[24] & 0x0f) << 10) | (bytes[23] << 2) | ((bytes[22] & 0xc0) >> 6)),
    };
  }
  if (chunk === "VP8X") {
    return { mediaType: "image/webp", width: 1 + readUint24LE(bytes, 24), height: 1 + readUint24LE(bytes, 27) };
  }
  return null;
}

/** Identify PNG, JPEG, or WEBP by magic bytes (never by filename or declared type) and read its size. */
export function sniffImage(bytes) {
  return pngSize(bytes) ?? jpegSize(bytes) ?? webpSize(bytes);
}

/**
 * Validate an uploaded image and return { mediaType, width, height, bytes }, or throw AppError.
 * Oversized images are rejected rather than resized so that evidence boxes stay aligned;
 * the browser client pre-resizes to fit.
 */
export function validateImage(bytes) {
  if (bytes.length === 0) throw new AppError(400, "empty_image", "画像ファイルが空です。");
  if (bytes.length > MAX_UPLOAD_BYTES) throw new AppError(413, "image_too_large", "画像は5MB以下にしてください。");
  const image = sniffImage(bytes);
  if (!image) throw new AppError(415, "unsupported_image", "PNG / JPEG / WEBP 形式の画像を選択してください。");
  if (!image.width || !image.height) throw new AppError(415, "unreadable_image", "画像サイズを読み取れませんでした。");
  if (!fitsWithoutResize(image.width, image.height)) {
    throw new AppError(422, "image_needs_resize", `画像サイズ ${image.width}×${image.height}px が解析上限を超えています。縮小してから送信してください。`);
  }
  return { ...image, bytes };
}
