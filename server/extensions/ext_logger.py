"""One structured JSON log line per request, on stdout (docker logs, Cloud Run logging).

Views add fields with request.state.log[...] = ...; never add image bytes or extracted values."""

from __future__ import annotations

import json
import logging
import sys
import time

from fastapi import FastAPI, Request

logger = logging.getLogger("rental_helper.request")


def init_app(app: FastAPI) -> None:
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter("%(message)s"))
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
        logger.propagate = False

    @app.middleware("http")
    async def log_request(request: Request, call_next):
        started = time.perf_counter()
        request.state.log = {}
        status = 500
        try:
            response = await call_next(request)
            status = response.status_code
            return response
        finally:
            entry = {"event": "request", "method": request.method, "path": request.url.path, **request.state.log}
            entry.update(status=status, ms=round((time.perf_counter() - started) * 1000))
            logger.info(json.dumps(entry, ensure_ascii=False))
