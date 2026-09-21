"""Google Maps HTTP boundary; observations are returned, never cached on disk."""

import math
import unicodedata
from urllib.parse import urlencode
import httpx
from helper import AppError

PLACE_FIELDS = "places.id,places.displayName,places.formattedAddress,places.location,places.googleMapsUri,places.businessStatus,places.types,places.attributions"


def normalized(value):
    return "".join(unicodedata.normalize("NFKC", value).split()).removesuffix("駅")


def distance(a, b):
    lat1, lat2 = math.radians(a["latitude"]), math.radians(b["latitude"])
    dlat = lat2 - lat1
    dlon = math.radians(b["longitude"] - a["longitude"])
    return (
        6371000
        * 2
        * math.asin(
            min(
                1,
                math.sqrt(
                    math.sin(dlat / 2) ** 2
                    + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
                ),
            )
        )
    )


async def request(client, method, url, **kwargs):
    try:
        response = await client.request(method, url, **kwargs)
        if response.status_code != 200:
            raise ValueError("provider rejected request")
        return response.json()
    except (httpx.HTTPError, ValueError):
        raise AppError(
            502,
            "maps_unavailable",
            "Google Maps に接続できませんでした。時間をおいて再確認してください。",
        ) from None


def place_view(place):
    return {
        "id": place["id"],
        "name": place.get("displayName", {}).get("text", ""),
        "address": place.get("formattedAddress", ""),
        "location": place.get("location"),
        "url": place.get("googleMapsUri", ""),
        "businessStatus": place.get("businessStatus", "UNKNOWN"),
        "attributions": place.get("attributions", []),
    }


def directions_url(origin, destination, mode="TRANSIT", place_id=None):
    params = {
        "api": 1,
        "origin": origin,
        "destination": destination,
        "travelmode": "walking" if mode == "WALK" else "transit",
    }
    if place_id:
        params["destination_place_id"] = place_id
    return "https://www.google.com/maps/dir/?" + urlencode(params)


class GoogleMaps:
    def __init__(self, client, key):
        self.client, self.key = client, key

    async def places(self, method, payload, fields=PLACE_FIELDS):
        data = await request(
            self.client,
            "POST",
            f"https://places.googleapis.com/v1/places:{method}",
            headers={"X-Goog-Api-Key": self.key, "X-Goog-FieldMask": fields},
            json=payload,
        )
        return data.get("places", [])

    async def search(self, query):
        return await self.places(
            "searchText",
            {
                "textQuery": query,
                "languageCode": "ja",
                "regionCode": "JP",
                "pageSize": 5,
            },
        )

    async def details(self, place_id, fields):
        return await request(
            self.client,
            "GET",
            f"https://places.googleapis.com/v1/places/{place_id}",
            headers={"X-Goog-Api-Key": self.key, "X-Goog-FieldMask": fields},
            params={"languageCode": "ja"},
        )

    async def geocode(self, address):
        data = await request(
            self.client,
            "GET",
            "https://maps.googleapis.com/maps/api/geocode/json",
            params={
                "address": address,
                "key": self.key,
                "language": "ja",
                "components": "country:JP",
            },
        )
        if data.get("status") not in ("OK", "ZERO_RESULTS"):
            raise AppError(
                502, "maps_unavailable", "住所を地図で確認できませんでした。"
            )
        found = data.get("results", [])
        if (
            len(found) != 1
            or found[0].get("partial_match")
            or found[0].get("geometry", {}).get("location_type")
            not in ("ROOFTOP", "RANGE_INTERPOLATED")
        ):
            return None
        result = found[0]
        point = result["geometry"]["location"]
        return {
            "address": result["formatted_address"],
            "location": {"latitude": point["lat"], "longitude": point["lng"]},
        }

    async def routes(self, payload):
        return await request(
            self.client,
            "POST",
            "https://routes.googleapis.com/directions/v2:computeRoutes",
            headers={
                "X-Goog-Api-Key": self.key,
                "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.warnings,routes.legs.steps.travelMode,routes.legs.steps.staticDuration,routes.legs.steps.transitDetails,routes.travelAdvisory.transitFare",
            },
            json=payload,
        )
