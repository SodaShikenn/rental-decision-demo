"""OCR with Docling (layout analysis + RapidOCR PP-OCRv6 for Japanese), running inside this server.

The converter loads its models once (a few seconds) on first use and is reused for every request.
Conversion is CPU-bound, so it runs in a worker thread, one image at a time. Images are handled as
in-memory streams and never written to disk. Pass `reader` (via create_app(ocr_reader=...)) to
replace OCR in tests.
"""

from __future__ import annotations

import asyncio
import threading
from dataclasses import dataclass
from io import BytesIO
from typing import Any, Awaitable, Callable

from fastapi import FastAPI

from config import OCR_LANGUAGE


@dataclass(frozen=True)
class OcrLine:
    """One recognized text line: pixel box (x1, y1, x2, y2) with a top-left origin."""

    id: int
    text: str
    confidence: float
    box: tuple[float, float, float, float]


@dataclass(frozen=True)
class OcrPage:
    width: float
    height: float
    lines: list[OcrLine]


OcrReader = Callable[[bytes, str], Awaitable[OcrPage]]


def build_converter() -> Any:
    """Create the Docling converter (imports are local: Docling pulls in PyTorch)."""
    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.pipeline_options import PdfPipelineOptions, RapidOcrOptions
    from docling.document_converter import DocumentConverter, ImageFormatOption

    options = PdfPipelineOptions(
        do_ocr=True,
        do_table_structure=False,
        generate_parsed_pages=True,  # keep the OCR lines with their confidence and boxes
        ocr_options=RapidOcrOptions(lang=[OCR_LANGUAGE], force_full_page_ocr=True),
    )
    converter = DocumentConverter(format_options={InputFormat.IMAGE: ImageFormatOption(pipeline_options=options)})
    converter.initialize_pipeline(InputFormat.IMAGE)
    return converter


EXIF_ORIENTATION = 0x0112


def upright(data: bytes, filename: str) -> tuple[bytes, str]:
    """Apply the EXIF orientation, which OCR ignores: phone photos are often stored sideways with a
    rotation tag. The browser uploads originals unchanged (every re-encode costs OCR accuracy), so the
    rotation is applied here. Images without a rotation pass through untouched; rotated ones become
    lossless PNG."""
    from PIL import Image, ImageOps

    with Image.open(BytesIO(data)) as image:
        if image.getexif().get(EXIF_ORIENTATION, 1) == 1:
            return data, filename
        out = BytesIO()
        ImageOps.exif_transpose(image).save(out, "PNG")
    return out.getvalue(), f"{filename.rsplit('.', 1)[0]}.png"


def read_page(converter: Any, data: bytes, filename: str) -> OcrPage:
    from docling.datamodel.base_models import DocumentStream

    data, filename = upright(data, filename)
    result = converter.convert(DocumentStream(name=filename, stream=BytesIO(data)))
    page = result.pages[0]
    lines = []
    for index, cell in enumerate(page.parsed_page.textline_cells if page.parsed_page else []):
        box = cell.rect.to_top_left_origin(page.size.height).to_bounding_box()
        lines.append(OcrLine(index, cell.text, float(cell.confidence), (box.l, box.t, box.r, box.b)))
    return OcrPage(width=page.size.width, height=page.size.height, lines=lines)


def init_app(app: FastAPI, reader: OcrReader | None = None) -> None:
    async def no_warm_up() -> None:
        return None

    if reader is not None:
        app.state.ocr = reader
        app.state.ocr_warm_up = no_warm_up
        return
    state: dict[str, Any] = {"converter": None}
    load_lock = threading.Lock()
    one_at_a_time = asyncio.Semaphore(1)

    def converter() -> Any:
        with load_lock:
            if state["converter"] is None:
                state["converter"] = build_converter()
            return state["converter"]

    async def read(data: bytes, filename: str) -> OcrPage:
        async with one_at_a_time:
            return await asyncio.to_thread(lambda: read_page(converter(), data, filename))

    async def warm_up() -> None:
        await asyncio.to_thread(converter)

    app.state.ocr = read
    app.state.ocr_warm_up = warm_up
