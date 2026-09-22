"""The fallback order is product behavior, not a suggestion left to the model."""

import asyncio
from types import SimpleNamespace as NS
import httpx
import pytest
from helper import AppError
from apps.reviews import fallback
from apps.reviews.nearby import nearby_buildings, reference_buildings, reference_address
from apps.reviews.web_models import WebReviewRequest

BODY = WebReviewRequest(name="サンプルⅠ 408号室", address="東京都渋谷区1-2-3")
APP = NS(
    state=NS(
        settings=NS(
            research_enabled=True, gemini_api_key="test", google_maps_api_key="test"
        )
    )
)
REF = {
    "id": "neighbor",
    "name": "隣のマンション",
    "address": "東京都渋谷区1-2-4",
    "distanceMeters": 80,
    "url": "https://maps.google.com",
    "attributions": [],
}


def report(scope="same_unit"):
    return {
        "scope": scope,
        "targetIndex": 0,
        "text": "静かとの投稿",
        "url": "https://example.com/review",
        "room": "408",
    }


def install(monkeypatch, stages, references=None):
    calls = []

    async def search(targets, app, stage):
        calls.append(stage)
        if stage == "building":
            assert "408" not in targets[0].name
            assert not targets[0].room
        reviews = stages[stage]
        if isinstance(reviews, Exception):
            raise reviews
        return {
            "reviews": reviews,
            "otherPages": [],
            "checkedAt": "now",
            "searchSuggestions": f"<div>{stage}</div>",
        }

    async def nearby(*args):
        calls.append("locations")
        return references or []

    monkeypatch.setattr(fallback, "search_sources", search)
    monkeypatch.setattr(fallback, "nearby_buildings", nearby)
    return calls


def test_exact_room_stops_before_building_or_nearby(monkeypatch):
    calls = install(monkeypatch, {"unit": [report(), report("same_building")]})
    result = asyncio.run(fallback.research_web_reviews(BODY, APP))
    assert calls == ["unit"]
    assert result["tier"] == "unit" and len(result["reviews"]) == 1


def test_building_fallback_does_not_promote_other_rooms(monkeypatch):
    calls = install(
        monkeypatch,
        {"unit": [report("other_unit")], "building": [report("other_unit")]},
    )
    result = asyncio.run(fallback.research_web_reviews(BODY, APP))
    assert calls == ["unit"]
    assert result["tier"] == "building"
    assert result["reviews"][0]["scope"] == "other_unit"
    calls = install(monkeypatch, {"unit": [], "building": [report("same_building")]})
    result = asyncio.run(fallback.research_web_reviews(BODY, APP))
    assert calls == ["unit", "building"] and result["tier"] == "building"


def test_no_known_room_starts_at_building(monkeypatch):
    calls = install(monkeypatch, {"building": [report("same_building")]})
    body = BODY.model_copy(update={"name": "サンプルⅠ"})
    result = asyncio.run(fallback.research_web_reviews(body, APP))
    assert calls == ["building"] and result["tier"] == "building"


def test_nearby_reviews_keep_their_actual_building_and_verified_distance(monkeypatch):
    calls = install(
        monkeypatch,
        {"unit": [], "building": [], "nearby": [report("other_unit")]},
        [REF],
    )
    result = asyncio.run(fallback.research_web_reviews(BODY, APP))
    assert calls == ["unit", "building", "locations", "nearby"]
    review = result["reviews"][0]
    assert result["tier"] == "nearby"
    assert review["scope"] == "nearby_building"
    assert review["referenceScope"] == "other_unit"
    assert review["reference"]["name"] == REF["name"]
    assert review["reference"]["distanceMeters"] == 80
    assert len(result["searchSuggestions"]) == 3


@pytest.mark.parametrize("references", [[], [REF]])
def test_all_empty_stays_empty(monkeypatch, references):
    install(monkeypatch, {"unit": [], "building": [], "nearby": []}, references)
    result = asyncio.run(fallback.research_web_reviews(BODY, APP))
    assert result["reviews"] == [] and result["tier"] == "none"
    assert result["status"] == "no_reviews"


def test_provider_failure_does_not_trigger_less_relevant_fallback(monkeypatch):
    calls = install(monkeypatch, {"unit": AppError(503, "busy", "busy")})
    with pytest.raises(AppError):
        asyncio.run(fallback.research_web_reviews(BODY, APP))
    assert calls == ["unit"]


ORIGIN = {"location": {"latitude": 35.6, "longitude": 139.7}}


def place(id, offset, name=None, **changes):
    return {
        "id": id,
        "displayName": {"text": name or id},
        "formattedAddress": f"東京都渋谷区1-2-{id}",
        "location": {"latitude": 35.6 + offset, "longitude": 139.7},
        "types": ["apartment_building"],
        **changes,
    }


def test_only_nearest_three_distinct_housing_buildings_within_300m_are_references():
    places = [
        place("far", 0.003),
        place("shop", 0.0001, types=["cafe"]),
        place("target", 0.0001, name="サンプルⅠ"),
        place(
            "same_address",
            0.0001,
            formattedAddress="日本、〒150-0000 東京都渋谷区1-2-3",
        ),
        place("c", 0.002),
        place("b", 0.001),
        place("a", 0.0005),
        place("a", 0.0005),
        place("d", 0.0025),
    ]
    found = reference_buildings(BODY, ORIGIN, places)
    assert [p["id"] for p in found] == ["a", "b", "c"]
    assert all(0 < p["distanceMeters"] <= 300 for p in found)


def test_nearby_retrieval_uses_precise_origin_and_residential_place_filter():
    calls = []

    def handler(request):
        calls.append(request)
        if "geocode" in str(request.url):
            return httpx.Response(
                200,
                json={
                    "status": "OK",
                    "results": [
                        {
                            "formatted_address": BODY.address,
                            "geometry": {
                                "location_type": "ROOFTOP",
                                "location": {"lat": 35.6, "lng": 139.7},
                            },
                        }
                    ],
                },
            )
        return httpx.Response(200, json={"places": [place("neighbor", 0.001)]})

    found = asyncio.run(
        nearby_buildings(BODY, "test", transport=httpx.MockTransport(handler))
    )
    assert len(found) == 1
    assert b'"radius":300' in calls[1].content
    assert b'"apartment_building"' in calls[1].content
    assert calls[1].headers["x-goog-fieldmask"].find("places.location") >= 0


def test_missing_maps_and_imprecise_origin_do_not_claim_no_reviews():
    with pytest.raises(AppError) as error:
        asyncio.run(nearby_buildings(BODY, ""))
    assert error.value.code == "nearby_reviews_not_configured"

    def imprecise(request):
        return httpx.Response(200, json={"status": "ZERO_RESULTS", "results": []})

    with pytest.raises(AppError) as error:
        asyncio.run(
            nearby_buildings(BODY, "test", transport=httpx.MockTransport(imprecise))
        )
    assert error.value.code == "review_origin_unverified"


def test_maps_address_suffix_does_not_prevent_matching_a_web_review():
    from apps.reviews.web_research import normalized_address

    address = reference_address(
        {
            "name": "隣のマンション",
            "address": "日本、〒156-0042 東京都世田谷区羽根木２丁目２８−２ 隣のマンション",
        }
    )
    assert address == normalized_address("東京都世田谷区羽根木2-28-2")
