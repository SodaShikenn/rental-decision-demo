"""Central settings (≈ KBQA config.py).

Constants live here. Per-deployment values come from the environment: server/.env for local runs,
and real environment variables in containers (docker/docker-compose.yml, Cloud Run, etc.).
"""

from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

CURRENT_VERSION = "0.4.0"

# Extraction pipeline: Docling reads the text on the sheet (OCR runs inside this server), then a
# Gemini model maps the OCR lines to fields. Only the recognized text is sent to Google.
OCR_ENGINE_LABEL = "Docling + RapidOCR (PP-OCRv6)"
OCR_LANGUAGE = "iso:ja"
DEFAULT_GEMINI_MODEL = "gemini-3.8-flash"
GEMINI_THINKING_LEVELS = ("minimal", "low", "medium", "high")
GEMINI_TIMEOUT_MS = 60_000
GEMINI_RETRY_ATTEMPTS = 2
GEMINI_MAX_OUTPUT_TOKENS = 8192

# Upload limits. The browser downsizes sheets to a 2560 px long edge before sending; the server
# accepts a little more and rejects anything that would make OCR slow or memory-hungry.
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MULTIPART_OVERHEAD_BYTES = 64 * 1024
MAX_IMAGE_EDGE = 4096
MAX_IMAGE_PIXELS = 12_000_000

DEFAULT_ALLOWED_ORIGINS = "https://sodashikenn.github.io,http://localhost:4173,http://127.0.0.1:4173"
DEFAULT_RATE_LIMIT_PER_MINUTE = 5


@dataclass(frozen=True)
class Settings:
    allowed_origins: tuple[str, ...]
    # "mock" returns the fixture reading without OCR or Gemini; "live" runs the real pipeline.
    extraction_mode: str = "live"
    # Kill switch: EXTRACTION_ENABLED=false stops extraction without a code change.
    extraction_enabled: bool = True
    gemini_api_key: str = ""
    gemini_model: str = DEFAULT_GEMINI_MODEL
    gemini_thinking_level: str = "low"
    # Extraction requests per client IP per minute (per process; see ext_rate_limit).
    rate_limit_per_minute: int = DEFAULT_RATE_LIMIT_PER_MINUTE


def _split(value: str) -> tuple[str, ...]:
    return tuple(item.strip() for item in value.split(",") if item.strip())


def load_settings(env: Mapping[str, str] | None = None) -> Settings:
    """Read settings from `env`, or from the process environment plus server/.env."""
    if env is None:
        load_dotenv(Path(__file__).with_name(".env"))
        env = os.environ
    thinking = env.get("GEMINI_THINKING_LEVEL", "low").lower()
    return Settings(
        allowed_origins=_split(env.get("ALLOWED_ORIGINS", DEFAULT_ALLOWED_ORIGINS)),
        extraction_mode="mock" if env.get("EXTRACTION_MODE") == "mock" else "live",
        extraction_enabled=env.get("EXTRACTION_ENABLED", "true").lower() != "false",
        gemini_api_key=env.get("GEMINI_API_KEY", ""),
        gemini_model=env.get("GEMINI_MODEL", "") or DEFAULT_GEMINI_MODEL,
        gemini_thinking_level=thinking if thinking in GEMINI_THINKING_LEVELS else "low",
        rate_limit_per_minute=int(env.get("RATE_LIMIT_PER_MINUTE", DEFAULT_RATE_LIMIT_PER_MINUTE)),
    )
