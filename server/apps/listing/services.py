"""Business logic for listing extraction (≈ KBQA services.py): OCR with Docling, then field mapping
with Gemini, then the evidence checks in evidence.py."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx
from fastapi import FastAPI
from google.genai import errors as genai_errors
from google.genai import types
from pydantic import ValidationError

from config import GEMINI_MAX_OUTPUT_TOKENS
from extensions.ext_ocr import OcrPage
from helper import AppError
from providers.gemini import to_app_error as _to_app_error

from .checks import detect_checks
from .evidence import build_costs, build_fields
from .forms import ValidatedImage
from .mock import MOCK_MAPPING, MOCK_MODEL, MOCK_OCR, mock_page
from .models import MAPPING_SCHEMA, MapperOutput
from .prompts import SYSTEM_PROMPT, user_prompt

__all__ = ["MOCK_MODEL", "MOCK_OCR", "ListingReading", "check_reading", "mock_listing", "read_listing"]

EXTENSIONS = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}
BLOCKED_FINISH_REASONS = {
    types.FinishReason.SAFETY,
    types.FinishReason.BLOCKLIST,
    types.FinishReason.PROHIBITED_CONTENT,
    types.FinishReason.SPII,
    types.FinishReason.RECITATION,
}


@dataclass(frozen=True)
class ListingReading:
    page: OcrPage
    fields: dict[str, dict[str, Any]]
    costs: list[dict[str, Any]]
    checks: list[dict[str, Any]]
    warnings: list[dict[str, Any]]
    model: str
    usage: Any = None


def check_reading(mapping: MapperOutput, page: OcrPage, model: str, usage: Any = None) -> ListingReading:
    """Trace the mapping to its OCR lines, and run the pre-contract checks on the page."""
    fields, warnings = build_fields(mapping, page)
    costs, cost_warnings = build_costs(mapping, page)
    return ListingReading(page=page, fields=fields, costs=costs, checks=detect_checks(page, fields), warnings=warnings + cost_warnings, model=model, usage=usage)


async def map_fields(page: OcrPage, app: FastAPI) -> tuple[MapperOutput, str, Any]:
    """Ask Gemini to map OCR lines to fields. Only the recognized text is sent, never the image."""
    settings = app.state.settings
    try:
        response = await app.state.gemini().aio.models.generate_content(
            model=settings.gemini_model,
            contents=user_prompt(page.lines),
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                response_mime_type="application/json",
                response_json_schema=MAPPING_SCHEMA,
                thinking_config=types.ThinkingConfig(thinking_level=types.ThinkingLevel(settings.gemini_thinking_level.upper())),
                max_output_tokens=GEMINI_MAX_OUTPUT_TOKENS,
            ),
        )
    except genai_errors.APIError as error:
        raise _to_app_error(error) from error
    except httpx.TimeoutException as error:
        raise AppError(504, "upstream_timeout", "解析がタイムアウトしました。もう一度お試しください。") from error
    except httpx.HTTPError as error:
        raise AppError(502, "upstream_error", "解析サービスに接続できませんでした。") from error

    # Check why generation stopped before reading any output.
    feedback = response.prompt_feedback
    candidate = response.candidates[0] if response.candidates else None
    finish = candidate.finish_reason if candidate else None
    if (feedback and feedback.block_reason) or finish in BLOCKED_FINISH_REASONS:
        raise AppError(502, "refused", "この画像の文字は解析できませんでした。募集図面の画像か確認してください。")
    if finish == types.FinishReason.MAX_TOKENS:
        raise AppError(502, "incomplete", "解析結果が途中で途切れました。もう一度お試しください。")
    try:
        mapping = MapperOutput.model_validate_json(response.text or "")
    except ValidationError as error:
        raise AppError(502, "invalid_output", "解析結果の形式が不正でした。もう一度お試しください。") from error
    return mapping, response.model_version or settings.gemini_model, response.usage_metadata


async def read_listing(image: ValidatedImage, app: FastAPI) -> ListingReading:
    """OCR the image inside this server, map the lines with Gemini, and check every value against
    the lines it cites. The image exists only in this request's memory and is never stored."""
    page = await app.state.ocr(image.data, f"upload.{EXTENSIONS[image.media_type]}")
    if not page.lines:
        raise AppError(422, "no_text", "画像から文字を読み取れませんでした。募集図面の画像か、文字が読める解像度かを確認してください。")
    mapping, model, usage = await map_fields(page, app)
    return check_reading(mapping, page, model, usage)


def mock_listing(image: ValidatedImage) -> ListingReading:
    return check_reading(MOCK_MAPPING, mock_page(image), MOCK_MODEL)
