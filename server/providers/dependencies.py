from fastapi import Request
from helper import AppError


def maps_key(request: Request):
    key = request.app.state.settings.google_maps_api_key
    if not key:
        raise AppError(503, "maps_not_configured", "Google Maps が未設定です。")
    return key
