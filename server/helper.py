"""Shared helpers used across apps (≈ KBQA helper.py)."""

from __future__ import annotations

from fastapi.responses import JSONResponse

NO_STORE = {"Cache-Control": "no-store"}


class AppError(Exception):
    """An error that is safe to show to the client: HTTP status, stable code, and a Japanese message."""

    def __init__(self, status: int, code: str, message: str, headers: dict[str, str] | None = None) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.headers = headers or {}


def json_response(body: object, status: int = 200, headers: dict[str, str] | None = None) -> JSONResponse:
    return JSONResponse(body, status_code=status, headers={**NO_STORE, **(headers or {})})


def error_response(error: AppError) -> JSONResponse:
    return json_response({"error": {"code": error.code, "message": error.message}}, error.status, error.headers)
