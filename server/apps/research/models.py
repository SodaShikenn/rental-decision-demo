"""Source-linked listing research with explicit identity and eligibility metadata."""
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from apps.listing.models import FieldKey
from providers.web_urls import public_url


class ResearchRequest(BaseModel):
    url: str | None = Field(default=None, max_length=2048)
    name: str = Field(default="", max_length=300)
    address: str = Field(default="", max_length=300)
    room: str = Field(default="", max_length=30)
    layout: str = Field(default="", max_length=100)
    areaSqm: float | None = Field(default=None, gt=0, le=10000)
    missing: list[FieldKey] = Field(default_factory=list, max_length=8)

    @field_validator("url")
    @classmethod
    def validate_url(cls, value):
        return public_url(value) if value else None

    @model_validator(mode="after")
    def require_identity(self):
        if not self.url and not self.name.strip():
            raise ValueError("A URL or property name is required")
        return self


class FoundFact(BaseModel):
    key: FieldKey
    value: str | float
    evidenceIndex: int = Field(ge=0)


class FoundListing(BaseModel):
    name: str = Field(max_length=300)
    address: str = Field(max_length=300)
    room: str = Field(max_length=30)
    scope: Literal["building", "unit", "unknown"]
    # A current listing date must come from the source; retrieval time is separate.
    listingDate: str = Field(max_length=100)
    status: Literal["current", "historical", "unknown"]
    facts: list[FoundFact] = Field(max_length=8)


class ResearchMapping(BaseModel):
    listings: list[FoundListing] = Field(max_length=6)

    @classmethod
    def generation_schema(cls):
        """Avoid nested bounded-array grammar rejected by Gemini; validate locally.

        Keeping both maxItems constraints in the generation schema causes a live
        HTTP 400 even for a tiny input. The prompt requests these limits and this
        Pydantic model still enforces them before any result reaches the browser.
        """
        schema = cls.model_json_schema()
        schema["properties"]["listings"].pop("maxItems")
        schema["$defs"]["FoundListing"]["properties"]["facts"].pop("maxItems")
        return schema
