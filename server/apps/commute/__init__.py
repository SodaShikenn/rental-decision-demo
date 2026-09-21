from fastapi import APIRouter, Depends, Request
import httpx
from apps.listing import apply_rate_limit
from helper import AppError, json_response
from providers.google_maps import GoogleMaps, place_view
from .models import CommuteRequest, DestinationQuery
from .services import compare_commutes

router = APIRouter(prefix='/api', tags=['commute'], dependencies=[Depends(apply_rate_limit)])


def maps_key(request: Request):
    key = request.app.state.settings.google_maps_api_key
    if not key:
        raise AppError(503, 'maps_not_configured', 'Google Maps が未設定です。')
    return key


@router.post('/destinations')
async def destinations(body: DestinationQuery, request: Request):
    async with httpx.AsyncClient(timeout=20) as client:
        places = await GoogleMaps(client, maps_key(request)).search(body.query)
        return json_response({'places': [place_view(p) for p in places]})


@router.post('/commutes')
async def commutes(body: CommuteRequest, request: Request):
    return json_response(await compare_commutes(body, maps_key(request)))
