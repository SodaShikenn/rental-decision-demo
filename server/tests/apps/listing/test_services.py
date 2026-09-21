import asyncio
from types import SimpleNamespace

import httpx
import pytest
from google.genai import errors as genai_errors
from google.genai import types

from apps.listing.forms import ValidatedImage
from apps.listing.services import read_listing
from config import load_settings
from conftest import LIVE_ENV, StubGemini, gemini_reply, stub_ocr
from extensions.ext_ocr import OcrPage
from helper import AppError

IMAGE = ValidatedImage("image/png", 2000, 1184, b"\x89PNG-bytes")


def read(reply, ocr=None, **env):
    """Run read_listing with stub OCR and Gemini, in an app shaped like create_app's."""
    gemini = StubGemini(reply)
    ocr = ocr or stub_ocr()
    app = SimpleNamespace(state=SimpleNamespace(gemini=lambda: gemini, ocr=ocr, settings=load_settings({**LIVE_ENV, **env})))
    return asyncio.run(read_listing(IMAGE, app)), gemini, ocr


def test_sends_only_the_ocr_text_to_gemini_with_a_json_schema():
    reading, gemini, ocr = read(gemini_reply())
    assert ocr.calls == [(IMAGE.data, "upload.png")]
    [params] = gemini.calls
    assert params["model"] == "gemini-3.8-flash"
    assert isinstance(params["contents"], str) and "[9] 賃料：￥88,000円" in params["contents"]
    assert IMAGE.data.decode("latin-1") not in params["contents"]  # the image itself is never sent
    config = params["config"]
    assert config.response_mime_type == "application/json"
    assert config.response_json_schema["required"] == ["fields", "costs", "warnings"]
    assert reading.costs[0]["kind"] == "deposit"
    assert "guarantor_fees" in [check["code"] for check in reading.checks]
    assert config.thinking_config.thinking_level == types.ThinkingLevel.LOW
    assert reading.fields["rent"]["value"] == 88000
    assert reading.model == "gemini-3.8-flash"


def test_model_and_thinking_level_come_from_the_environment():
    _, gemini, _ = read(gemini_reply(), GEMINI_MODEL="gemini-3.5-flash-lite", GEMINI_THINKING_LEVEL="minimal")
    assert gemini.calls[0]["model"] == "gemini-3.5-flash-lite"
    assert gemini.calls[0]["config"].thinking_config.thinking_level == types.ThinkingLevel.MINIMAL


def raises_app_error(reply, status: int, code: str, **kwargs):
    with pytest.raises(AppError) as raised:
        read(reply, **kwargs)
    assert (raised.value.status, raised.value.code) == (status, code)


def test_an_image_without_text_is_reported_before_calling_gemini():
    raises_app_error(gemini_reply(), 422, "no_text", ocr=stub_ocr(OcrPage(width=10, height=10, lines=[])))


def test_blocked_or_truncated_answers_are_reported_before_parsing():
    raises_app_error(gemini_reply(text="", block_reason="SAFETY"), 502, "refused")
    raises_app_error(gemini_reply(text="", finish=types.FinishReason.PROHIBITED_CONTENT), 502, "refused")
    raises_app_error(gemini_reply(text='{"fields":', finish=types.FinishReason.MAX_TOKENS), 502, "incomplete")


def test_output_that_does_not_match_the_schema_is_rejected():
    raises_app_error(gemini_reply(text='{"fields":{}}'), 502, "invalid_output")
    raises_app_error(gemini_reply(text=""), 502, "invalid_output")


@pytest.mark.parametrize(
    ("error", "status", "code"),
    [
        (genai_errors.ClientError(429, {"error": {"message": "quota"}}), 503, "upstream_busy"),
        (genai_errors.ClientError(403, {"error": {"message": "denied"}}), 503, "not_configured"),
        (genai_errors.ClientError(400, {"error": {"message": "API key not valid.", "details": [{"reason": "API_KEY_INVALID"}]}}), 503, "not_configured"),
        (genai_errors.ClientError(400, {"error": {"message": "bad schema"}}), 502, "upstream_error"),
        (genai_errors.ServerError(500, {"error": {"message": "boom"}}), 502, "upstream_error"),
        (genai_errors.ServerError(504, {"error": {"message": "deadline"}}), 504, "upstream_timeout"),
        (httpx.ReadTimeout("slow"), 504, "upstream_timeout"),
        (httpx.ConnectError("down"), 502, "upstream_error"),
    ],
)
def test_gemini_errors_map_to_client_safe_statuses(error, status, code):
    raises_app_error(error, status, code)
