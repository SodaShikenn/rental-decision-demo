"""Find a bounded set of nearby residential buildings; never infer distance with AI."""

import unicodedata
import httpx
from helper import AppError
from providers.google_maps import GoogleMaps, distance, place_view
from .services import building_name
from .web_research import normalized_address

NEARBY_RADIUS_METERS = 300
NEARBY_LIMIT = 3
HOUSING_TYPES = {
    "apartment_building",
    "apartment_complex",
    "condominium_complex",
    "housing_complex",
}


def reference_address(place):
    # Places formattedAddress can append the building name; source addresses usually do not.
    address = unicodedata.normalize("NFKC", place["address"])
    name = unicodedata.normalize("NFKC", place["name"])
    return normalized_address(address.removesuffix(name).strip())


def reference_buildings(body, origin, places):
    found, seen = [], set()
    for place in places:
        view = place_view(place)
        if not view["name"] or not view["address"] or not view["location"]:
            continue
        if not HOUSING_TYPES.intersection(place.get("types", [])):
            continue
        if building_name(view["name"]) == building_name(body.name) or reference_address(
            view
        ) == normalized_address(body.address):
            continue
        meters = distance(origin["location"], view["location"])
        if meters > NEARBY_RADIUS_METERS or view["id"] in seen:
            continue
        seen.add(view["id"])
        # Store raw distance for strict radius checks; round only the display value.
        found.append({**view, "distanceMeters": round(meters), "_distance": meters})
    return [
        {k: v for k, v in item.items() if k != "_distance"}
        for item in sorted(found, key=lambda item: item["_distance"])[:NEARBY_LIMIT]
    ]


async def nearby_buildings(body, key, *, transport=None):
    if not key:
        raise AppError(
            503,
            "nearby_reviews_not_configured",
            "同じ建物の口コミは未取得です。近隣を調べるには地図への接続が必要です。",
        )
    async with httpx.AsyncClient(timeout=20, transport=transport) as client:
        google = GoogleMaps(client, key)
        origin = await google.geocode(body.address) if body.address else None
        if not origin:
            raise AppError(
                422,
                "review_origin_unverified",
                "候補の位置を確認できないため、近隣の口コミは表示していません。",
            )
        places = await google.places(
            "searchNearby",
            {
                "includedTypes": sorted(HOUSING_TYPES),
                "maxResultCount": 10,
                "rankPreference": "DISTANCE",
                "languageCode": "ja",
                "locationRestriction": {
                    "circle": {
                        "center": origin["location"],
                        "radius": NEARBY_RADIUS_METERS,
                    }
                },
            },
        )
        return reference_buildings(body, origin, places)
