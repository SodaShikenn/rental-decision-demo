"""Application factory (≈ KBQA app.py): load settings, initialize extensions, register app routers,
and install shared error handling.

Run locally:   uvicorn app:create_app --factory --reload --port 8000
API reference: http://localhost:8000/docs
To add an endpoint group, create apps/<name>/ with a `router` and include it in register_routers().
"""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.formparsers import MultiPartParser

from config import CURRENT_VERSION, MAX_UPLOAD_BYTES, MULTIPART_OVERHEAD_BYTES, OCR_ENGINE_LABEL, Settings, load_settings
from extensions import ext_cors, ext_gemini, ext_logger, ext_ocr, ext_rate_limit
from helper import AppError, error_response

# Keep uploads in memory for the life of the request. Starlette otherwise spools multipart files
# over 1 MB to a temporary file on disk, and uploaded images must never be written anywhere.
MultiPartParser.spool_max_size = MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD_BYTES


def create_app(settings: Settings | None = None, *, gemini_client: Any = None, ocr_reader: Any = None) -> FastAPI:
    """Build the app. Tests pass `settings`, a stub `gemini_client`, and a stub `ocr_reader`."""
    settings = settings or load_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        warm_up = None
        if settings.extraction_mode == "live" and settings.extraction_enabled:
            # Load the OCR models in the background so the first upload is not the slow one.
            warm_up = asyncio.create_task(app.state.ocr_warm_up())
        yield
        if warm_up and not warm_up.done():
            warm_up.cancel()
        await app.state.close_gemini()

    app = FastAPI(
        title="Rental Helper API",
        version=CURRENT_VERSION,
        description="候補の情報抽出・出典付き補完・徒歩と通勤・余暇・口コミ・対話・期限付き共有を独立した機能として提供します。",
        lifespan=lifespan,
        redoc_url=None,
    )
    app.state.settings = settings
    initialize_extensions(app, gemini_client, ocr_reader)
    register_routers(app)
    register_error_handlers(app)

    @app.get("/healthz", tags=["system"], summary="稼働状況")
    async def healthz() -> dict[str, Any]:
        """Used by container health checks and by the front end to show the real extraction status."""
        return {
            "status": "ok",
            "version": CURRENT_VERSION,
            "mode": settings.extraction_mode,
            "enabled": settings.extraction_enabled,
            "configured": settings.extraction_mode == "mock" or bool(settings.gemini_api_key),
            "model": settings.gemini_model,
            "ocr": OCR_ENGINE_LABEL,
            "research": {"enabled": settings.research_enabled, "configured": bool(settings.gemini_api_key)},
            "maps": {"configured": bool(settings.google_maps_api_key)},
        }

    return app


def initialize_extensions(app: FastAPI, gemini_client: Any, ocr_reader: Any) -> None:
    # Middleware added later wraps earlier middleware: the logger is outermost, so it records the
    # final status of every request, including origin rejections from ext_cors.
    ext_cors.init_app(app)
    ext_logger.init_app(app)
    ext_rate_limit.init_app(app)
    ext_gemini.init_app(app, gemini_client)
    ext_ocr.init_app(app, ocr_reader)


def register_routers(app: FastAPI) -> None:
    from apps.listing import router as listing_router

    app.include_router(listing_router)
    from apps.research import router as research_router
    app.include_router(research_router)
    from apps.maps import router as maps_router
    app.include_router(maps_router)
    from apps.advisor import router as advisor_router
    app.include_router(advisor_router)
    from apps.commute import router as commute_router
    app.include_router(commute_router)
    from apps.leisure import router as leisure_router
    app.include_router(leisure_router)
    from apps.reviews import router as reviews_router
    app.include_router(reviews_router)
    from apps.sharing import router as sharing_router
    app.include_router(sharing_router)


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, error: AppError):
        request.state.log["error"] = error.code
        return error_response(error)

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_error(request: Request, error: StarletteHTTPException):
        if error.status_code == 404:
            return error_response(AppError(404, "not_found", "Not found"))
        if error.status_code == 405:
            allow = (error.headers or {}).get("Allow", "")
            return error_response(AppError(405, "method_not_allowed", f"{allow} で送信してください。", {"Allow": allow}))
        return error_response(AppError(error.status_code, "http_error", str(error.detail)))

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(request: Request, error: RequestValidationError):
        return error_response(AppError(400, "invalid_request", "リクエストの形式が正しくありません。"))

    @app.exception_handler(Exception)
    async def handle_unexpected(request: Request, error: Exception):
        logging.getLogger("rental_helper").exception("unhandled error")
        return error_response(AppError(500, "internal", "解析サーバーで予期しないエラーが発生しました。"))
