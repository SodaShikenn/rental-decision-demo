"""Listing-sheet extraction app (≈ a KBQA blueprint): the router plus checks that run before its routes."""

from fastapi import APIRouter, Depends, Request

from helper import AppError


async def ensure_enabled(request: Request) -> None:
    if not request.app.state.settings.extraction_enabled:
        raise AppError(503, "disabled", "画像解析は現在停止しています。")


async def apply_rate_limit(request: Request) -> None:
    key = request.client.host if request.client else "unknown"
    if not request.app.state.rate_limiter.allow(key):
        raise AppError(429, "rate_limited", "短時間に解析が集中しています。1分ほど待ってから再試行してください。", {"Retry-After": "60"})


router = APIRouter(prefix="/api", tags=["listing"], dependencies=[Depends(ensure_enabled), Depends(apply_rate_limit)])

from . import views  # noqa: E402,F401  (registers routes on the router)
