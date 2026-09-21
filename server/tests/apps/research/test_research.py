from types import SimpleNamespace as NS

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app import create_app
from apps.research.models import ResearchRequest, ResearchMapping
from apps.research.services import assemble, cited_evidence
from conftest import stub_ocr

URL = "https://suumo.jp/chintai/jnc_test/"

def mapping(**changes):
    listing = dict(name="テストマンション", address="東京都渋谷区富ヶ谷2-20-18", room="408", scope="unit", listingDate="2026-09-20", status="current", facts=[dict(key="rent", value=110000, evidenceIndex=0), dict(key="constructionYear", value=2001, evidenceIndex=0)])
    listing.update(changes)
    return ResearchMapping(listings=[listing])

EVIDENCE = [{"text": "テストマンション 408号室 賃料11万円 2001年築", "url": URL, "title": "SUUMO"}]

def test_unit_fields_require_same_building_address_and_room():
    request = ResearchRequest(name="テストマンション 408号室", address="東京都渋谷区富ヶ谷2-20-18", room="408")
    result = assemble(request, mapping(), EVIDENCE, "now")[0]
    assert result["match"] == "same_unit"
    assert all(f["eligible"] for f in result["facts"])
    other = assemble(request, mapping(room="409"), EVIDENCE, "now")[0]
    assert other["match"] == "same_building"
    assert not other["facts"][0]["eligible"]
    assert other["facts"][1]["eligible"]
    wrong = assemble(request, mapping(address="東京都渋谷区別の住所"), EVIDENCE, "now")[0]
    assert all(not f["eligible"] for f in wrong["facts"])


def test_archives_historical_listings_and_ungrounded_values_do_not_fill_rent():
    request = ResearchRequest(url=URL)
    assert not assemble(request, mapping(status="historical"), EVIDENCE, "now")[0]["facts"][0]["eligible"]
    assert not assemble(request, mapping(scope="building"), EVIDENCE, "now")[0]["facts"][0]["eligible"]
    archive = [{**EVIDENCE[0], "url": "https://suumo.jp/library/example/"}]
    assert not assemble(request, mapping(), archive, "now")[0]["facts"][0]["eligible"]
    bad = mapping(facts=[dict(key="rent", value=999999, evidenceIndex=0), dict(key="rent", value=110000, evidenceIndex=7)])
    assert assemble(request, bad, EVIDENCE, "now") == []


@pytest.mark.parametrize("url", ["http://suumo.jp/", "https://127.0.0.1/", "https://[::1]/", "https://localhost/", "https://x.internal/", "https://user:pass@suumo.jp/", "https://suumo.jp:8000/"])
def test_rejects_non_public_urls(url):
    with pytest.raises((ValueError, ValidationError)):
        ResearchRequest(url=url)


def test_citations_come_from_provider_metadata():
    response = NS(candidates=[NS(grounding_metadata=NS(grounding_chunks=[NS(web=NS(uri=URL, title="SUUMO"))], grounding_supports=[NS(segment=NS(text="rent 11万円"), grounding_chunk_indices=[0,99])]))])
    assert cited_evidence(response) == [{"text": "rent 11万円", "url": URL, "title": "SUUMO"}]
    assert cited_evidence(NS(candidates=[NS()], text="invented")) == []


def test_endpoint_missing_key_disabled_validation_and_rate_limit(settings_for):
    client = TestClient(create_app(settings_for(), ocr_reader=stub_ocr()))
    response = client.post("/api/research-listing", json={"url": URL})
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "research_not_configured"
    assert client.post("/api/research-listing", json={}).status_code == 400
    disabled = TestClient(create_app(settings_for(RESEARCH_ENABLED="false"), ocr_reader=stub_ocr()))
    assert disabled.post("/api/research-listing", json={"url": URL}).json()["error"]["code"] == "research_disabled"
    limited = TestClient(create_app(settings_for(RATE_LIMIT_PER_MINUTE="1"), ocr_reader=stub_ocr()))
    limited.post("/api/research-listing", json={"url": URL})
    assert limited.post("/api/research-listing", json={"url": URL}).status_code == 429


def test_full_grounded_lookup_with_stubbed_provider(settings_for):
    calls = []
    async def generate_content(**kwargs):
        calls.append(kwargs)
        if len(calls) == 1:
            return NS(text="テストマンション 408号室 賃料11万円 2001年築", prompt_feedback=None, candidates=[NS(finish_reason="STOP", grounding_metadata=NS(grounding_chunks=[NS(web=NS(uri=URL, title="SUUMO"))], grounding_supports=[NS(segment=NS(text=EVIDENCE[0]["text"]), grounding_chunk_indices=[0])], search_entry_point=None))])
        return NS(text=mapping().model_dump_json(), prompt_feedback=None, candidates=[NS(finish_reason="STOP")])
    gemini = NS(aio=NS(models=NS(generate_content=generate_content)))
    client = TestClient(create_app(settings_for(GEMINI_API_KEY="test"), gemini_client=gemini, ocr_reader=stub_ocr()))
    response = client.post("/api/research-listing", json={"url": URL})
    assert response.status_code == 200, response.text
    fact = response.json()["listings"][0]["facts"][0]
    assert fact["value"] == 110000 and fact["eligible"]
    assert fact["source"]["url"] == URL
    assert len(calls) == 2
    assert response.headers["cache-control"] == "no-store"


def test_identity_keeps_room_numbers_and_address_boundaries():
    from apps.research.services import relation
    request = ResearchRequest(name="テストマンション", address="渋谷区1-11", room="408号室")
    other_room = mapping(address="渋谷区1-11", room="409号室").listings[0]
    assert relation(request, other_room) == "same_building"
    same_room = mapping(address="渋谷区1丁目11", room="408").listings[0]
    assert relation(request, same_room) == "same_unit"
    other_address = mapping(address="渋谷区11-1", room="408").listings[0]
    assert relation(request, other_address) == "possible_match"


def test_automatic_identity_requires_name_address_and_exact_room_in_citation():
    request = ResearchRequest(name="テストマンション", address="東京都渋谷区富ヶ谷2-20-18", room="408", layout="1K", areaSqm=21.74)
    assert not assemble(request, mapping(), EVIDENCE, "now")[0]["identityVerified"]
    cited = [{**EVIDENCE[0], "text": EVIDENCE[0]["text"] + " 東京都渋谷区富ヶ谷2丁目20-18"}]
    assert assemble(request, mapping(), cited, "now")[0]["identityVerified"]
    wrong_room = [{**cited[0], "text": cited[0]["text"].replace("408号室", "1408号室")}]
    assert not assemble(request, mapping(), wrong_room, "now")[0]["identityVerified"]
