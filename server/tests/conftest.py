"""Shared fixtures. Tests never reach the network: OCR and Gemini are always stubs, except in the
opt-in real-OCR test (RUN_OCR_TESTS=1)."""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

import pytest
from google.genai import types

from apps.listing.forms import ImageHeader
from apps.listing.mock import MOCK_MAPPING, mock_page
from config import load_settings

FIXTURES = Path(__file__).parent / "fixtures"
ORIGIN = "http://localhost:4173"
BASE_ENV = {"ALLOWED_ORIGINS": f"https://sodashikenn.github.io,{ORIGIN}", "EXTRACTION_MODE": "mock", "EXTRACTION_ENABLED": "true"}
LIVE_ENV = {"EXTRACTION_MODE": "live", "GEMINI_API_KEY": "test"}


@pytest.fixture
def fixture_png() -> bytes:
    return (FIXTURES / "listing-sheet.png").read_bytes()


@pytest.fixture
def settings_for():
    def build(**overrides: str):
        return load_settings({**BASE_ENV, **overrides})

    return build


def fixture_page():
    """The fixture's real OCR lines (from mock.py), in the fixture's own 2000x1184 space."""
    return mock_page(ImageHeader("image/png", 2000, 1184))


def gemini_reply(text: str | None = None, finish=types.FinishReason.STOP, block_reason=None, model: str = "gemini-3.8-flash"):
    """A stand-in for GenerateContentResponse with only the attributes the service reads."""
    return SimpleNamespace(
        text=MOCK_MAPPING.model_dump_json() if text is None else text,
        candidates=[SimpleNamespace(finish_reason=finish)],
        prompt_feedback=SimpleNamespace(block_reason=block_reason) if block_reason else None,
        model_version=model,
        usage_metadata=SimpleNamespace(prompt_token_count=900, candidates_token_count=300, thoughts_token_count=120),
    )


class StubGemini:
    """Records each request and returns (or raises) a canned reply, like client.aio.models.generate_content."""

    def __init__(self, reply) -> None:
        self.calls: list[dict] = []

        async def generate_content(**params):
            self.calls.append(params)
            if isinstance(reply, Exception):
                raise reply
            return reply

        self.aio = SimpleNamespace(models=SimpleNamespace(generate_content=generate_content))


def stub_ocr(page=None):
    """An OCR reader that returns a fixed page and records what it was given."""
    calls: list[tuple[bytes, str]] = []

    async def read(data: bytes, filename: str):
        calls.append((data, filename))
        return fixture_page() if page is None else page

    read.calls = calls
    return read
