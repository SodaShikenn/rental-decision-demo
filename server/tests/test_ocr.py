"""Real Docling OCR on the fictional fixture and on the real listing sheets published with the site.
Slow (model load) and needs the OCR models, so it is opt-in: RUN_OCR_TESTS=1 python -m pytest tests/test_ocr.py"""

import asyncio
import json
import os
from types import SimpleNamespace

import pytest

from extensions import ext_ocr

pytestmark = pytest.mark.skipif(os.environ.get("RUN_OCR_TESTS") != "1", reason="set RUN_OCR_TESTS=1 to run real OCR")


def test_docling_reads_the_fixture_lines_needed_for_every_field(fixture_png):
    app = SimpleNamespace(state=SimpleNamespace())
    ext_ocr.init_app(app)
    page = asyncio.run(app.state.ocr(fixture_png, "sheet.png"))
    texts = [line.text for line in page.lines]
    assert (page.width, page.height) == (2000, 1184)
    for expected in ("テストハイツ高円寺", "203号室", "賃料：￥88,000円", "所在地：東京都杉並区高円寺南9-99-99", "間取り:1K"):
        assert expected in texts
    rent = next(line for line in page.lines if line.text.startswith("賃料"))
    assert rent.confidence > 0.9
    assert abs(rent.box[0] - 65) < 15 and abs(rent.box[1] - 272) < 15  # the true position on the fixture


def test_every_ground_truth_value_on_the_real_sheets_is_found_in_one_ocr_line():
    """Guards the recorded demo: an OCR or model upgrade that changes a line fails here first."""
    from commands.record_sheets import ROOT, SHEETS, same, truth_mapping

    from apps.listing.evidence import build_fields

    converter = ext_ocr.build_converter()
    for sheet in json.loads(SHEETS.read_text(encoding="utf-8"))["sheets"]:
        image = ROOT / sheet["image"]
        page = ext_ocr.read_page(converter, image.read_bytes(), image.name)
        fields, _ = build_fields(truth_mapping(sheet, page), page)  # exits if a quote matches 0 or 2+ lines
        for key, spec in sheet["fields"].items():
            assert same(fields[key]["value"], spec["value"]), f"{sheet['id']}.{key}"
