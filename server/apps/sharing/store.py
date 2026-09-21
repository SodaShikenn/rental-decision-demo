"""Single-instance SQLite adapter. Public tokens and owner secrets are stored only as hashes."""

from contextlib import contextmanager
import hashlib
import hmac
import json
import secrets
import sqlite3
import time
from pathlib import Path
from helper import AppError


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


class ShareStore:
    def __init__(self, path, *, clock=time.time, capacity=1000):
        self.path, self.clock, self.capacity = Path(path), clock, capacity

    @contextmanager
    def connect(self):
        self.path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        db = sqlite3.connect(self.path, timeout=10)
        self.path.chmod(0o600)
        db.execute("PRAGMA secure_delete=ON")
        db.execute(
            "CREATE TABLE IF NOT EXISTS shares (id TEXT PRIMARY KEY, secret TEXT NOT NULL, body TEXT NOT NULL, expires REAL NOT NULL)"
        )
        db.execute("CREATE INDEX IF NOT EXISTS shares_expiry ON shares(expires)")
        try:
            with db:
                yield db
        finally:
            db.close()

    def create(self, brief, days):
        token, secret = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
        expires = self.clock() + days * 86400
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            db.execute("DELETE FROM shares WHERE expires <= ?", (self.clock(),))
            if db.execute("SELECT COUNT(*) FROM shares").fetchone()[0] >= self.capacity:
                raise AppError(
                    503,
                    "share_capacity",
                    "共有の保存容量に達しました。ファイル出力を使ってください。",
                )
            db.execute(
                "INSERT INTO shares VALUES (?, ?, ?, ?)",
                (
                    digest(token),
                    digest(secret),
                    json.dumps(brief, ensure_ascii=False),
                    expires,
                ),
            )
        return {"token": token, "deleteSecret": secret, "expiresAt": expires}

    def read(self, token):
        with self.connect() as db:
            db.execute("DELETE FROM shares WHERE expires <= ?", (self.clock(),))
            row = db.execute(
                "SELECT body, expires FROM shares WHERE id = ?", (digest(token),)
            ).fetchone()
        if not row:
            raise AppError(
                404, "share_not_found", "共有が見つからないか、期限切れ・削除済みです。"
            )
        return {"brief": json.loads(row[0]), "expiresAt": row[1]}

    def revoke(self, token, secret):
        with self.connect() as db:
            row = db.execute(
                "SELECT secret FROM shares WHERE id = ? AND expires > ?",
                (digest(token), self.clock()),
            ).fetchone()
            if not row or not hmac.compare_digest(row[0], digest(secret)):
                raise AppError(
                    404, "share_not_found", "削除できる共有が見つかりません。"
                )
            db.execute("DELETE FROM shares WHERE id = ?", (digest(token),))
