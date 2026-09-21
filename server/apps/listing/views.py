"""HTTP layer for listing extraction (≈ KBQA views.py): parse and validate the upload, delegate to
services, and shape the response with models.to_contract."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.datastructures import UploadFile

from config import MAX_UPLOAD_BYTES, MULTIPART_OVERHEAD_BYTES, OCR_ENGINE_LABEL
from helper import AppError, json_response

from . import router
from .forms import validate_image
from .evidence import contract_lines
from .models import ErrorResponse, ExtractionResponse, ImageSize, to_contract
from .services import MOCK_OCR, mock_listing, read_listing

ERROR_RESPONSES = {status: {"model": ErrorResponse} for status in (400, 403, 413, 415, 422, 429, 502, 503, 504)}


def _too_large() -> AppError:
    return AppError(413, "image_too_large", "画像は5MB以下にしてください。")


@router.post(
    "/extract-listing",
    response_model=ExtractionResponse,
    responses=ERROR_RESPONSES,
    summary="募集図面の画像から項目を読み取る",
    description="multipart/form-data の `image` フィールドで PNG / JPEG / WEBP を送信します。",
)
async def extract_listing(request: Request) -> JSONResponse:
    settings = request.app.state.settings
    mode = settings.extraction_mode
    request.state.log["mode"] = mode

    if int(request.headers.get("content-length") or 0) > MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD_BYTES:
        raise _too_large()
    if not request.headers.get("content-type", "").startswith("multipart/form-data"):
        raise AppError(400, "invalid_form", "multipart/form-data の image フィールドで画像を送信してください。")
    try:
        form = await request.form(max_files=1, max_fields=10)
    except Exception as error:  # malformed multipart body
        raise AppError(400, "invalid_form", "multipart/form-data の image フィールドで画像を送信してください。") from error
    upload = form.get("image")
    if not isinstance(upload, UploadFile):
        raise AppError(400, "missing_image", "image フィールドに画像がありません。")
    data = await upload.read(MAX_UPLOAD_BYTES + 1)
    await form.close()
    if len(data) > MAX_UPLOAD_BYTES:
        raise _too_large()
    image = validate_image(data)

    document_id = str(uuid.uuid4())
    extracted_at = datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    request.state.log["documentId"] = document_id
    size = ImageSize(width=image.width, height=image.height)

    if mode == "mock":
        reading, ocr = mock_listing(image), MOCK_OCR
    else:
        if not settings.gemini_api_key:
            raise AppError(503, "not_configured", "解析サーバーに Gemini API キーが設定されていません。")
        reading, ocr = await read_listing(image, request.app), OCR_ENGINE_LABEL
        usage = reading.usage
        request.state.log["usage"] = {
            "input": getattr(usage, "prompt_token_count", None),
            "output": getattr(usage, "candidates_token_count", None),
            "thinking": getattr(usage, "thoughts_token_count", None),
        }
    request.state.log["ocrLines"] = len(reading.page.lines)
    body = to_contract(
        reading.fields,
        reading.warnings,
        costs=reading.costs,
        checks=reading.checks,
        lines=contract_lines(reading.page),
        document_id=document_id,
        extracted_at=extracted_at,
        model=reading.model,
        ocr=ocr,
        mode=mode,
        image=size,
    )
    return json_response(body)
