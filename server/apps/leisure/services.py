"""Nearby options first; user preferences are never inferred by this service."""
import asyncio
from datetime import datetime, timezone
import httpx
from helper import AppError
from providers.google_maps import GoogleMaps, PLACE_FIELDS, place_view, directions_url
from providers.routes import route_view


async def discover_leisure(body, key, *, transport=None):
    async with httpx.AsyncClient(timeout=20, transport=transport) as client:
        google = GoogleMaps(client, key)
        gate = asyncio.Semaphore(4)
        destination = None
        if body.destinationId:
            destination = await google.details(body.destinationId, 'id,displayName,formattedAddress,location,googleMapsUri,businessStatus,attributions')
        async def walk(origin, place):
            try:
                async with gate:
                    data = await google.routes({'origin': {'location': {'latLng': origin['location']}},
                                                'destination': {'placeId': place['id']}, 'travelMode': 'WALK', 'languageCode': 'ja'})
                routes = [v for r in data.get('routes', []) if (v := route_view(r, 'WALK')) is not None]
                return min(routes, key=lambda r: r['minutes']) if routes else None
            except AppError:
                return None
        async def candidate(c):
            base = {'id': c.id, 'name': c.name, 'groups': []}
            try:
                async with gate:
                    origin = await google.geocode(c.address) if c.address else None
                if not origin:
                    return {**base, 'status': 'address_unverified'}
                async def group(kind):
                    try:
                        if destination:
                            places = [destination]
                        else:
                            async with gate:
                                places = await google.places('searchNearby', {'includedTypes': [kind], 'maxResultCount': 2,
                                    'rankPreference': 'DISTANCE', 'languageCode': 'ja',
                                    'locationRestriction': {'circle': {'center': origin['location'], 'radius': 1500}}},
                                    PLACE_FIELDS + ',places.regularOpeningHours.weekdayDescriptions')
                        routes = await asyncio.gather(*[walk(origin, p) for p in places])
                        return {'kind': kind, 'places': [{**place_view(p), 'route': r,
                            'hours': p.get('regularOpeningHours', {}).get('weekdayDescriptions', []),
                            'routeUrl': directions_url(c.address, p.get('displayName', {}).get('text', ''), 'WALK', p['id'])}
                            for p, r in zip(places, routes)]}
                    except AppError:
                        return {'kind': kind, 'places': [], 'error': 'このカテゴリを取得できませんでした。'}
                return {**base, 'status': 'checked', 'origin': origin,
                        'groups': await asyncio.gather(*[group(k) for k in (['regular'] if destination else body.categories)])}
            except AppError:
                return {**base, 'status': 'unavailable'}
        return {'checkedAt': datetime.now(timezone.utc).isoformat(), 'radiusMeters': None if destination else 1500,
                'destination': place_view(destination) if destination else None,
                'candidates': await asyncio.gather(*[candidate(c) for c in body.candidates])}
