from fastapi import APIRouter, Depends, Request
from apps.listing import apply_rate_limit
from helper import json_response
from providers.dependencies import maps_key
from .models import ReviewSearch, ReviewRequest
from .services import search_reviews, read_reviews

router = APIRouter(
    prefix="/api/reviews", tags=["reviews"], dependencies=[Depends(apply_rate_limit)]
)


@router.post("/search")
async def search(body: ReviewSearch, request: Request):
    return json_response(await search_reviews(body, maps_key(request)))


@router.post("")
async def reviews(body: ReviewRequest, request: Request):
    return json_response(await read_reviews(body, maps_key(request)))
