import asyncio
import httpx
import pytest
from helper import AppError
from apps.reviews.models import ReviewRequest
from apps.reviews.services import matches_building, read_reviews

origin = {"location": {"latitude": 35.6, "longitude": 139.7}}
place = {
    "id": "building_test",
    "displayName": {"text": "テストマンション"},
    "location": origin["location"],
    "types": ["apartment_building"],
}


def test_building_matching_rejects_nearby_shops_and_distant_namesakes():
    assert matches_building(place, "テストマンション 408号室", origin)
    assert not matches_building(
        {**place, "types": ["cafe"]}, "テストマンション", origin
    )
    assert not matches_building(
        {**place, "displayName": {"text": "テストマンションカフェ"}},
        "テストマンション",
        origin,
    )
    assert not matches_building(
        {**place, "location": {"latitude": 34, "longitude": 139}},
        "テストマンション",
        origin,
    )


def test_attribution_required_and_residency_never_inferred():
    def handler(request):
        if "geocode" in str(request.url):
            return httpx.Response(
                200,
                json={
                    "status": "OK",
                    "results": [
                        {
                            "formatted_address": "東京",
                            "geometry": {
                                "location_type": "ROOFTOP",
                                "location": {"lat": 35.6, "lng": 139.7},
                            },
                        }
                    ],
                },
            )
        if "reviews" in request.headers.get("x-goog-fieldmask", ""):
            return httpx.Response(
                200,
                json={
                    "rating": 4,
                    "userRatingCount": 2,
                    "reviews": [
                        {
                            "text": {"text": "静か"},
                            "googleMapsUri": "https://maps.google.com/review",
                            "authorAttribution": {"displayName": "投稿者"},
                        },
                        {"text": {"text": "出典不明"}},
                    ],
                },
            )
        return httpx.Response(200, json=place)

    body = ReviewRequest(
        name="テストマンション",
        address="東京都渋谷区一丁目",
        placeId="building_test",
        confirmed=True,
    )
    result = asyncio.run(
        read_reviews(body, "key", transport=httpx.MockTransport(handler))
    )
    assert len(result["reviews"]) == 1
    assert result["scope"] == "building_place"
    assert result["reviews"][0]["author"]["name"] == "投稿者"
    body.name = "別の建物"
    with pytest.raises(AppError) as error:
        asyncio.run(read_reviews(body, "key", transport=httpx.MockTransport(handler)))
    assert error.value.code == "review_entity_unverified"
