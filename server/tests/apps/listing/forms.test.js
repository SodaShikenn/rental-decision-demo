import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { MAX_UPLOAD_BYTES } from "../../../src/config.js";
import { AppError } from "../../../src/helper.js";
import { sniffImage, validateImage, fitsWithoutResize } from "../../../src/apps/listing/forms.js";

const fixture = new Uint8Array(await readFile(new URL("../../fixtures/listing-sheet.png", import.meta.url)));

function jpegHeader(width, height) {
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
    0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 0x03, 0x01, 0x22, 0x00,
  ]);
}

function webpHeader(chunk, payload) {
  const bytes = new Uint8Array(30);
  bytes.set(new TextEncoder().encode("RIFF"), 0);
  bytes.set(new TextEncoder().encode("WEBP"), 8);
  bytes.set(new TextEncoder().encode(chunk), 12);
  bytes.set(payload, 20);
  return bytes;
}

function pngHeader(width, height) {
  const bytes = new Uint8Array(fixture.subarray(0, 33));
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return bytes;
}

test("reads PNG dimensions from the fixture", () => {
  assert.deepEqual(sniffImage(fixture), { mediaType: "image/png", width: 2000, height: 1184 });
});

test("reads JPEG dimensions from the frame header, skipping APP segments", () => {
  assert.deepEqual(sniffImage(jpegHeader(400, 300)), { mediaType: "image/jpeg", width: 400, height: 300 });
});

test("reads WEBP VP8X and VP8L dimensions", () => {
  const vp8x = webpHeader("VP8X", [0, 0, 0, 0, 639 & 0xff, 639 >> 8, 0, 479 & 0xff, 479 >> 8, 0]);
  assert.deepEqual(sniffImage(vp8x), { mediaType: "image/webp", width: 640, height: 480 });
  const bits = 639 | (479 << 14);
  const vp8l = webpHeader("VP8L", [0x2f, bits & 0xff, (bits >> 8) & 0xff, (bits >> 16) & 0xff, (bits >> 24) & 0xff]);
  assert.deepEqual(sniffImage(vp8l), { mediaType: "image/webp", width: 640, height: 480 });
});

test("identifies files by content, not by name", () => {
  assert.equal(sniffImage(new TextEncoder().encode("GIF89a not supported here")), null);
  assert.equal(sniffImage(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>")), null);
});

test("fitsWithoutResize follows the high-resolution tier limits", () => {
  assert.equal(fitsWithoutResize(2000, 1184), true);
  assert.equal(fitsWithoutResize(1920, 1080), true);
  assert.equal(fitsWithoutResize(2576, 1449), true); // exactly 4784 visual tokens
  assert.equal(fitsWithoutResize(3840, 2160), false);
  assert.equal(fitsWithoutResize(2600, 100), false); // edge limit
  assert.equal(fitsWithoutResize(2200, 2200), false); // token limit
});

const throwsAppError = (bytes, status, code) =>
  assert.throws(() => validateImage(bytes), (error) => error instanceof AppError && error.status === status && error.code === code);

test("validateImage raises an AppError with a status and code for each failure", () => {
  throwsAppError(new Uint8Array(), 400, "empty_image");
  throwsAppError(new Uint8Array(MAX_UPLOAD_BYTES + 1), 413, "image_too_large");
  throwsAppError(new TextEncoder().encode("hello"), 415, "unsupported_image");
  throwsAppError(pngHeader(4032, 3024), 422, "image_needs_resize");
});

test("validateImage returns the sniffed image with its bytes", () => {
  const image = validateImage(fixture);
  assert.equal(image.mediaType, "image/png");
  assert.equal(image.width, 2000);
  assert.equal(image.bytes, fixture);
});
