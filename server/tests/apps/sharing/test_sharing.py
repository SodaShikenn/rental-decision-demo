import json
import sqlite3
import pytest
from fastapi.testclient import TestClient
from app import create_app
from helper import AppError
from conftest import stub_ocr
from apps.sharing.store import ShareStore


def brief():
    return {
        "title": "条件メモ",
        "generatedAt": "2026-09-22",
        "candidates": [{"name": "A", "monthly": None, "area": None, "sources": []}],
        "preferences": "月額11万円以下を希望",
        "questions": ["募集条件を確認"],
        "observations": [],
        "destination": "",
    }


def test_tokens_are_hashed_and_owner_secret_is_required(tmp_path):
    path = tmp_path / "shares.sqlite3"
    store = ShareStore(path)
    created = store.create(brief(), 1)
    assert store.read(created["token"])["brief"] == brief()
    with sqlite3.connect(path) as db:
        row = db.execute("SELECT id,secret FROM shares").fetchone()
    assert created["token"] not in row and created["deleteSecret"] not in row
    with pytest.raises(AppError):
        store.revoke(created["token"], "x" * 43)
    store.revoke(created["token"], created["deleteSecret"])
    with pytest.raises(AppError):
        store.read(created["token"])


def test_expiry_and_capacity(tmp_path):
    now = [1000.0]
    store = ShareStore(tmp_path / "db", clock=lambda: now[0], capacity=1)
    created = store.create(brief(), 1)
    with pytest.raises(AppError) as error:
        store.create(brief(), 1)
    assert error.value.code == "share_capacity"
    now[0] += 86401
    with pytest.raises(AppError):
        store.read(created["token"])
    assert store.create(brief(), 1)["token"]


def test_api_roundtrip_rejects_provider_blobs_and_keeps_tokens_out_of_paths(
    settings_for, tmp_path, monkeypatch
):
    from extensions import ext_logger

    logs = []
    monkeypatch.setattr(ext_logger.logger, "info", logs.append)
    client = TestClient(
        create_app(
            settings_for(
                SHARE_DB_PATH=str(tmp_path / "db"), RATE_LIMIT_PER_MINUTE="100"
            ),
            ocr_reader=stub_ocr(),
        )
    )
    response = client.post("/api/shares", json={"brief": brief(), "expiresInDays": 1})
    assert response.status_code == 201
    created = response.json()
    read = client.post("/api/shares/read", json={"token": created["token"]})
    assert read.status_code == 200 and read.headers["cache-control"] == "no-store"
    assert (
        client.post(
            "/api/shares",
            json={"brief": {**brief(), "providerReviews": ["not allowed"]}},
        ).status_code
        == 400
    )
    assert (
        client.post(
            "/api/shares", json={"brief": brief(), "expiresInDays": 8}
        ).status_code
        == 400
    )
    assert (
        client.post(
            "/api/shares/revoke",
            json={k: created[k] for k in ["token", "deleteSecret"]},
        ).status_code
        == 200
    )
    assert (
        client.post("/api/shares/read", json={"token": created["token"]}).status_code
        == 404
    )
    assert all(
        created["token"] not in line and created["deleteSecret"] not in line
        for line in logs
    )


def test_sharing_can_be_disabled(settings_for, tmp_path):
    client = TestClient(
        create_app(
            settings_for(SHARING_ENABLED="false", SHARE_DB_PATH=str(tmp_path / "db")),
            ocr_reader=stub_ocr(),
        )
    )
    assert client.post("/api/shares", json={"brief": brief()}).status_code == 503
    assert not (tmp_path / "db").exists()
