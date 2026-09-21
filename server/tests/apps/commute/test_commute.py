import asyncio
import json
from datetime import datetime, timedelta, timezone
import httpx
import pytest
from pydantic import ValidationError
from apps.commute.models import CommuteRequest
from apps.commute.services import compare_commutes, route_view, recommend


def body(**patch):
    return CommuteRequest(
        **(
            {
                "candidates": [
                    {"id": "a", "name": "A", "address": "東京都渋谷区一丁目"},
                    {"id": "b", "name": "B", "address": ""},
                ],
                "destinationId": "place_test",
                "at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
                **patch,
            }
        )
    )


def test_schedule_and_identity_validation():
    assert body().at.tzinfo is not None
    for patch in [
        {"at": "2026-09-23T09:00:00"},
        {"at": (datetime.now(timezone.utc) + timedelta(days=101)).isoformat()},
        {"candidates": [{"id": "a", "name": "A"}, {"id": "a", "name": "B"}]},
        {"destinationId": "../secret"},
    ]:
        with pytest.raises(ValidationError):
            body(**patch)


def test_unknown_route_fields_never_win_recommendations():
    unknown = route_view({"duration": "1800s"}, "TRANSIT")
    assert (
        unknown["walkingMinutes"] is None
        and unknown["transfers"] is None
        and unknown["fare"] is None
    )
    known = {"minutes": 40, "walkingMinutes": 10, "transfers": 1}
    assert recommend([unknown, known], "walking") == 1
    assert recommend([unknown], "transfers") is None
    assert route_view({"duration": "NaNs"}, "TRANSIT") is None
    assert route_view({"duration": "600s"}, "WALK")["walkingMinutes"] == 10


def test_same_schedule_partial_results_and_transit_details():
    requests = []

    def handler(request):
        if "geocode" in str(request.url):
            return httpx.Response(
                200,
                json={
                    "status": "OK",
                    "results": [
                        {
                            "formatted_address": "東京都渋谷区一丁目",
                            "geometry": {
                                "location_type": "ROOFTOP",
                                "location": {"lat": 35.6, "lng": 139.7},
                            },
                        }
                    ],
                },
            )
        if request.method == "GET":
            return httpx.Response(
                200,
                json={
                    "id": "place_test",
                    "displayName": {"text": "勤務先"},
                    "formattedAddress": "東京",
                },
            )
        requests.append(json.loads(request.content))
        return httpx.Response(
            200,
            json={
                "routes": [
                    {
                        "duration": "1500s",
                        "legs": [
                            {
                                "steps": [
                                    {"travelMode": "WALK", "staticDuration": "300s"},
                                    {
                                        "travelMode": "TRANSIT",
                                        "transitDetails": {
                                            "transitLine": {"name": "鉄道"},
                                            "stopDetails": {},
                                        },
                                    },
                                ]
                            }
                        ],
                    }
                ]
            },
        )

    request_body = body(objective="transfers")
    result = asyncio.run(
        compare_commutes(request_body, "key", transport=httpx.MockTransport(handler))
    )
    assert [c["status"] for c in result["candidates"]] == [
        "checked",
        "address_unverified",
    ]
    route = result["candidates"][0]["routes"][0]
    assert (
        route["minutes"] == 25
        and route["walkingMinutes"] == 5
        and route["transfers"] == 0
    )
    assert requests[0]["arrivalTime"] == request_body.at.isoformat().replace(
        "+00:00", "Z"
    )
    assert requests[0]["transitPreferences"]["routingPreference"] == "FEWER_TRANSFERS"
    assert result["candidates"][1]["routes"] == []


def test_no_route_and_provider_failure_are_distinct():
    for rejected, expected in [(False, "no_route"), (True, "unavailable")]:

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
            if request.method == "GET":
                return httpx.Response(200, json={"id": "place_test"})
            return httpx.Response(403 if rejected else 200, json={"routes": []})

        result = asyncio.run(
            compare_commutes(body(), "key", transport=httpx.MockTransport(handler))
        )
        assert result["candidates"][0]["status"] == expected
