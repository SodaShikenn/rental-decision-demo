"""Only attributed building-place reports; authors' residency is never inferred."""
import re
from datetime import datetime, timezone
import httpx
from helper import AppError
from providers.google_maps import GoogleMaps, place_view, normalized, distance

DETAIL_FIELDS = 'id,displayName,formattedAddress,location,googleMapsUri,attributions,types'


def building_name(name):
    return re.sub(r'[0-9a-z]+号室', '', normalized(name).lower()).strip()


def matches_building(place, name, origin):
    wanted = building_name(name)
    found = building_name(place.get('displayName', {}).get('text', ''))
    return bool(len(wanted) >= 3 and found == wanted
                and not set(place.get('types', [])) & {'cafe', 'restaurant', 'gym', 'store', 'lodging', 'supermarket'}
                and place.get('location') and distance(origin['location'], place['location']) <= 250)


async def search_reviews(body, key, *, transport=None):
    async with httpx.AsyncClient(timeout=20, transport=transport) as client:
        google = GoogleMaps(client, key)
        origin = await google.geocode(body.address)
        if not origin:
            return {'status': 'address_unverified', 'places': []}
        places = await google.search(f'{building_name(body.name)} {body.address}')
        matched = [place_view(p) for p in places if matches_building(p, body.name, origin)]
        return {'status': 'choose_place' if matched else 'entity_unverified', 'places': matched,
                'checkedAt': datetime.now(timezone.utc).isoformat()}


async def read_reviews(body, key, *, transport=None):
    async with httpx.AsyncClient(timeout=20, transport=transport) as client:
        google = GoogleMaps(client, key)
        origin = await google.geocode(body.address)
        place = await google.details(body.placeId, DETAIL_FIELDS)
        if not origin or not matches_building(place, body.name, origin):
            raise AppError(409, 'review_entity_unverified', '候補の建物と地点の一致を確認できません。再検索してください。')
        details = await google.details(body.placeId, 'id,reviews,rating,userRatingCount')
        reviews = []
        for r in details.get('reviews', [])[:5]:
            author = r.get('authorAttribution', {})
            if not author.get('displayName') or not r.get('googleMapsUri'):
                continue
            reviews.append({'id': r.get('name', ''), 'text': r.get('text', {}).get('text', ''),
                'originalText': r.get('originalText', {}).get('text', ''), 'rating': r.get('rating'),
                'publishedAt': r.get('publishTime'), 'relativeTime': r.get('relativePublishTimeDescription', ''),
                'author': {'name': author['displayName'], 'url': author.get('uri', ''), 'photo': author.get('photoUri', '')},
                'url': r['googleMapsUri'], 'reportUrl': r.get('flagContentUri', '')})
        return {'place': place_view(place), 'reviews': reviews, 'rating': details.get('rating'),
                'count': details.get('userRatingCount'), 'scope': 'building_place', 'order': 'provider_relevance',
                'checkedAt': datetime.now(timezone.utc).isoformat()}
