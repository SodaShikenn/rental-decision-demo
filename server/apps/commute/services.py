"""Same destination/schedule for every candidate; partial failures stay visible."""
import asyncio
import math
from datetime import datetime, timezone
import httpx
from helper import AppError
from providers.google_maps import GoogleMaps, place_view, directions_url


def minutes(duration):
    if not isinstance(duration, str) or not duration.endswith('s'):
        return None
    try:
        value = float(duration[:-1])
        return math.ceil(value / 60) if math.isfinite(value) and value >= 0 else None
    except ValueError:
        return None


def route_view(route, mode):
    duration = minutes(route.get('duration'))
    if duration is None:
        return None
    steps = [s for leg in route.get('legs', []) for s in leg.get('steps', [])]
    transit = [s.get('transitDetails') for s in steps if s.get('travelMode') == 'TRANSIT']
    walking = [minutes(s.get('staticDuration')) for s in steps if s.get('travelMode') == 'WALK']
    complete_steps = bool(steps) and all(s.get('travelMode') for s in steps)
    walk = sum(walking) if complete_steps and all(m is not None for m in walking) else None
    lines = []
    for detail in transit:
        if not detail:
            continue
        line = detail.get('transitLine', {})
        stops = detail.get('stopDetails', {})
        lines.append({'name': line.get('nameShort') or line.get('name', '路線名未取得'),
                      'from': stops.get('departureStop', {}).get('name', ''), 'to': stops.get('arrivalStop', {}).get('name', ''),
                      'departure': stops.get('departureTime'), 'arrival': stops.get('arrivalTime'),
                      'agencies': line.get('agencies', [])})
    return {'minutes': duration, 'meters': route.get('distanceMeters'),
            'walkingMinutes': duration if mode == 'WALK' else walk,
            'transfers': 0 if mode == 'WALK' else max(0, len(transit) - 1) if complete_steps else None,
            'lines': lines, 'fare': route.get('travelAdvisory', {}).get('transitFare'),
            'warnings': route.get('warnings', [])}


def recommend(routes, objective):
    key = {'fastest': 'minutes', 'transfers': 'transfers', 'walking': 'walkingMinutes'}[objective]
    known = [i for i, r in enumerate(routes) if r.get(key) is not None]
    return min(known, key=lambda i: (routes[i][key], routes[i]['minutes'])) if known else None


async def compare_commutes(body, key, *, transport=None):
    async with httpx.AsyncClient(timeout=20, transport=transport) as client:
        google = GoogleMaps(client, key)
        destination = place_view(await google.details(body.destinationId, 'id,displayName,formattedAddress,location,googleMapsUri,attributions'))
        semaphore = asyncio.Semaphore(3)
        at = body.at.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')
        async def candidate(c):
            base = {'id': c.id, 'name': c.name, 'routes': [], 'recommended': None,
                    'url': directions_url(c.address or c.name, destination['name'], body.mode, body.destinationId)}
            try:
                async with semaphore:
                    origin = await google.geocode(c.address) if c.address else None
                    if not origin:
                        return {**base, 'status': 'address_unverified'}
                    payload = {'origin': {'location': {'latLng': origin['location']}}, 'destination': {'placeId': body.destinationId},
                               'travelMode': body.mode, 'languageCode': 'ja', 'computeAlternativeRoutes': True}
                    if body.mode == 'TRANSIT':
                        payload[body.timeKind + 'Time'] = at
                        if body.objective != 'fastest':
                            payload['transitPreferences'] = {'routingPreference': {'transfers': 'FEWER_TRANSFERS', 'walking': 'LESS_WALKING'}[body.objective]}
                    data = await google.routes(payload)
                    routes = [v for r in data.get('routes', []) if (v := route_view(r, body.mode)) is not None][:4]
                    return {**base, 'origin': origin, 'status': 'checked' if routes else 'no_route', 'routes': routes,
                            'recommended': recommend(routes, body.objective)}
            except AppError:
                return {**base, 'status': 'unavailable'}
        return {'checkedAt': datetime.now(timezone.utc).isoformat(), 'destination': destination,
                'schedule': body.model_dump(mode='json', exclude={'candidates'}),
                'candidates': await asyncio.gather(*[candidate(c) for c in body.candidates])}
