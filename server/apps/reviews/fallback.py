"""Exact room → same building → verified nearby buildings; stop at the first evidence tier."""

import asyncio
import re
import unicodedata
from helper import AppError
from .nearby import nearby_buildings, reference_address, NEARBY_RADIUS_METERS
from .web_models import WebReviewRequest
from .web_research import search_sources, room_number


def target_room(body):
    if body.room:
        return room_number(body.room)
    match = re.search(
        r"([0-9]+[a-zA-Z]?)\s*号室", unicodedata.normalize("NFKC", body.name)
    )
    return match.group(1) if match else ""


def building_target(body):
    name = re.sub(
        r"[0-9]+[a-zA-Z]?\s*号室", "", unicodedata.normalize("NFKC", body.name)
    ).strip()
    return body.model_copy(update={"name": name, "room": ""})


def finish(result, reviews, tier, searched, suggestions):
    return {
        **result,
        "reviews": reviews,
        "tier": tier,
        "searched": searched,
        "status": "found" if reviews else "no_reviews",
        "sourceCount": len({r["url"] for r in reviews}),
        "searchSuggestions": suggestions,
        "nearbyRadiusMeters": NEARBY_RADIUS_METERS,
    }


async def research_web_reviews(body, app):
    settings = app.state.settings
    if not settings.research_enabled:
        raise AppError(503, "research_disabled", "オンライン調査は現在停止しています。")
    if not settings.gemini_api_key:
        raise AppError(
            503,
            "review_search_not_configured",
            "ネット上の口コミ検索にはGeminiの接続が必要です。",
        )
    searched, suggestions = [], []

    async def search(targets, stage):
        result = await search_sources(targets, app, stage)
        searched.append(stage)
        if result["searchSuggestions"]:
            suggestions.append(result["searchSuggestions"])
        return result

    try:
        async with asyncio.timeout(180):
            if target_room(body):
                result = await search([body], "unit")
                exact = [r for r in result["reviews"] if r["scope"] == "same_unit"]
                if exact:
                    return finish(result, exact, "unit", searched, suggestions)
                # The room search may already have found valid building-level reports.
                # Keep that evidence instead of repeating a query and potentially losing it.
                if result["reviews"]:
                    return finish(
                        result, result["reviews"], "building", searched, suggestions
                    )
            result = await search([building_target(body)], "building")
            if result["reviews"]:
                return finish(
                    result, result["reviews"], "building", searched, suggestions
                )
            # A failure is not evidence of absence: provider exceptions stop expansion.
            references = await nearby_buildings(body, settings.google_maps_api_key)
            searched.append("nearby_locations")
            if not references:
                return finish(result, [], "none", searched, suggestions)
            targets = [
                WebReviewRequest(name=p["name"], address=reference_address(p))
                for p in references
            ]
            result = await search(targets, "nearby")
            reviews = []
            for review in result["reviews"]:
                reference = references[review["targetIndex"]]
                reviews.append(
                    {
                        **review,
                        "scope": "nearby_building",
                        "referenceScope": review["scope"],
                        "reference": {
                            key: reference[key]
                            for key in (
                                "name",
                                "address",
                                "distanceMeters",
                                "url",
                                "attributions",
                            )
                        },
                    }
                )
            return finish(
                result, reviews, "nearby" if reviews else "none", searched, suggestions
            )
    except TimeoutError as error:
        raise AppError(
            504,
            "review_search_timeout",
            "口コミ検索がタイムアウトしました。再検索してください。",
        ) from error
