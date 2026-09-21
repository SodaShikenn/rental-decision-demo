"""Check the AI mapping against the OCR evidence.

Gemini proposes a value for each field and cites the OCR lines it came from. Here every value is
traced back to those lines. A value that cannot be found in its cited text (for example because the
model "corrected" an OCR misread) keeps a reduced confidence and a warning, so the review gate asks
a person to check it against the original sheet. Confidence always comes from the OCR engine,
never from the model's own judgment.
"""

from __future__ import annotations

import re
import unicodedata
from typing import Any

from extensions.ext_ocr import OcrLine, OcrPage

from .models import FIELD_KEYS, FIELD_LABELS, FIELD_TYPES, CostMapping, MapperOutput

SQM_PER_TSUBO = 3.30579
TSUBO_TOLERANCE_SQM = 0.3
UNVERIFIED_FACTOR = 0.6
YEN_FIELDS = {"rent", "managementFee"}
# 0 is a real value only for the fee: included in the rent (管理費込) or not charged (なし).
ZERO_ALLOWED = {"managementFee"}
ZERO_FEE = re.compile(r"込|なし|無し|無料|(?<![\d,.])0円")
# Japanese eras: Western year = start + era year - 1.
ERAS = {"令和": 2019, "平成": 1989, "昭和": 1926}
# "1ヶ月", "1カ月", "1か月", "1月分"; OCR also turns ヶ into 为 or 个.
MONTHS = r"\s*(?:ヶ|カ|か|ヵ|箇|个|为)?\s*月"
MAX_COSTS = 20


def canon(text: str) -> str:
    """NFKC-fold (full-width to half-width) and drop whitespace, so OCR spacing does not matter."""
    return "".join(unicodedata.normalize("NFKC", text).split())


def _normalise_value(key: str, value: Any) -> Any:
    if value is None:
        return None
    if FIELD_TYPES[key] in ("number", "integer"):
        if isinstance(value, bool) or not isinstance(value, (int, float)) or value != value or value < 0:
            return None
        if value == 0 and key not in ZERO_ALLOWED:
            return None
        return round(value) if FIELD_TYPES[key] == "integer" or key in YEN_FIELDS else round(float(value), 2)
    text = " ".join(str(value).split())
    return text or None


def _era_years(text: str) -> set[int]:
    years = set()
    for era, start in ERAS.items():
        for match in re.finditer(rf"{era}(元|\d{{1,2}})年", text):
            number = 1 if match.group(1) == "元" else int(match.group(1))
            years.add(start + number - 1)
    return years


def _yen_found(value: int, text: str) -> bool:
    """Whole numbers only, so a fee of 5,000 is not "found" inside a rent of 105,000."""
    digits = text.replace(",", "")
    man = re.escape(f"{value / 10000:g}万")
    return bool(re.search(rf"(?<!\d){value}(?!\d)", digits) or re.search(rf"(?<![\d.]){man}", text))


def is_supported(key: str, value: Any, cited_text: str) -> bool:
    """Whether `value` can be read off the cited OCR text."""
    text = canon(cited_text)
    if key in YEN_FIELDS:
        if value == 0:
            return bool(ZERO_FEE.search(text))
        return _yen_found(value, text)
    if key == "areaSqm":
        return f"{value:.2f}" in text or f"{value:g}" in text
    if key == "constructionYear":
        return str(value) in text or value in _era_years(text)
    parts = [canon(part) for part in re.split(r"\s+", str(value)) if part]
    return bool(parts) and all(part in text for part in parts)


def cost_supported(unit: str, amount: float, cited_text: str) -> bool:
    """Whether a cost amount (months, percent, or yen) can be read off the cited OCR text."""
    text = canon(cited_text)
    if unit == "yen":
        return _yen_found(round(amount), text)
    number = rf"(?<![\d.]){re.escape(f'{amount:g}')}(?:\.0)?"
    if unit == "percent":
        return bool(re.search(number + r"\s*%", text))
    if amount == 0 and re.search(r"なし|無し|無(?!料)", text):
        return True
    return bool(re.search(number + MONTHS, text))


def union_box(lines: list[OcrLine], width: float, height: float) -> list[float] | None:
    if not lines:
        return None
    x1 = max(0.0, min(line.box[0] for line in lines))
    y1 = max(0.0, min(line.box[1] for line in lines))
    x2 = min(width, max(line.box[2] for line in lines))
    y2 = min(height, max(line.box[3] for line in lines))
    if x2 - x1 < 1 or y2 - y1 < 1:
        return None
    return [round(x1 / width, 4), round(y1 / height, 4), round((x2 - x1) / width, 4), round((y2 - y1) / height, 4)]


def _tsubo_mismatch(value: float, cited_text: str) -> str | None:
    match = re.search(r"\(?([\d.]+)坪", canon(cited_text))
    if not match:
        return None
    expected = float(match.group(1)) * SQM_PER_TSUBO
    if abs(value - expected) <= TSUBO_TOLERANCE_SQM:
        return None
    return f"専有面積（{value:g}㎡）が同じ行の坪表記（{match.group(1)}坪 ≈ {expected:.2f}㎡）と一致しません。"


def build_fields(mapping: MapperOutput, page: OcrPage) -> tuple[dict[str, dict[str, Any]], list[dict[str, Any]]]:
    """Turn the mapping into contract fields with evidence, plus warnings (the model's and ours)."""
    lines_by_id = {line.id: line for line in page.lines}
    fields: dict[str, dict[str, Any]] = {}
    warnings: list[dict[str, Any]] = [
        {"code": warning.code, "message": warning.message.strip(), "fields": list(dict.fromkeys(warning.fields))}
        for warning in mapping.warnings
        if warning.message.strip()
    ]

    for key in FIELD_KEYS:
        proposal = getattr(mapping.fields, key)
        value = _normalise_value(key, proposal.value)
        cited = [lines_by_id[line_id] for line_id in dict.fromkeys(proposal.lines) if line_id in lines_by_id]
        if value is None:
            fields[key] = {"value": None, "confidence": None, "evidence": None, "sourceText": None}
            continue
        cited_text = " / ".join(line.text for line in cited)
        supported = bool(cited) and is_supported(key, value, cited_text)
        ocr_confidence = min((line.confidence for line in cited), default=0.0)
        fields[key] = {
            "value": value,
            "confidence": round(ocr_confidence * (1 if supported else UNVERIFIED_FACTOR), 2),
            "evidence": union_box(cited, page.width, page.height),
            "sourceText": cited_text or None,
        }
        if not supported:
            warnings.append({
                "code": "other",
                "message": f"{FIELD_LABELS[key]}の値「{value}」が、根拠として示された行の文字と一致しません。原本で確認してください。",
                "fields": [key],
            })
        if key == "areaSqm" and (mismatch := _tsubo_mismatch(value, cited_text)):
            warnings.append({"code": "inconsistent_values", "message": mismatch, "fields": [key]})
    return fields, warnings


def _cost_amount(cost: CostMapping) -> float | int:
    return round(cost.amount) if cost.unit == "yen" else round(cost.amount, 2)


def build_costs(mapping: MapperOutput, page: OcrPage) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Money terms with the same evidence rules as fields: an amount missing from its lines is flagged."""
    lines_by_id = {line.id: line for line in page.lines}
    costs: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    for cost in mapping.costs[:MAX_COSTS]:
        cited = [lines_by_id[line_id] for line_id in dict.fromkeys(cost.lines) if line_id in lines_by_id]
        cited_text = " / ".join(line.text for line in cited)
        amount = _cost_amount(cost)
        label = " ".join(cost.label.split()) or cost.kind
        supported = bool(cited) and cost_supported(cost.unit, amount, cited_text)
        costs.append({
            "kind": cost.kind,
            "label": label,
            "amount": amount,
            "unit": cost.unit,
            "timing": cost.timing,
            "taxExcluded": cost.taxExcluded,
            "required": cost.required,
            "confidence": round(min((line.confidence for line in cited), default=0.0) * (1 if supported else UNVERIFIED_FACTOR), 2),
            "evidence": union_box(cited, page.width, page.height),
            "sourceText": cited_text or None,
        })
        if not supported:
            warnings.append({"code": "other", "message": f"「{label}」の金額が、根拠として示された行の文字と一致しません。原本で確認してください。", "fields": []})
    return costs, warnings


def contract_lines(page: OcrPage) -> list[dict[str, Any]]:
    """Every OCR line with its box normalized to the image, for glossary lookups and full-text views."""
    return [
        {"text": line.text, "confidence": round(line.confidence, 3), "box": union_box([line], page.width, page.height) or [0, 0, 0, 0]}
        for line in page.lines
    ]
