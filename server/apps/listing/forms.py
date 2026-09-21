"""Upload validation (≈ KBQA forms.py): checks that run before any bytes leave the server."""

from __future__ import annotations

import struct
from dataclasses import dataclass

from config import MAX_IMAGE_EDGE, MAX_IMAGE_PIXELS, MAX_UPLOAD_BYTES
from helper import AppError


@dataclass(frozen=True)
class ImageHeader:
    media_type: str
    width: int
    height: int


@dataclass(frozen=True)
class ValidatedImage(ImageHeader):
    data: bytes


def within_size_limits(width: int, height: int) -> bool:
    """Whether OCR can process the image in reasonable time and memory."""
    return max(width, height) <= MAX_IMAGE_EDGE and width * height <= MAX_IMAGE_PIXELS


def _png(data: bytes) -> ImageHeader | None:
    if len(data) < 24 or not data.startswith(b"\x89PNG\r\n\x1a\n") or data[12:16] != b"IHDR":
        return None
    width, height = struct.unpack(">II", data[16:24])
    return ImageHeader("image/png", width, height)


# Start-of-frame markers carry the frame size. C4 (DHT), C8 (JPG) and CC (DAC) are not frames.
_JPEG_SOF = {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}


def _jpeg(data: bytes) -> ImageHeader | None:
    if len(data) < 4 or not data.startswith(b"\xff\xd8\xff"):
        return None
    offset = 2
    while offset + 3 < len(data):
        if data[offset] != 0xFF:
            return None
        marker = data[offset + 1]
        if marker == 0xFF:  # fill byte
            offset += 1
            continue
        if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:  # standalone markers without a length
            offset += 2
            continue
        if marker in (0xD9, 0xDA):  # reached image data before a frame header
            return None
        (length,) = struct.unpack(">H", data[offset + 2 : offset + 4])
        if marker in _JPEG_SOF:
            if offset + 9 > len(data):
                return None
            height, width = struct.unpack(">HH", data[offset + 5 : offset + 9])
            return ImageHeader("image/jpeg", width, height)
        offset += 2 + length
    return None


def _webp(data: bytes) -> ImageHeader | None:
    if len(data) < 30 or data[0:4] != b"RIFF" or data[8:12] != b"WEBP":
        return None
    chunk = data[12:16]
    if chunk == b"VP8 ":
        if data[23:26] != b"\x9d\x01\x2a":
            return None
        width, height = struct.unpack("<HH", data[26:30])
        return ImageHeader("image/webp", width & 0x3FFF, height & 0x3FFF)
    if chunk == b"VP8L":
        if data[20] != 0x2F:
            return None
        (bits,) = struct.unpack("<I", data[21:25])
        return ImageHeader("image/webp", (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1)
    if chunk == b"VP8X":
        width = int.from_bytes(data[24:27], "little") + 1
        height = int.from_bytes(data[27:30], "little") + 1
        return ImageHeader("image/webp", width, height)
    return None


def sniff_image(data: bytes) -> ImageHeader | None:
    """Identify PNG, JPEG, or WEBP by magic bytes (never by filename or declared type) and read its size."""
    return _png(data) or _jpeg(data) or _webp(data)


def validate_image(data: bytes) -> ValidatedImage:
    """Validate an upload, or raise AppError. The browser client pre-resizes sheets, so an oversized
    image here is rejected rather than silently shrunk."""
    if not data:
        raise AppError(400, "empty_image", "画像ファイルが空です。")
    if len(data) > MAX_UPLOAD_BYTES:
        raise AppError(413, "image_too_large", "画像は5MB以下にしてください。")
    header = sniff_image(data)
    if header is None:
        raise AppError(415, "unsupported_image", "PNG / JPEG / WEBP 形式の画像を選択してください。")
    if not header.width or not header.height:
        raise AppError(415, "unreadable_image", "画像サイズを読み取れませんでした。")
    if not within_size_limits(header.width, header.height):
        raise AppError(
            422,
            "image_needs_resize",
            f"画像サイズ {header.width}×{header.height}px が大きすぎます（長辺{MAX_IMAGE_EDGE}px・{MAX_IMAGE_PIXELS // 1_000_000}00万画素まで）。縮小してから送信してください。",
        )
    return ValidatedImage(header.media_type, header.width, header.height, data)
