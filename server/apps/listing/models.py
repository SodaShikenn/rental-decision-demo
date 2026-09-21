"""Data models (≈ KBQA models.py): the mapping Gemini must return, and the public API contract.

Field names are camelCase on purpose: they are the JSON contract shared with the front end.
"""

from __future__ import annotations

from typing import Any, Literal, get_args

from pydantic import BaseModel, Field

FieldKey = Literal["propertyName", "rent", "managementFee", "address", "station", "layout", "areaSqm", "constructionYear"]
WarningCode = Literal["inconsistent_values", "illegible", "multiple_candidates", "other"]
# Money terms besides rent and the fee. `unit` says what `amount` counts: months of rent, a percent of
# the monthly rent plus fees, or yen. `timing` says when it is paid.
CostKind = Literal["deposit", "keyMoney", "amortization", "guarantor", "freeRent", "renewal", "fee"]
CostUnit = Literal["months", "percent", "yen"]
CostTiming = Literal["initial", "monthly", "yearly", "renewal", "moveOut"]
FIELD_KEYS: tuple[str, ...] = get_args(FieldKey)
WARNING_CODES: tuple[str, ...] = get_args(WarningCode)
COST_KINDS: tuple[str, ...] = get_args(CostKind)
COST_UNITS: tuple[str, ...] = get_args(CostUnit)
COST_TIMINGS: tuple[str, ...] = get_args(CostTiming)

FIELD_TYPES = {
    "propertyName": "string",
    "rent": "number",
    "managementFee": "number",
    "address": "string",
    "station": "string",
    "layout": "string",
    "areaSqm": "number",
    "constructionYear": "integer",
}
FIELD_LABELS = {
    "propertyName": "物件・部屋名",
    "rent": "賃料",
    "managementFee": "管理費・共益費",
    "address": "住所",
    "station": "最寄駅",
    "layout": "間取り",
    "areaSqm": "専有面積",
    "constructionYear": "竣工年",
}


# ---- What Gemini returns --------------------------------------------------------------------------


class FieldMapping(BaseModel):
    value: str | int | float | None
    lines: list[int] = Field(default_factory=list)


class MappedFields(BaseModel):
    propertyName: FieldMapping
    rent: FieldMapping
    managementFee: FieldMapping
    address: FieldMapping
    station: FieldMapping
    layout: FieldMapping
    areaSqm: FieldMapping
    constructionYear: FieldMapping


class MappedWarning(BaseModel):
    code: WarningCode
    message: str
    fields: list[FieldKey]


class CostMapping(BaseModel):
    kind: CostKind
    label: str
    amount: float = Field(ge=0)
    unit: CostUnit
    timing: CostTiming
    taxExcluded: bool = False
    required: bool | None = None
    lines: list[int] = Field(default_factory=list)


class MapperOutput(BaseModel):
    fields: MappedFields
    costs: list[CostMapping] = Field(default_factory=list)
    warnings: list[MappedWarning] = Field(default_factory=list)


def _field_schema(key: str) -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {
            "value": {"type": [FIELD_TYPES[key], "null"]},
            "lines": {"type": "array", "items": {"type": "integer"}, "description": "ids of every OCR line the value came from"},
        },
        "required": ["value", "lines"],
    }


COST_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "kind": {"type": "string", "enum": list(COST_KINDS)},
        "label": {"type": "string", "description": "the term as printed, e.g. 鍵交換費用"},
        "amount": {"type": "number"},
        "unit": {"type": "string", "enum": list(COST_UNITS)},
        "timing": {"type": "string", "enum": list(COST_TIMINGS)},
        "taxExcluded": {"type": "boolean"},
        "required": {"type": ["boolean", "null"]},
        "lines": {"type": "array", "items": {"type": "integer"}},
    },
    "required": ["kind", "label", "amount", "unit", "timing", "taxExcluded", "required", "lines"],
}

# Written out flat (no $defs) so it stays inside the JSON Schema subset Gemini accepts.
MAPPING_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "fields": {
            "type": "object",
            "properties": {key: _field_schema(key) for key in FIELD_KEYS},
            "required": list(FIELD_KEYS),
        },
        "costs": {"type": "array", "items": COST_SCHEMA},
        "warnings": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "code": {"type": "string", "enum": list(WARNING_CODES)},
                    "message": {"type": "string", "description": "one short sentence in Japanese"},
                    "fields": {"type": "array", "items": {"type": "string", "enum": list(FIELD_KEYS)}},
                },
                "required": ["code", "message", "fields"],
            },
        },
    },
    "required": ["fields", "costs", "warnings"],
}


# ---- Public API contract ----------------------------------------------------------------------------


class ContractField(BaseModel):
    value: str | int | float | None = Field(description="null means unknown (not found or unreadable), never a low score.")
    confidence: float | None = Field(
        description="From the OCR engine for the cited lines (0–1), reduced when the value cannot be traced to them. null when value is null."
    )
    evidence: list[float] | None = Field(description="[x, y, width, height] of the cited lines, normalized to the image, or null.")
    sourceText: str | None = Field(description="The cited OCR lines as recognized, joined by ' / '.")


class ContractWarning(BaseModel):
    code: WarningCode
    message: str
    fields: list[FieldKey]


class ContractCost(BaseModel):
    kind: CostKind
    label: str
    amount: float
    unit: CostUnit
    timing: CostTiming
    taxExcluded: bool
    required: bool | None
    confidence: float = Field(description="As for fields: OCR confidence of the cited lines, reduced when the amount is not found in them.")
    evidence: list[float] | None
    sourceText: str | None


class ContractCheck(BaseModel):
    code: str = Field(description="Which pre-contract check matched, e.g. short_term_penalty.")
    category: Literal["cost", "exit", "viewing", "eligibility", "building"]
    title: str
    detail: str = Field(description="Why a renter should look at this, in Japanese.")
    evidence: list[float] | None
    sourceText: str


class ContractLine(BaseModel):
    text: str
    confidence: float
    box: list[float] = Field(description="[x, y, width, height] normalized to the image.")


class ImageSize(BaseModel):
    width: int
    height: int


class ExtractionMeta(BaseModel):
    mode: Literal["live", "mock"]
    model: str = Field(description="The Gemini model that mapped OCR lines to fields.")
    ocr: str = Field(description="The OCR engine that read the sheet.")
    extractedAt: str
    image: ImageSize
    confidenceSource: Literal["ocr-engine"]


class ExtractionResponse(BaseModel):
    documentId: str = Field(description="For log correlation only; nothing is stored.")
    meta: ExtractionMeta
    fields: dict[FieldKey, ContractField]
    costs: list[ContractCost] = Field(description="Money terms besides rent and the fee, for the move-in cost estimate.")
    checks: list[ContractCheck] = Field(description="Clauses renters tend to overlook, found in the OCR text by fixed rules.")
    lines: list[ContractLine] = Field(description="Every OCR line, in reading order.")
    warnings: list[ContractWarning]


class ErrorDetail(BaseModel):
    code: str
    message: str = Field(description="Japanese, safe to show to users.")


class ErrorResponse(BaseModel):
    error: ErrorDetail


def to_contract(
    fields: dict[str, dict[str, Any]],
    warnings: list[dict[str, Any]],
    *,
    costs: list[dict[str, Any]],
    checks: list[dict[str, Any]],
    lines: list[dict[str, Any]],
    document_id: str,
    extracted_at: str,
    model: str,
    ocr: str,
    mode: str,
    image: ImageSize,
) -> dict[str, Any]:
    return {
        "documentId": document_id,
        "meta": {
            "mode": mode,
            "model": model,
            "ocr": ocr,
            "extractedAt": extracted_at,
            "image": {"width": image.width, "height": image.height},
            "confidenceSource": "ocr-engine",
        },
        "fields": {key: fields[key] for key in FIELD_KEYS},
        "costs": costs,
        "checks": checks,
        "lines": lines,
        "warnings": warnings[:10],
    }
