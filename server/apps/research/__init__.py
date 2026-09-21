from fastapi import APIRouter, Depends, Request
from apps.listing import apply_rate_limit
from helper import AppError, json_response
from .models import ResearchRequest
from .services import research

router = APIRouter(prefix="/api", tags=["research"], dependencies=[Depends(apply_rate_limit)])

@router.post("/research-listing")
async def research_listing(body: ResearchRequest, request: Request):
    if not request.app.state.settings.research_enabled:
        raise AppError(503, "research_disabled", "オンライン調査は現在停止しています。")
    return json_response(await research(body, request.app))
