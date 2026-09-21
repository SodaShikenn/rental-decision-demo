"""Same destination/schedule for every candidate; partial failures stay visible."""

import asyncio
from datetime import datetime, timezone
import httpx
from helper import AppError
from providers.routes import minutes, route_view
from providers.google_maps import GoogleMaps, place_view, directions_url


def recommend(routes, objective):
    key = {"fastest": "minutes", "transfers": "transfers", "walking": "walkingMinutes"}[
        objective
    ]
    known = [i for i, r in enumerate(routes) if r.get(key) is not None]
    return (
        min(known, key=lambda i: (routes[i][key], routes[i]["minutes"]))
        if known
        else None
    )


async def compare_commutes(body, key, *, transport=None):
    async with httpx.AsyncClient(timeout=20, transport=transport) as client:
        google = GoogleMaps(client, key)
        destination = place_view(
            await google.details(
                body.destinationId,
                "id,displayName,formattedAddress,location,googleMapsUri,attributions",
            )
        )
        semaphore = asyncio.Semaphore(3)
        at = body.at.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")

        async def candidate(c):
            base = {
                "id": c.id,
                "name": c.name,
                "routes": [],
                "recommended": None,
                "url": directions_url(
                    c.address or c.name,
                    destination["name"],
                    body.mode,
                    body.destinationId,
                ),
            }
            try:
                async with semaphore:
                    origin = await google.geocode(c.address) if c.address else None
                    if not origin:
                        return {**base, "status": "address_unverified"}
                    payload = {
                        "origin": {"location": {"latLng": origin["location"]}},
                        "destination": {"placeId": body.destinationId},
                        "travelMode": body.mode,
                        "languageCode": "ja",
                        "computeAlternativeRoutes": True,
                    }
                    if body.mode == "TRANSIT":
                        payload[body.timeKind + "Time"] = at
                        if body.objective != "fastest":
                            payload["transitPreferences"] = {
                                "routingPreference": {
                                    "transfers": "FEWER_TRANSFERS",
                                    "walking": "LESS_WALKING",
                                }[body.objective]
                            }
                    data = await google.routes(payload)
                    routes = [
                        v
                        for r in data.get("routes", [])
                        if (v := route_view(r, body.mode)) is not None
                    ][:4]
                    return {
                        **base,
                        "origin": origin,
                        "status": "checked" if routes else "no_route",
                        "routes": routes,
                        "recommended": recommend(routes, body.objective),
                    }
            except AppError:
                return {**base, "status": "unavailable"}

        return {
            "checkedAt": datetime.now(timezone.utc).isoformat(),
            "destination": destination,
            "schedule": body.model_dump(mode="json", exclude={"candidates"}),
            "candidates": await asyncio.gather(
                *[candidate(c) for c in body.candidates]
            ),
        }
