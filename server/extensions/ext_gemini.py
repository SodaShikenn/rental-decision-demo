"""Google Gemini API client (google-genai). Created lazily, so mock mode and tests never need a key.
Pass `client` (via create_app(gemini_client=...)) to replace it in tests."""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI
from google import genai
from google.genai import types

from config import GEMINI_RETRY_ATTEMPTS, GEMINI_TIMEOUT_MS


def init_app(app: FastAPI, client: Any = None) -> None:
    holder: dict[str, Any] = {"client": client, "owned": client is None}

    def get_client() -> Any:
        if holder["client"] is None:
            holder["client"] = genai.Client(
                api_key=app.state.settings.gemini_api_key,
                http_options=types.HttpOptions(
                    timeout=GEMINI_TIMEOUT_MS,
                    retry_options=types.HttpRetryOptions(attempts=GEMINI_RETRY_ATTEMPTS),
                ),
            )
        return holder["client"]

    async def close() -> None:
        if holder["owned"] and holder["client"] is not None:
            await holder["client"].aio.aclose()

    app.state.gemini = get_client
    app.state.close_gemini = close
