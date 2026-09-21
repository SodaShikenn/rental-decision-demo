import struct

import pytest

from apps.listing.forms import sniff_image, validate_image, within_size_limits
from config import MAX_UPLOAD_BYTES
from helper import AppError


def jpeg_header(width: int, height: int) -> bytes:
    app0 = b"\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
    sof0 = b"\xff\xc0\x00\x11\x08" + struct.pack(">HH", height, width) + b"\x03\x01\x22\x00"
    return b"\xff\xd8" + app0 + sof0


def webp_header(chunk: bytes, payload: bytes) -> bytes:
    data = bytearray(30)
    data[0:4] = b"RIFF"
    data[8:12] = b"WEBP"
    data[12:16] = chunk
    data[20 : 20 + len(payload)] = payload
    return bytes(data)


def png_header(fixture: bytes, width: int, height: int) -> bytes:
    return fixture[:16] + struct.pack(">II", width, height) + fixture[24:33]


def test_reads_png_dimensions_from_the_fixture(fixture_png):
    header = sniff_image(fixture_png)
    assert (header.media_type, header.width, header.height) == ("image/png", 2000, 1184)


def test_reads_jpeg_dimensions_from_the_frame_header_skipping_app_segments():
    header = sniff_image(jpeg_header(400, 300))
    assert (header.media_type, header.width, header.height) == ("image/jpeg", 400, 300)


def test_reads_webp_vp8x_and_vp8l_dimensions():
    vp8x = webp_header(b"VP8X", bytes(4) + (639).to_bytes(3, "little") + (479).to_bytes(3, "little"))
    assert (sniff_image(vp8x).width, sniff_image(vp8x).height) == (640, 480)
    bits = 639 | (479 << 14)
    vp8l = webp_header(b"VP8L", b"\x2f" + bits.to_bytes(4, "little"))
    assert (sniff_image(vp8l).width, sniff_image(vp8l).height) == (640, 480)


def test_identifies_files_by_content_not_by_name():
    assert sniff_image(b"GIF89a not supported here") is None
    assert sniff_image(b"<svg xmlns='http://www.w3.org/2000/svg'/>") is None


@pytest.mark.parametrize(
    ("width", "height", "fits"),
    [(2000, 1184, True), (2560, 1515, True), (4096, 2900, True), (4097, 1000, False), (4000, 4000, False)],
)
def test_size_limits_keep_ocr_fast(width, height, fits):
    assert within_size_limits(width, height) is fits


@pytest.mark.parametrize(
    ("make", "status", "code"),
    [
        (lambda fixture: b"", 400, "empty_image"),
        (lambda fixture: bytes(MAX_UPLOAD_BYTES + 1), 413, "image_too_large"),
        (lambda fixture: b"hello", 415, "unsupported_image"),
        (lambda fixture: png_header(fixture, 6000, 4000), 422, "image_needs_resize"),
    ],
)
def test_validate_image_raises_an_app_error_for_each_failure(fixture_png, make, status, code):
    with pytest.raises(AppError) as raised:
        validate_image(make(fixture_png))
    assert (raised.value.status, raised.value.code) == (status, code)


def test_validate_image_returns_the_sniffed_image_with_its_bytes(fixture_png):
    image = validate_image(fixture_png)
    assert (image.media_type, image.width, image.data) == ("image/png", 2000, fixture_png)
