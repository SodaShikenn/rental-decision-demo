"""Fresh provider observations, never replacements for listing claims or proof of truth."""
import asyncio
import math
from datetime import datetime, timezone
from urllib.parse import urlencode

import httpx
from helper import AppError
from providers.google_maps import request, normalized, distance

PLACE_FIELDS = 'places.id,places.displayName,places.formattedAddress,places.location,places.googleMapsUri,places.businessStatus,places.types,places.attributions'
TYPES = {'station': ['train_station', 'subway_station'], 'supermarket': ['supermarket'], 'convenience_store': ['convenience_store']}


def comparison(claim, route):
    if not route:
        return {'status': 'unverified'}
    result = {'status': 'reference'}
    # Thresholds are UI attention rules, not certification of an advertisement.
    if claim.minutes is not None:
        delta = route['minutes'] - claim.minutes
        result.update(status='difference' if abs(delta) >= 3 else 'close', differenceMinutes=delta)
    if claim.meters is not None:
        delta = route['meters'] - claim.meters
        result['differenceMeters'] = delta
        if abs(delta) >= 100:
            result['status'] = 'difference'
        elif result['status'] == 'reference':
            result['status'] = 'close'
    return result


async def check_maps(body, key, *, transport=None):
    async with httpx.AsyncClient(timeout=20, transport=transport) as client:
        async def places(method, payload):
            data = await request(client, 'POST', f'https://places.googleapis.com/v1/places:{method}',
                                 headers={'X-Goog-Api-Key': key, 'X-Goog-FieldMask': PLACE_FIELDS}, json=payload)
            return data.get('places', [])

        geo = await request(client, 'GET', 'https://maps.googleapis.com/maps/api/geocode/json',
                            params={'address': body.address, 'key': key, 'language': 'ja', 'components': 'country:JP'})
        if geo.get('status') not in ('OK', 'ZERO_RESULTS'):
            raise AppError(502, 'maps_unavailable', '住所を地図で確認できませんでした。')
        results = geo.get('results', [])
        base = {'checkedAt': datetime.now(timezone.utc).isoformat(), 'claims': [], 'nearby': [], 'warnings': []}
        if len(results) != 1 or results[0].get('partial_match') or results[0].get('geometry', {}).get('location_type') not in ('ROOFTOP', 'RANGE_INTERPOLATED'):
            return {**base, 'status': 'address_unverified', 'message': '建物の位置を特定できませんでした。候補の住所を番地まで確認してください。'}
        origin = results[0]
        point = {'latitude': origin['geometry']['location']['lat'], 'longitude': origin['geometry']['location']['lng']}
        base['origin'] = {'address': origin['formatted_address'], 'location': point, 'precision': origin['geometry']['location_type'],
                          'url': 'https://www.google.com/maps/search/?' + urlencode({'api': 1, 'query': origin['formatted_address'], 'query_place_id': origin['place_id']})}
        semaphore = asyncio.Semaphore(4)

        async def route(place):
            try:
                async with semaphore:
                    data = await request(client, 'POST', 'https://routes.googleapis.com/directions/v2:computeRoutes',
                                         headers={'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.warnings'},
                                         json={'origin': {'location': {'latLng': point}}, 'destination': {'placeId': place['id']}, 'travelMode': 'WALK', 'languageCode': 'ja'})
                routes = data.get('routes', [])
                if not routes:
                    return None
                value = routes[0]
                return {'minutes': math.ceil(float(value['duration'].removesuffix('s')) / 60), 'meters': value['distanceMeters'], 'warnings': value.get('warnings', []),
                        'url': 'https://www.google.com/maps/dir/?' + urlencode({'api': 1, 'origin': f"{point['latitude']},{point['longitude']}", 'destination': place['displayName']['text'], 'destination_place_id': place['id'], 'travelmode': 'walking'})}
            except (AppError, KeyError, ValueError):
                return None

        def place_view(place):
            return {'id': place['id'], 'name': place.get('displayName', {}).get('text', ''), 'address': place.get('formattedAddress', ''),
                    'url': place.get('googleMapsUri', ''), 'businessStatus': place.get('businessStatus', 'UNKNOWN'), 'attributions': place.get('attributions', [])}

        async def check_claim(claim):
            item = {'claim': claim.model_dump(), 'status': 'unverified'}
            try:
                async with semaphore:
                    found = await places('searchText', {'textQuery': claim.name, 'languageCode': 'ja', 'regionCode': 'JP', 'pageSize': 5,
                                                       'locationBias': {'circle': {'center': point, 'radius': 3000}}})
                matched = [p for p in found if normalized(p.get('displayName', {}).get('text', '')) == normalized(claim.name)
                           and set(p.get('types', [])) & set(TYPES[claim.kind]) and p.get('location') and distance(point, p['location']) <= 3000]
                matched = list({p['id']: p for p in matched}.values())
                if len(matched) != 1:
                    return {**item, 'reason': '近隣で同名の施設を一意に特定できませんでした。'}
                place = matched[0]
                walk = await route(place)
                return {**item, **comparison(claim, walk), 'place': place_view(place), 'route': walk}
            except AppError:
                return {**item, 'reason': '施設情報を取得できませんでした。'}

        async def nearby(kind):
            try:
                async with semaphore:
                    found = await places('searchNearby', {'includedTypes': TYPES[kind], 'maxResultCount': 3, 'rankPreference': 'DISTANCE', 'languageCode': 'ja',
                                                          'locationRestriction': {'circle': {'center': point, 'radius': 1500}}})
                entries = await asyncio.gather(*[route(p) for p in found])
                return {'kind': kind, 'places': [{**place_view(p), 'route': walk} for p, walk in zip(found, entries)]}
            except AppError:
                return {'kind': kind, 'places': [], 'error': '周辺施設を取得できませんでした。'}

        claims, amenities = await asyncio.gather(asyncio.gather(*[check_claim(c) for c in body.claims]),
                                                asyncio.gather(*[nearby(k) for k in TYPES]))
        return {**base, 'status': 'checked', 'claims': list(claims), 'nearby': list(amenities)}
