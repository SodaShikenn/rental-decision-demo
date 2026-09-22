import json

import pytest
from fastapi.testclient import TestClient

from app import create_app
from conftest import LIVE_ENV, ORIGIN, StubGemini, gemini_reply, stub_ocr
from extensions import ext_logger

ROUTE = "/api/extract-listing"


def client_for(settings, gemini=None, ocr=None) -> TestClient:
    return TestClient(create_app(settings, gemini_client=gemini, ocr_reader=ocr or stub_ocr()))


def upload(client: TestClient, data: bytes, *, origin: str | None = ORIGIN, field: str = "image", filename: str = "sheet.png"):
    headers = {"Origin": origin} if origin else {}
    return client.post(ROUTE, files={field: (filename, data, "image/png")}, headers=headers)


def error_code(response) -> str:
    return response.json()["error"]["code"]


def test_mock_mode_returns_the_contract_with_cors_for_an_allowed_origin(settings_for, fixture_png):
    response = upload(client_for(settings_for()), fixture_png)
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == ORIGIN
    assert response.headers["cache-control"] == "no-store"
    body = response.json()
    assert (body["meta"]["mode"], body["meta"]["confidenceSource"]) == ("mock", "ocr-engine")
    assert len(body["documentId"]) == 36
    assert body["fields"]["rent"] == {"value": 88000, "confidence": 0.97, "evidence": [0.0295, 0.2255, 0.2265, 0.0448], "sourceText": "賃料：￥88,000円"}
    assert body["warnings"][0]["code"] == "inconsistent_values"
    # Money terms for the move-in estimate, clauses to check, and the full OCR text.
    assert [(cost["kind"], cost["amount"], cost["unit"]) for cost in body["costs"]][:2] == [("deposit", 1, "months"), ("keyMoney", 1, "months")]
    assert all(cost["confidence"] > 0.9 and cost["evidence"] for cost in body["costs"])
    assert [check["code"] for check in body["checks"]] == ["guarantor_fees", "insurance", "key_exchange", "renewal_fee", "as_is", "restrictions"]
    assert len(body["lines"]) == 23 and body["lines"][0]["text"] == "賃貸マンション"


def test_logs_one_json_line_per_request_with_ids_never_extracted_values(settings_for, fixture_png, monkeypatch):
    lines: list[str] = []
    monkeypatch.setattr(ext_logger.logger, "info", lines.append)
    upload(client_for(settings_for()), fixture_png)
    assert len(lines) == 1
    entry = json.loads(lines[0])
    assert (entry["status"], entry["path"], entry["mode"], entry["ocrLines"]) == (200, ROUTE, "mock", 23)
    assert len(entry["documentId"]) == 36
    assert "88000" not in lines[0] and "高円寺" not in lines[0]


def test_requests_without_origin_are_allowed_without_cors_headers(settings_for, fixture_png):
    response = upload(client_for(settings_for()), fixture_png, origin=None)
    assert response.status_code == 200
    assert "access-control-allow-origin" not in response.headers


def test_preflight_routing_and_method_errors(settings_for):
    client = client_for(settings_for())
    preflight = client.options(ROUTE, headers={"Origin": ORIGIN, "Access-Control-Request-Method": "POST"})
    assert preflight.status_code == 204
    assert preflight.headers["access-control-allow-methods"] == "GET, POST, OPTIONS"
    assert error_code(client.get("/nope")) == "not_found"
    wrong_method = client.get(ROUTE, headers={"Origin": ORIGIN})
    assert wrong_method.status_code == 405
    assert wrong_method.headers["allow"] == "POST"
    assert wrong_method.headers["access-control-allow-origin"] == ORIGIN


def test_rejects_origins_not_on_the_allowlist(settings_for, fixture_png):
    response = upload(client_for(settings_for()), fixture_png, origin="https://evil.example")
    assert (response.status_code, error_code(response)) == (403, "origin_not_allowed")


def test_kill_switch_and_rate_limit(settings_for, fixture_png):
    disabled = upload(client_for(settings_for(EXTRACTION_ENABLED="false")), fixture_png)
    assert (disabled.status_code, error_code(disabled)) == (503, "disabled")
    client = client_for(settings_for(RATE_LIMIT_PER_MINUTE="2"))
    assert [upload(client, fixture_png).status_code for _ in range(3)] == [200, 200, 429]
    limited = upload(client, fixture_png)
    assert (limited.headers["retry-after"], error_code(limited)) == ("60", "rate_limited")


@pytest.mark.parametrize(
    ("data", "field", "status", "code"),
    [
        (None, "file", 400, "missing_image"),
        (b"not an image", "image", 415, "unsupported_image"),
        (b"\0" * (5 * 1024 * 1024 + 1), "image", 413, "image_too_large"),
    ],
)
def test_validates_the_upload(settings_for, fixture_png, data, field, status, code):
    response = upload(client_for(settings_for()), data if data is not None else fixture_png, field=field)
    assert (response.status_code, error_code(response)) == (status, code)


def test_rejects_bodies_that_are_not_multipart(settings_for):
    response = client_for(settings_for()).post(ROUTE, content=b"x", headers={"Origin": ORIGIN, "Content-Type": "text/plain"})
    assert (response.status_code, error_code(response)) == (400, "invalid_form")


def test_live_mode_requires_a_gemini_key(settings_for, fixture_png):
    response = upload(client_for(settings_for(EXTRACTION_MODE="live")), fixture_png)
    assert (response.status_code, error_code(response)) == (503, "not_configured")


def test_live_mode_runs_ocr_then_gemini_and_returns_checked_fields(settings_for, fixture_png):
    gemini, ocr = StubGemini(gemini_reply()), stub_ocr()
    response = upload(client_for(settings_for(**LIVE_ENV), gemini, ocr), fixture_png)
    assert response.status_code == 200
    body = response.json()
    assert (body["meta"]["mode"], body["meta"]["model"]) == ("live", "gemini-3.8-flash")
    assert body["meta"]["ocr"].startswith("Docling")
    assert body["fields"]["areaSqm"]["value"] == 20.15
    assert ocr.calls[0][0] == fixture_png and ocr.calls[0][1] == "upload.png"
    assert len(gemini.calls) == 1


def test_live_mode_surfaces_extraction_errors_with_their_status(settings_for, fixture_png):
    gemini = StubGemini(gemini_reply(text="", block_reason="SAFETY"))
    response = upload(client_for(settings_for(**LIVE_ENV), gemini), fixture_png)
    assert (response.status_code, error_code(response)) == (502, "refused")


def test_health_reports_mode_readiness_and_pipeline(settings_for):
    mock = client_for(settings_for()).get("/healthz").json()
    assert (mock["status"], mock["mode"], mock["configured"]) == ("ok", "mock", True)
    live = client_for(settings_for(EXTRACTION_MODE="live")).get("/healthz").json()
    assert (live["mode"], live["configured"], live["model"]) == ("live", False, "gemini-3.8-flash")
    assert live["ocr"].startswith("Docling")
    assert live["sharing"] == {"enabled": True}
    disabled = client_for(settings_for(SHARING_ENABLED="false")).get("/healthz").json()
    assert disabled["sharing"] == {"enabled": False}


def test_sideways_phone_photos_are_turned_upright_before_ocr():
    from io import BytesIO

    from PIL import Image

    from extensions.ext_ocr import upright

    sideways = BytesIO()
    exif = Image.Exif()
    exif[0x0112] = 6  # stored rotated; viewers turn it 90° clockwise
    Image.new("RGB", (40, 20), "white").save(sideways, "JPEG", exif=exif)
    data, name = upright(sideways.getvalue(), "photo.jpg")
    assert name == "photo.png" and Image.open(BytesIO(data)).size == (20, 40)
    plain = BytesIO()
    Image.new("RGB", (40, 20), "white").save(plain, "JPEG")
    assert upright(plain.getvalue(), "sheet.jpg") == (plain.getvalue(), "sheet.jpg")  # nothing re-encoded
