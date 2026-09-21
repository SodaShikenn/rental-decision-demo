import asyncio
import httpx
from fastapi.testclient import TestClient
from app import create_app
from apps.maps.models import Claim, MapsRequest
from apps.maps.services import check_maps, comparison
from conftest import stub_ocr

POINT = {'latitude': 35.66, 'longitude': 139.66}


def provider(*, approximate=False, fail_routes=False, ambiguous=False):
    def handle(request):
        if 'geocode' in str(request.url):
            return httpx.Response(200, json={'status': 'OK', 'results': [{'place_id': 'origin', 'formatted_address': '東京都世田谷区代田5-35-30', 'geometry': {'location': {'lat': 35.66, 'lng': 139.66}, 'location_type': 'APPROXIMATE' if approximate else 'ROOFTOP'}}]})
        if 'computeRoutes' in str(request.url):
            return httpx.Response(503 if fail_routes else 200, json={'routes': [{'duration': '301s', 'distanceMeters': 420}]})
        place = {'id': 'station', 'displayName': {'text': '下北沢駅'}, 'formattedAddress': '東京都世田谷区', 'location': POINT, 'types': ['train_station'], 'businessStatus': 'OPERATIONAL'}
        return httpx.Response(200, json={'places': [place, {**place, 'id': 'other'}] if ambiguous else [place]})
    return httpx.MockTransport(handle)


def run(**kwargs):
    return asyncio.run(check_maps(MapsRequest(address='東京都世田谷区代田5-35-30', claims=[Claim(name='下北沢駅', minutes=2)]), 'secret', transport=provider(**kwargs)))


def test_real_routes_compared_without_overwriting_claim():
    result = run()
    claim = result['claims'][0]
    assert claim['status'] == 'difference'
    assert claim['claim']['minutes'] == 2
    assert claim['route']['minutes'] == 6
    assert claim['route']['meters'] == 420
    assert claim['differenceMinutes'] == 4
    assert result['checkedAt']
    assert 'secret' not in str(result)


def test_approximate_address_is_not_verified():
    result = run(approximate=True)
    assert result['status'] == 'address_unverified'
    assert not result['claims'] and not result['nearby']


def test_failed_route_and_ambiguous_destination_are_unverified():
    assert run(fail_routes=True)['claims'][0]['status'] == 'unverified'
    assert run(ambiguous=True)['claims'][0]['status'] == 'unverified'


def test_missing_claim_is_reference_not_match():
    assert comparison(Claim(name='駅'), {'minutes': 3, 'meters': 100})['status'] == 'reference'
    assert comparison(Claim(name='店', meters=100), {'minutes': 3, 'meters': 250})['status'] == 'difference'


def test_endpoint_missing_key_and_validation(settings_for):
    client = TestClient(create_app(settings_for(), ocr_reader=stub_ocr()))
    assert client.post('/api/check-maps', json={'address': '東京都世田谷区'}).status_code == 503
    assert client.post('/api/check-maps', json={'address': ''}).status_code == 400
