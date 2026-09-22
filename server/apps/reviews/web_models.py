"""Public-web review retrieval, separate from the optional Maps review API."""

from typing import Literal
from pydantic import BaseModel, Field, field_validator
from providers.web_urls import public_url


class WebReviewRequest(BaseModel):
    name: str = Field(min_length=2, max_length=300)
    address: str = Field(default="", max_length=300)
    room: str = Field(default="", max_length=30)
    sourceUrl: str | None = Field(default=None, max_length=2048)

    @field_validator("sourceUrl")
    @classmethod
    def source_url(cls, value):
        return public_url(value) if value else None


class WebReviewItem(BaseModel):
    evidenceIndex: int = Field(ge=0)
    kind: Literal["review", "listing", "unavailable", "unknown"]
    scope: Literal["unit", "building", "neighborhood", "unknown"]
    name: str = Field(max_length=300)
    address: str = Field(max_length=300)
    room: str = Field(max_length=30)
    # Exact substrings of the cited search report, not claimed verbatim webpage quotes.
    summary: str = Field(min_length=1, max_length=400)
    publishedDate: str = Field(default="", max_length=80)


class WebReviewMapping(BaseModel):
    items: list[WebReviewItem] = Field(max_length=12)
