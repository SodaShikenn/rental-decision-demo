import asyncio
import json
import httpx
from apps.leisure.models import LeisureRequest
from apps.leisure.services import discover_leisure


def test_nearby_no_results_and_failed_routes_remain_distinct():
    def handler(request):
        if 'geocode' in str(request.url):
            return httpx.Response(200,json={'status':'OK','results':[{'formatted_address':'東京','geometry':{'location_type':'ROOFTOP','location':{'lat':35.6,'lng':139.7}}}]})
        if 'searchNearby' in str(request.url):
            category=json.loads(request.content)['includedTypes'][0]
            return httpx.Response(200,json={'places':[] if category=='park' else [{'id':'gym_test','displayName':{'text':'実在候補施設'},'businessStatus':'CLOSED_TEMPORARILY'}]})
        return httpx.Response(403,json={})
    body=LeisureRequest(candidates=[{'id':'a','name':'A','address':'東京都渋谷区一丁目'}],categories=['park','gym'])
    result=asyncio.run(discover_leisure(body,'key',transport=httpx.MockTransport(handler)))
    groups=result['candidates'][0]['groups']
    assert groups[0]['places']==[]
    assert groups[1]['places'][0]['route'] is None
    assert groups[1]['places'][0]['businessStatus']=='CLOSED_TEMPORARILY'
    assert result['radiusMeters']==1500


def test_ambiguous_origin_does_not_search_nearby():
    def handler(request):
        assert 'geocode' in str(request.url)
        return httpx.Response(200,json={'status':'ZERO_RESULTS','results':[]})
    body=LeisureRequest(candidates=[{'id':'a','name':'A','address':'東京都渋谷区'}])
    result=asyncio.run(discover_leisure(body,'key',transport=httpx.MockTransport(handler)))
    assert result['candidates'][0]['status']=='address_unverified'
