from fastapi import APIRouter, Depends, Request
from apps.listing import apply_rate_limit
from helper import json_response
from providers.dependencies import maps_key
from .models import LeisureRequest
from .services import discover_leisure

router = APIRouter(
    prefix="/api", tags=["leisure"], dependencies=[Depends(apply_rate_limit)]
)


@router.post("/leisure")
async def leisure(body: LeisureRequest, request: Request):
    return json_response(await discover_leisure(body, maps_key(request)))
