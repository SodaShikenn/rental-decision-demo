from fastapi import APIRouter, Depends, Request
import httpx
from apps.listing import apply_rate_limit
from helper import json_response
from providers.dependencies import maps_key
from providers.google_maps import GoogleMaps, place_view
from .models import CommuteRequest, DestinationQuery
from .services import compare_commutes

router = APIRouter(prefix='/api', tags=['commute'], dependencies=[Depends(apply_rate_limit)])


@router.post('/destinations')
async def destinations(body: DestinationQuery, request: Request):
    async with httpx.AsyncClient(timeout=20) as client:
        places = await GoogleMaps(client, maps_key(request)).search(body.query)
        return json_response({'places': [place_view(p) for p in places]})


@router.post('/commutes')
async def commutes(body: CommuteRequest, request: Request):
    return json_response(await compare_commutes(body, maps_key(request)))
