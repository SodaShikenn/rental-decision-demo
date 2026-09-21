from fastapi import APIRouter, Depends, Request
from apps.listing import apply_rate_limit
from helper import json_response
from .models import AdvisorRequest
from .services import advise

router = APIRouter(prefix='/api', tags=['advisor'], dependencies=[Depends(apply_rate_limit)])

@router.post('/advise')
async def advisor(body: AdvisorRequest, request: Request):
    return json_response(await advise(body, request.app))
