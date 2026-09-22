"""Explicit allowlist: no raw provider responses, review bodies, images, or chat logs."""

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Source(StrictModel):
    label: str = Field(min_length=1, max_length=300)
    url: HttpUrl
    retrievedAt: str = Field(default="", max_length=80)

    @field_validator("url")
    @classmethod
    def https_only(cls, value):
        if value.scheme != "https":
            raise ValueError("HTTPS required")
        return value


class SharedCandidate(StrictModel):
    name: str = Field(min_length=1, max_length=300)
    monthly: int | None = Field(default=None, ge=0, le=100000000)
    area: float | None = Field(default=None, ge=0, le=100000)
    sources: list[Source] = Field(default_factory=list, max_length=8)


class Brief(StrictModel):
    title: str = Field(default="住まい選びの条件メモ", max_length=120)
    generatedAt: str = Field(max_length=80)
    candidates: list[SharedCandidate] = Field(max_length=6)
    preferences: str = Field(max_length=8000)
    questions: list[str] = Field(max_length=100)
    # Accept older clients without saving or redisplaying their retired notes.
    observations: list[str] = Field(default_factory=list, max_length=100, exclude=True)
    destination: str = Field(default="", max_length=300)

    @field_validator("questions", "observations")
    @classmethod
    def bounded_lines(cls, values):
        if any(len(v) > 1300 for v in values):
            raise ValueError("Line too long")
        return values


class ShareCreate(StrictModel):
    brief: Brief
    expiresInDays: int = Field(default=1, ge=1, le=7)

    @field_validator("brief")
    @classmethod
    def bounded_brief(cls, value):
        if len(value.model_dump_json().encode()) > 64000:
            raise ValueError("Brief too large")
        return value


class ShareRead(StrictModel):
    token: str = Field(pattern=r"^[A-Za-z0-9_-]{43}$")


class ShareRevoke(ShareRead):
    deleteSecret: str = Field(pattern=r"^[A-Za-z0-9_-]{43}$")
