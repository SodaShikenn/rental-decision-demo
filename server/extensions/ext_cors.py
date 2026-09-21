"""CORS for the browser front end. Only allowlisted origins (ALLOWED_ORIGINS) receive CORS headers;
a browser request from any other origin is rejected. Requests without an Origin header (curl,
server-to-server) pass through and are covered by the rate limit."""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import Response

from helper import AppError, error_response


def init_app(app: FastAPI) -> None:
    allowed = frozenset(app.state.settings.allowed_origins)

    def headers_for(origin: str | None) -> dict[str, str]:
        if not origin or origin not in allowed:
            return {}
        return {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Max-Age": "86400",
            "Vary": "Origin",
        }

    @app.middleware("http")
    async def cors(request: Request, call_next):
        origin = request.headers.get("origin")
        cors_headers = headers_for(origin)
        if origin and not cors_headers:
            return error_response(AppError(403, "origin_not_allowed", "このオリジンからの利用は許可されていません。"))
        if request.method == "OPTIONS":
            return Response(status_code=204, headers=cors_headers)
        response = await call_next(request)
        response.headers.update(cors_headers)
        return response
