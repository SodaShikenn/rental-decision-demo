"""Deterministic reading for EXTRACTION_MODE=mock: lets the front end and tests run without OCR or
Gemini. The lines are real Docling OCR output for the fictional tests/fixtures/listing-sheet.png
(2000x1184, including its misread ㎡), scaled to whatever image was uploaded, and the mapping cites
them by id. Mock readings still go through the evidence checks and are labelled meta.mode = "mock"."""

from __future__ import annotations

from extensions.ext_ocr import OcrLine, OcrPage

from .forms import ImageHeader
from .models import MapperOutput

MOCK_MODEL = "mock-fixture"
MOCK_OCR = "mock-fixture"
_FIXTURE_SIZE = (2000, 1184)

_LINES = [
    (0, "賃貸マンション", 1.0, (64, 38, 462, 101)),
    (1, "テストハイツ高円寺", 1.0, (652, 58, 1027, 101)),
    (2, "高円寺駅徒歩6分・商店街まで徒歩3分", 0.996, (1283, 72, 1760, 102)),
    (4, "203号室", 1.0, (704, 134, 881, 178)),
    (5, "1K", 1.0, (908, 135, 976, 176)),
    (7, "JR中央線「高円寺」駅徒歩6分", 0.998, (89, 168, 363, 191)),
    (8, "東京メ卜口丸ノ内線「新高円寺」駅徒歩11分", 0.976, (89, 198, 484, 221)),
    (9, "賃料：￥88,000円", 0.972, (59, 267, 512, 320)),
    (10, "管理費：￥5,000円", 0.973, (61, 334, 360, 373)),
    (15, "所在地：東京都杉並区高円寺南9-99-99", 0.998, (61, 427, 407, 450)),
    (18, "竣 工：1998年3月", 0.956, (60, 479, 243, 505)),
    (19, "専有面積：20.152(6.09坪)", 0.935, (62, 508, 323, 531)),
    (21, "間取り:1K", 0.964, (61, 535, 170, 559)),
    (24, "敷金：1ヶ月", 0.992, (61, 665, 168, 689)),
    (25, "礼金：1ヶ月", 0.995, (61, 690, 168, 714)),
    (31, "更新料：新賃料の1ヶ月", 0.967, (64, 767, 257, 787)),
    (32, "火災保険料：要加入(2年16,000円)", 0.974, (64, 792, 370, 812)),
    (36, "バス・トイレ別、独立洗面台、室内洗濯機置場、エアコン", 0.999, (62, 861, 534, 884)),
    (38, "21.15(6.40坪)", 0.995, (1689, 882, 1907, 909)),
    (41, "保証会社加入必須(初回保証料：月額総賃料の50%)", 0.986, (64, 984, 490, 1004)),
    (42, "鍵交換費用：15,400円", 0.969, (61, 1008, 257, 1031)),
    (45, "ペッ卜不可、楽器不可、事務所利用不可", 0.992, (64, 1034, 390, 1054)),
    (48, "図面と現況が異なる場合は現況を優先とさせていただきます。", 1.0, (631, 1123, 1142, 1143)),
]

MOCK_MAPPING = MapperOutput.model_validate(
    {
        "fields": {
            "propertyName": {"value": "テストハイツ高円寺 203号室", "lines": [1, 4]},
            "rent": {"value": 88000, "lines": [9]},
            "managementFee": {"value": 5000, "lines": [10]},
            "address": {"value": "東京都杉並区高円寺南9-99-99", "lines": [15]},
            "station": {"value": "JR中央線「高円寺」駅 徒歩6分", "lines": [7]},
            "layout": {"value": "1K", "lines": [21]},
            "areaSqm": {"value": 20.15, "lines": [19]},
            "constructionYear": {"value": 1998, "lines": [18]},
        },
        "costs": [
            {"kind": "deposit", "label": "敷金", "amount": 1, "unit": "months", "timing": "initial", "lines": [24]},
            {"kind": "keyMoney", "label": "礼金", "amount": 1, "unit": "months", "timing": "initial", "lines": [25]},
            {"kind": "renewal", "label": "更新料", "amount": 1, "unit": "months", "timing": "renewal", "lines": [31]},
            {"kind": "fee", "label": "火災保険料（2年）", "amount": 16000, "unit": "yen", "timing": "initial", "required": True, "lines": [32]},
            {"kind": "guarantor", "label": "初回保証料", "amount": 50, "unit": "percent", "timing": "initial", "required": True, "lines": [41]},
            {"kind": "fee", "label": "鍵交換費用", "amount": 15400, "unit": "yen", "timing": "initial", "lines": [42]},
        ],
        "warnings": [
            {
                "code": "inconsistent_values",
                "message": "専有面積が物件概要（20.15㎡）と間取り図（21.15㎡）で異なります。",
                "fields": ["areaSqm"],
            }
        ],
    }
)


def mock_page(image: ImageHeader) -> OcrPage:
    """The fixture's OCR lines, scaled to the uploaded image."""
    sx = image.width / _FIXTURE_SIZE[0]
    sy = image.height / _FIXTURE_SIZE[1]
    lines = [OcrLine(line_id, text, confidence, (x1 * sx, y1 * sy, x2 * sx, y2 * sy)) for line_id, text, confidence, (x1, y1, x2, y2) in _LINES]
    return OcrPage(width=float(image.width), height=float(image.height), lines=lines)
