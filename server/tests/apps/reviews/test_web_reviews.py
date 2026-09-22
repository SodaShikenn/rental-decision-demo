"""Review-source boundaries: identities, room scope, attribution and provider failures."""

from types import SimpleNamespace as NS

import pytest
from fastapi.testclient import TestClient
from google.genai import errors

from app import create_app
from apps.reviews.web_models import WebReviewRequest, WebReviewMapping
from apps.reviews.web_research import assemble_reviews, grouped_evidence
from conftest import stub_ocr

URL = "https://example.com/apartment/reviews"
NAME = "テストマンションⅠ"
ADDRESS = "東京都渋谷区富ヶ谷2-20-18"
BODY = {"name": NAME, "address": ADDRESS, "room": "408"}
TEXT = f"{NAME} {ADDRESS} 408号室。2025年5月の投稿では昼は静かとのこと。夜の騒音も報告されている。"


def item(**changes):
    return {
        "evidenceIndex": 0,
        "kind": "review",
        "scope": "unit",
        "name": NAME,
        "address": ADDRESS,
        "room": "408",
        "summary": "昼は静かとのこと。",
        "publishedDate": "2025年5月",
        **changes,
    }


def assemble(items=None, text=TEXT, body=None):
    return assemble_reviews(
        WebReviewRequest(**(body or BODY)),
        WebReviewMapping(items=items or [item()]),
        [{"url": URL, "title": "口コミサイト", "text": text}],
        "now",
    )


def response(text=TEXT, metadata=True):
    return NS(
        text=text,
        prompt_feedback=None,
        candidates=[
            NS(
                finish_reason="STOP",
                grounding_metadata=NS(
                    grounding_chunks=[NS(web=NS(uri=URL, title="口コミサイト"))],
                    grounding_supports=[
                        NS(segment=NS(text=text), grounding_chunk_indices=[0, 99])
                    ],
                    search_entry_point=NS(
                        rendered_content="<div>Google suggestions</div>"
                    ),
                )
                if metadata
                else None,
            )
        ],
    )


def test_opposing_reports_dates_duplicates_and_source_scope():
    result = assemble(
        [
            item(),
            item(),
            item(summary="夜の騒音も報告されている。", publishedDate="2026年9月"),
        ]
    )
    assert len(result["reviews"]) == 2
    assert result["sourceCount"] == 1
    assert result["reviews"][0]["scope"] == "same_unit"
    assert result["reviews"][0]["publishedDate"] == "2025年5月"
    assert result["reviews"][1]["publishedDate"] is None
    assert all(
        r["kind"] == "grounded_summary" and r["url"] == URL for r in result["reviews"]
    )


@pytest.mark.parametrize(
    "body,scope",
    [
        ({**BODY, "room": "409"}, "other_unit"),
        ({**BODY, "room": ""}, "other_unit"),
        ({**BODY, "name": NAME + " 408号室", "room": ""}, "same_unit"),
    ],
)
def test_other_units_and_unspecified_candidate_room(body, scope):
    assert assemble(body=body)["reviews"][0]["scope"] == scope
    assert (
        assemble([item(scope="building")], body=body)["reviews"][0]["scope"]
        == "same_building"
    )


@pytest.mark.parametrize(
    "text",
    [
        TEXT.replace(ADDRESS, "東京都渋谷区富ヶ谷2-20-188"),
        TEXT.replace(NAME, "テストマンションⅡ"),
        TEXT.replace(ADDRESS, ""),
        TEXT.replace(NAME, "別の建物"),
    ],
)
def test_mapper_cannot_attach_wrong_or_unsupported_identity(text):
    result = assemble(text=text)
    assert result["reviews"] == []
    assert result["status"] == "unverified"
    assert result["otherPages"][0]["url"] == URL


@pytest.mark.parametrize(
    "changes",
    [
        {"kind": "listing"},
        {"kind": "unavailable"},
        {"kind": "unknown"},
        {"scope": "neighborhood"},
    ],
)
def test_advertisements_unreadable_pages_and_neighborhood_are_not_reviews(changes):
    result = assemble([item(**changes)])
    assert result["reviews"] == []
    assert "text" not in result["otherPages"][0]


def test_mapper_cannot_invent_summary_or_source_index():
    assert assemble([item(summary="管理が完璧です")])["reviews"] == []
    assert assemble([item(summary=" ")])["reviews"] == []
    assert assemble([item(evidenceIndex=9)])["reviews"] == []


def test_identity_and_opinion_must_be_cited_to_the_same_source():
    reply = response()
    metadata = reply.candidates[0].grounding_metadata
    metadata.grounding_chunks.append(
        NS(web=NS(uri="https://example.com/other", title="別のサイト"))
    )
    metadata.grounding_supports = [
        NS(segment=NS(text=f"{NAME} {ADDRESS}"), grounding_chunk_indices=[0]),
        NS(segment=NS(text="昼は静かとのこと。"), grounding_chunk_indices=[1]),
    ]
    sources = grouped_evidence(reply)
    mapped = WebReviewMapping(items=[item(evidenceIndex=1)])
    result = assemble_reviews(WebReviewRequest(**BODY), mapped, sources, "now")
    assert result["reviews"] == []
    assert len(sources) == 2


def test_uncited_text_and_url_context_alone_are_insufficient():
    reply = response(metadata=False)
    reply.candidates[0].url_context_metadata = NS(
        url_metadata=[NS(retrieved_url=URL, url_retrieval_status="SUCCESS")]
    )
    assert grouped_evidence(reply) == []


def client_for(settings_for, replies, **settings):
    calls = []

    async def generate_content(**params):
        calls.append(params)
        reply = replies[len(calls) - 1]
        if isinstance(reply, Exception):
            raise reply
        return reply

    gemini = NS(aio=NS(models=NS(generate_content=generate_content)))
    app = create_app(
        settings_for(GEMINI_API_KEY="test", **settings),
        gemini_client=gemini,
        ocr_reader=stub_ocr(),
    )
    return TestClient(app), calls


def test_endpoint_searches_public_web_then_maps_cited_evidence(settings_for):
    client, calls = client_for(
        settings_for,
        [
            response(),
            response(
                WebReviewMapping(items=[item()]).model_dump_json(), metadata=False
            ),
        ],
    )
    reply = client.post("/api/reviews/web", json=BODY)
    assert reply.status_code == 200, reply.text
    assert reply.headers["cache-control"] == "no-store"
    assert reply.json()["reviews"][0]["scope"] == "same_unit"
    assert reply.json()["searchSuggestions"] == ["<div>Google suggestions</div>"]
    assert len(calls) == 2
    assert calls[0]["config"].tools[0].google_search is not None
    assert "exact" in calls[0]["contents"].lower()
    assert URL in calls[1]["contents"]


def test_empty_search_is_not_provider_failure(settings_for, monkeypatch):
    async def none(*args):
        return []

    monkeypatch.setattr("apps.reviews.fallback.nearby_buildings", none)
    client, calls = client_for(
        settings_for, [response(metadata=False), response(metadata=False)]
    )
    reply = client.post("/api/reviews/web", json=BODY)
    assert reply.json()["status"] == "no_reviews"
    assert reply.json()["reviews"] == []
    assert len(calls) == 2


@pytest.mark.parametrize(
    "reply,code",
    [
        (response("invalid JSON", metadata=False), "invalid_review_search"),
        (errors.ClientError(429, {"error": {"message": "busy"}}), "upstream_busy"),
    ],
)
def test_failed_mapping_or_provider_cannot_be_presented_as_no_reviews(
    settings_for, reply, code
):
    client, _ = client_for(settings_for, [response(), reply])
    result = client.post("/api/reviews/web", json=BODY)
    assert result.status_code >= 500
    assert result.json()["error"]["code"] == code


def test_missing_key_disabled_private_url_and_rate_limit(settings_for, monkeypatch):
    async def none(*args):
        return []

    monkeypatch.setattr("apps.reviews.fallback.nearby_buildings", none)
    client = TestClient(create_app(settings_for(), ocr_reader=stub_ocr()))
    assert (
        client.post("/api/reviews/web", json=BODY).json()["error"]["code"]
        == "review_search_not_configured"
    )
    assert (
        client.post(
            "/api/reviews/web", json={**BODY, "sourceUrl": "https://127.0.0.1/"}
        ).status_code
        == 400
    )
    disabled, calls = client_for(settings_for, [], RESEARCH_ENABLED="false")
    assert (
        disabled.post("/api/reviews/web", json=BODY).json()["error"]["code"]
        == "research_disabled"
    )
    assert calls == []
    limited, _ = client_for(
        settings_for,
        [response(metadata=False), response(metadata=False)],
        RATE_LIMIT_PER_MINUTE="1",
    )
    assert limited.post("/api/reviews/web", json=BODY).status_code == 200
    assert limited.post("/api/reviews/web", json=BODY).status_code == 429
