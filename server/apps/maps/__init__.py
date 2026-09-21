from fastapi import APIRouter, Depends, Request
from apps.listing import apply_rate_limit
from helper import AppError, json_response
from .models import MapsRequest
from .services import check_maps

router = APIRouter(prefix='/api', tags=['maps'], dependencies=[Depends(apply_rate_limit)])


@router.post('/check-maps')
async def maps_check(body: MapsRequest, request: Request):
    key = request.app.state.settings.google_maps_api_key
    if not key:
        raise AppError(503, 'maps_not_configured', '地図の確認が未設定です。')
    return json_response(await check_maps(body, key))
